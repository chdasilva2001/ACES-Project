// CAMADA NAVEGAÇÃO
// Localiza elementos visíveis, coloca foco, clica, preenche campos e rola a página.

(() => {
  if (globalThis.__acesNavigationLoaded) return;
  globalThis.__acesNavigationLoaded = true;

  const indexes = {
    button: -1,
    link: -1,
    field: -1,
    heading: -1,
    video: -1
  };

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function visible(element) {
    if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function labelOf(element) {
    return normalize(
      element.getAttribute("aria-label") ||
      element.innerText ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder") ||
      element.value ||
      ""
    );
  }

  function targetWords(text) {
    const stopWords = new Set([
      "o", "a", "os", "as", "um", "uma", "uns", "umas",
      "do", "da", "dos", "das", "de", "no", "na", "nos", "nas",
      "em", "para", "por", "com", "e", "que", "chamado", "chamada", "site"
    ]);

    return normalize(text)
      .split(" ")
      .filter((word) => word.length > 1 && !stopWords.has(word));
  }

  function targetScore(element, target, options = {}) {
    const wanted = normalize(target);
    const label = labelOf(element);
    const href = normalize(element.href || "");
    const title = normalize(element.getAttribute("title") || "");
    const aria = normalize(element.getAttribute("aria-label") || "");
    const words = targetWords(target);

    if (!wanted || !words.length) return -1;

    let score = 0;

    if (label === wanted) score += 1000;
    if (label.includes(wanted)) score += 700;
    if (title === wanted || aria === wanted) score += 500;

    for (const word of words) {
      if (label.includes(word)) score += 120;
      if (title.includes(word)) score += 80;
      if (aria.includes(word)) score += 80;
      if (href.includes(word)) score += 40;
    }

    if (options.preferVideo) score += 80;
    if (options.searchResult) score += 60;

    return score;
  }

  function findBestMatch(elements, target, options = {}) {
    let best = null;
    let bestScore = -1;

    elements.forEach((element, index) => {
      const score = targetScore(element, target, options);
      if (score > bestScore) {
        best = { element, index, score };
        bestScore = score;
      }
    });

    return best && best.score > 0 ? best : null;
  }

  function focusElement(element) {
    if (!element) return false;
    element.scrollIntoView({ behavior:"smooth", block:"center", inline:"nearest" });
    try { element.focus({ preventScroll:true }); } catch { element.focus(); }
    element.classList.add("aces-navigation-focus");
    setTimeout(() => element.classList.remove("aces-navigation-focus"), 1400);
    return true;
  }

  function getElements(kind) {
    const selectors = {
      button: "button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']",
      link: "a[href], [role='link']",
      field: "input:not([type='hidden']), textarea, select, [contenteditable='true'], [role='textbox']",
      heading: "h1,h2,h3,h4,h5,h6,[role='heading']"
    };

    return [...document.querySelectorAll(selectors[kind] || "")].filter(visible);
  }

  function next(kind, step) {
    const elements = getElements(kind);
    if (!elements.length) return { ok:false, error:`Nenhum ${kind} visível foi encontrado.` };

    let index = indexes[kind] + step;
    if (index >= elements.length) index = 0;
    if (index < 0) index = elements.length - 1;

    indexes[kind] = index;
    focusElement(elements[index]);
    return { ok:true, index:index + 1, total:elements.length };
  }

  function clickByName(kind, name) {
    const wanted = normalize(name);
    const elements = getElements(kind);
    const foundIndex = elements.findIndex((el) => labelOf(el).includes(wanted));

    if (foundIndex < 0) {
      return { ok:false, error:`Não encontrei ${kind === "link" ? "o link" : "o botão"} "${name}".` };
    }

    indexes[kind] = foundIndex;
    focusElement(elements[foundIndex]);
    elements[foundIndex].click();
    return { ok:true };
  }

  function isSearchEnginePage() {
    const host = location.hostname.toLowerCase();
    return host.includes("google.") ||
           host.includes("bing.com") ||
           host.includes("duckduckgo.com") ||
           host.includes("yahoo.com");
  }

  function getSearchResultLinks() {
    const currentHost = location.hostname.toLowerCase();
    const links = [...document.querySelectorAll("a[href]")]
      .filter(visible)
      .filter((el) => {
        const text = labelOf(el);
        const href = el.href || "";
        if (!text || text.length < 2) return false;
        if (!/^https?:\/\//i.test(href)) return false;
        if (href.startsWith("javascript:")) return false;

        try {
          const url = new URL(href);
          // Em buscadores, priorizamos links externos ao próprio buscador.
          if (url.hostname.toLowerCase() === currentHost) return false;
          if (url.hostname.toLowerCase().startsWith("www." + currentHost.replace(/^www\./, ""))) return false;
        } catch {
          return false;
        }

        // Ignora links de interface pouco úteis para a ideia de “primeiro resultado”.
        const container = el.closest("header,nav,footer,form");
        if (container) return false;
        return true;
      });

    return [...new Set(links)];
  }

  function getVideoLinks() {
    const selectors = [
      "a#video-title[href*='/watch']",
      "ytd-video-renderer a[href*='/watch']",
      "ytd-rich-item-renderer a[href*='/watch']",
      "a[href*='/watch?v=']",
      "a[href*='/video/']"
    ];

    const result = [];
    const seen = new Set();

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!visible(element)) continue;
        if (seen.has(element)) continue;
        seen.add(element);
        result.push(element);
      }
    }

    return result;
  }

  function clickVideoByName(name) {
    const videos = getVideoLinks();
    const found = findBestMatch(videos, name, { preferVideo: true });

    if (!found) {
      return { ok:false, error:`Não encontrei o vídeo "${name}".` };
    }

    indexes.video = found.index;
    focusElement(found.element);
    found.element.click();
    return { ok:true, matched: labelOf(found.element) };
  }

  function clickResultByName(name) {
    const results = isSearchEnginePage() ? getSearchResultLinks() : getElements("link");
    const found = findBestMatch(results, name, { searchResult: isSearchEnginePage() });

    if (!found) {
      return { ok:false, error:`Não encontrei o resultado "${name}".` };
    }

    indexes.link = found.index;
    focusElement(found.element);
    found.element.click();
    return { ok:true, matched: labelOf(found.element) };
  }

  function openTarget(name) {
    const wanted = normalize(name);

    // Se o usuário disser explicitamente “vídeo”, restringimos a busca aos vídeos.
    if (wanted.startsWith("video ") || wanted.startsWith("videos ")) {
      const target = wanted.replace(/^videos? /, "").trim();
      return clickVideoByName(target);
    }

    const candidates = [];
    const seen = new Set();

    const add = (elements, options = {}) => {
      elements.forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        candidates.push({ element, options });
      });
    };

    if (isSearchEnginePage()) {
      add(getSearchResultLinks(), { searchResult:true });
    }

    add(getVideoLinks(), { preferVideo:true });
    add(getElements("link"));
    add(getElements("button"));

    let best = null;
    for (const candidate of candidates) {
      const score = targetScore(candidate.element, wanted, candidate.options);
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = { ...candidate, score };
      }
    }

    if (!best) {
      return { ok:false, error:`Não encontrei um link, botão ou vídeo correspondente a "${name}".` };
    }

    focusElement(best.element);
    best.element.click();
    return { ok:true, matched: labelOf(best.element) };
  }

  function clickVideoByNumber(number) {
    const videos = getVideoLinks();
    const index = Number(number) - 1;

    if (!videos.length) {
      return { ok:false, error:"Não encontrei vídeos navegáveis nesta página." };
    }

    if (!Number.isInteger(index) || index < 0 || index >= videos.length) {
      return { ok:false, error:`Não existe o vídeo número ${number}.` };
    }

    focusElement(videos[index]);
    videos[index].click();
    return { ok:true };
  }

  function clickResultByNumber(number) {
    const links = isSearchEnginePage()
      ? getSearchResultLinks()
      : getElements("link");

    const index = Number(number) - 1;

    if (!links.length) {
      return { ok:false, error:"Não encontrei resultados navegáveis nesta página." };
    }

    if (!Number.isInteger(index) || index < 0 || index >= links.length) {
      return { ok:false, error:`Não existe o resultado número ${number}.` };
    }

    focusElement(links[index]);
    links[index].click();
    return { ok:true };
  }

  function clickByNumber(kind, number) {
    const elements = (kind === "link" && isSearchEnginePage())
      ? getSearchResultLinks()
      : getElements(kind);
    const index = Number(number) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= elements.length) {
      return { ok:false, error:`Não existe o ${kind} número ${number}.` };
    }

    indexes[kind] = index;
    focusElement(elements[index]);
    elements[index].click();
    return { ok:true };
  }

  function searchThisPage(text) {
    const fields = [...document.querySelectorAll(
      "input[type='search'], input[role='searchbox'], input[name='q'], input[name='query'], input[name='search']"
    )].filter(visible);

    const field = fields[0];
    if (!field) return { ok:false, error:"Não encontrei um campo de pesquisa nesta página." };

    field.focus();
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles:true }));
    field.dispatchEvent(new Event("change", { bubbles:true }));

    if (field.form) {
      if (typeof field.form.requestSubmit === "function") field.form.requestSubmit();
      else field.form.submit();
    } else {
      field.dispatchEvent(new KeyboardEvent("keydown", { key:"Enter", code:"Enter", bubbles:true }));
      field.dispatchEvent(new KeyboardEvent("keyup", { key:"Enter", code:"Enter", bubbles:true }));
    }

    return { ok:true };
  }

  function typeText(text) {
    const field = document.activeElement;
    if (!field || !["INPUT","TEXTAREA"].includes(field.tagName)) {
      return { ok:false, error:"Primeiro selecione um campo de texto." };
    }

    field.focus();
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles:true }));
    field.dispatchEvent(new Event("change", { bubbles:true }));
    return { ok:true };
  }

  function checkbox(checked) {
    const field = document.activeElement;
    if (!field || field.tagName !== "INPUT" || field.type !== "checkbox") {
      return { ok:false, error:"Selecione primeiro uma caixa de seleção." };
    }

    field.checked = checked;
    field.dispatchEvent(new Event("input", { bubbles:true }));
    field.dispatchEvent(new Event("change", { bubbles:true }));
    return { ok:true };
  }

  function execute(action, payload = {}) {
    switch (action) {
      case "NEXT_BUTTON": return next("button", 1);
      case "PREVIOUS_BUTTON": return next("button", -1);
      case "NEXT_LINK": return next("link", 1);
      case "PREVIOUS_LINK": return next("link", -1);
      case "NEXT_FIELD": return next("field", 1);
      case "PREVIOUS_FIELD": return next("field", -1);
      case "NEXT_HEADING": return next("heading", 1);
      case "PREVIOUS_HEADING": return next("heading", -1);
      case "CLICK_BUTTON": return clickByName("button", payload.name);
      case "CLICK_LINK": return clickByName("link", payload.name);
      case "CLICK_BUTTON_NUMBER": return clickByNumber("button", payload.number);
      case "CLICK_LINK_NUMBER": return clickByNumber("link", payload.number);
      case "CLICK_VIDEO": return clickVideoByName(payload.name);
      case "CLICK_VIDEO_NUMBER": return clickVideoByNumber(payload.number);
      case "CLICK_RESULT": return clickResultByName(payload.name);
      case "CLICK_RESULT_NUMBER": return clickResultByNumber(payload.number);
      case "OPEN_TARGET": return openTarget(payload.name);
      case "PAGE_SEARCH": return searchThisPage(payload.text);
      case "TYPE_TEXT": return typeText(payload.text);
      case "CHECK": return checkbox(true);
      case "UNCHECK": return checkbox(false);
      case "SCROLL_DOWN": window.scrollBy({ top:Math.max(450, window.innerHeight * .75), behavior:"smooth" }); return { ok:true };
      case "SCROLL_UP": window.scrollBy({ top:-Math.max(450, window.innerHeight * .75), behavior:"smooth" }); return { ok:true };
      case "TOP": window.scrollTo({ top:0, behavior:"smooth" }); return { ok:true };
      case "BOTTOM": window.scrollTo({ top:document.documentElement.scrollHeight, behavior:"smooth" }); return { ok:true };
      case "BACK": history.back(); return { ok:true };
      case "FORWARD": history.forward(); return { ok:true };
      case "RELOAD": location.reload(); return { ok:true };
      default: return { ok:false, error:"Ação de navegação desconhecida." };
    }
  }

  globalThis.ACESNavigation = { execute };
})();
