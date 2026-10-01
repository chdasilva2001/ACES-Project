// CAMADA LEITOR
// Monta uma fila na ordem em que os elementos aparecem no DOM e lê item por item.

(() => {
  if (globalThis.__acesReaderLoaded) return;
  globalThis.__acesReaderLoaded = true;

  const SELECTOR = [
    "h1,h2,h3,h4,h5,h6",
    "p,blockquote,pre",
    "a[href],button",
    "img",
    "figcaption",
    "li",
    "caption,th,td",
    "label",
    "input:not([type='hidden']),textarea,select",
    "summary",
    "[contenteditable='true']"
  ].join(",");

  let queue = [];
  let currentIndex = -1;
  let currentElement = null;
  let paused = false;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function textOf(element) {
    return clean(element.innerText || element.textContent);
  }

  function labelOf(element) {
    return clean(
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder") ||
      element.value || ""
    );
  }

  function hasSemanticParent(element) {
    let parent = element.parentElement;

    while (parent && parent !== document.body) {
      const tag = parent.tagName;

      // Não repita texto de elementos que já serão lidos como uma unidade.
      if (["P","BLOCKQUOTE","PRE","A","BUTTON","LABEL","FIGCAPTION","SUMMARY"].includes(tag)) {
        return true;
      }

      parent = parent.parentElement;
    }

    return false;
  }

  function describe(element) {
    const tag = element.tagName;
    const text = textOf(element);
    const aria = labelOf(element);

    if (/^H[1-6]$/.test(tag)) {
      return `${tag === "H1" ? "Título principal" : "Título"}: ${text || aria}`;
    }

    if (tag === "A") return `Link: ${text || aria || "sem nome"}`;
    if (tag === "BUTTON") return `Botão: ${text || aria || "sem nome"}`;

    if (tag === "IMG") {
      const alt = clean(element.getAttribute("alt"));
      return `Imagem: ${alt || aria || "sem descrição textual"}`;
    }

    if (tag === "INPUT") {
      const type = element.type || "texto";
      if (["checkbox","radio"].includes(type)) {
        const checked = element.checked ? "marcado" : "desmarcado";
        return `Caixa ${type === "radio" ? "de opção" : "de seleção"}, ${checked}: ${aria || text || "sem descrição"}`;
      }
      return `Campo ${type}: ${aria || "sem descrição"}`;
    }

    if (tag === "TEXTAREA") return `Área de texto: ${aria || "sem descrição"}`;
    if (tag === "SELECT") return `Lista de opções: ${aria || text || "sem descrição"}`;
    if (tag === "LABEL") return `Rótulo: ${text || aria}`;
    if (tag === "LI") return `Item da lista: ${text}`;
    if (tag === "TH") return `Cabeçalho da tabela: ${text}`;
    if (tag === "TD") return `Célula da tabela: ${text}`;
    if (tag === "CAPTION") return `Legenda da tabela: ${text}`;
    if (tag === "FIGCAPTION") return `Legenda da figura: ${text}`;
    if (tag === "SUMMARY") return `Resumo: ${text || aria}`;
    if (element.isContentEditable) return `Campo de texto: ${text || aria || "vazio"}`;

    return text || aria;
  }

  function buildQueue() {
    const elements = [...document.body.querySelectorAll(SELECTOR)];
    const result = [];
    const seen = new Set();

    for (const element of elements) {
      if (!visible(element)) continue;
      if (hasSemanticParent(element)) continue;

      const text = describe(element);
      if (!text) continue;

      // Evita a mesma referência de elemento aparecer duas vezes.
      if (seen.has(element)) continue;
      seen.add(element);

      result.push({ element, text });
    }

    return result;
  }

  function highlight(element) {
    currentElement?.classList.remove("aces-reading-current");
    currentElement = element;
    currentElement?.classList.add("aces-reading-current");
    currentElement?.scrollIntoView({ behavior:"smooth", block:"center", inline:"nearest" });
  }

  function clearHighlight() {
    currentElement?.classList.remove("aces-reading-current");
    currentElement = null;
  }

  function speak(text, onEnd) {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = .95;
    utterance.pitch = 1;

    utterance.onend = () => {
      if (!paused) onEnd?.();
    };

    utterance.onerror = (event) => {
      console.error("ACES: erro na síntese:", event.error);
    };

    speechSynthesis.speak(utterance);
  }

  function start() {
    queue = buildQueue();
    if (!queue.length) return { ok:false, error:"Não encontrei conteúdo visível para ler." };
    paused = false;
    read(0);
    return { ok:true, total:queue.length };
  }

  function read(index) {
    if (index < 0 || index >= queue.length) {
      currentIndex = -1;
      clearHighlight();
      return;
    }

    currentIndex = index;
    paused = false;
    const item = queue[index];
    highlight(item.element);
    speak(item.text, () => read(index + 1));
  }

  function stop() {
    speechSynthesis.cancel();
    paused = false;
    currentIndex = -1;
    clearHighlight();
    return { ok:true };
  }

  function pause() {
    if (!speechSynthesis.speaking) return { ok:false, error:"O leitor não está falando." };
    paused = true;
    speechSynthesis.pause();
    return { ok:true };
  }

  function resume() {
    if (!speechSynthesis.paused) return { ok:false, error:"A leitura não está pausada." };
    paused = false;
    speechSynthesis.resume();
    return { ok:true };
  }

  function next() {
    if (!queue.length) queue = buildQueue();
    const index = currentIndex < 0 ? 0 : currentIndex + 1;
    speechSynthesis.cancel();
    paused = false;
    read(Math.min(index, queue.length - 1));
    return { ok:true, index:currentIndex + 1, total:queue.length };
  }

  function previous() {
    if (!queue.length) queue = buildQueue();
    const index = currentIndex <= 0 ? 0 : currentIndex - 1;
    speechSynthesis.cancel();
    paused = false;
    read(index);
    return { ok:true, index:currentIndex + 1, total:queue.length };
  }

  function current() {
    if (currentIndex < 0 || !queue[currentIndex]) {
      return { ok:false, error:"Nenhum item do leitor está selecionado." };
    }
    speechSynthesis.cancel();
    paused = false;
    speak(queue[currentIndex].text);
    return { ok:true, text:queue[currentIndex].text };
  }

  globalThis.ACESReader = {
    start,
    stop,
    pause,
    resume,
    next,
    previous,
    current,
    rebuild: () => (queue = buildQueue()).length
  };
})();
