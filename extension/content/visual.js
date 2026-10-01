// CAMADA VISUAL
// Ajustes visuais da página + persistência em chrome.storage.local.

(() => {
  if (globalThis.__acesVisualLoaded) return;
  globalThis.__acesVisualLoaded = true;

  const STORAGE_KEY = "acesPreferences";

  const defaults = {
    fontScale: 1,
    contrast: false,
    grayscale: false,
    sepia: false,
    invert: false,
    highlightLinks: false,
    reduceMotion: false
  };

  const state = { ...defaults };
  let styleElement = null;
  let ready = false;

  function ensureStyle() {
    if (styleElement?.isConnected) return;
    styleElement = document.createElement("style");
    styleElement.id = "aces-visual-style";
    document.documentElement.appendChild(styleElement);
  }

  function buildCss() {
    const filters = [];
    if (state.grayscale) filters.push("grayscale(1)");
    if (state.sepia) filters.push("sepia(.8)");
    if (state.invert) filters.push("invert(1)");

    const contrast = state.contrast ? `
      html, body { background:#111 !important; color:#fff !important; }
      body * { color:#fff !important; border-color:#fff !important; }
      body a { color:#ffe45c !important; }
      body input, body textarea, body select, body button {
        background:#202020 !important; color:#fff !important; border:2px solid #fff !important;
      }
    ` : "";

    const links = state.highlightLinks
      ? `body a { outline:3px solid #ff9900 !important; outline-offset:2px !important; }`
      : "";

    const motion = state.reduceMotion
      ? `*,*::before,*::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }`
      : "";

    const filterRule = filters.length
      ? `html { filter:${filters.join(" ")} !important; }`
      : "";

    const font = `body { zoom:${state.fontScale}; }`;

    return `${contrast}${links}${motion}${filterRule}${font}`;
  }

  async function save() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: { ...state }
      });
    } catch (error) {
      console.debug("ACES: não foi possível salvar preferências:", error.message);
    }
  }

  function render() {
    ensureStyle();
    styleElement.textContent = buildCss();
    ready = true;
  }

  function apply(partial = {}, options = {}) {
    Object.assign(state, partial);
    render();
    if (options.save !== false) save();
    return { ...state };
  }

  function reset() {
    Object.assign(state, defaults);
    render();
    save();
    return { ...state };
  }

  function setFontScale(value) {
    const scale = Math.min(1.8, Math.max(.8, Number(value) || 1));
    return apply({ fontScale: scale });
  }

  function setContrast(enabled) {
    return apply({ contrast: Boolean(enabled) });
  }

  function toggleContrast() {
    return setContrast(!state.contrast);
  }

  async function loadSaved() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const saved = data?.[STORAGE_KEY];

      if (saved && typeof saved === "object") {
        Object.assign(state, {
          ...defaults,
          ...saved
        });
      }

      render();
      return { ...state };
    } catch (error) {
      console.debug("ACES: erro ao carregar preferências:", error.message);
      render();
      return { ...state };
    }
  }

  globalThis.ACESVisual = {
    apply,
    reset,
    setFontScale,
    setContrast,
    toggleContrast,
    loadSaved,
    getState: () => ({ ...state }),
    isReady: () => ready
  };

  // A página sempre começa com as últimas configurações salvas.
  loadSaved();
})();
