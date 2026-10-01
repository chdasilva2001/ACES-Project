// CAMADA NAVEGAÇÃO
// Localiza elementos visíveis, coloca foco, clica, preenche campos e rola a página.

(() => {
  if (globalThis.__acesNavigationLoaded) return;
  globalThis.__acesNavigationLoaded = true;

  const indexes = {
    button: -1,
    link: -1,
    field: -1,
    heading: -1
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

  function clickByNumber(kind, number) {
    const elements = getElements(kind);
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
