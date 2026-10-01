(() => {
  if (globalThis.ACESLibras) return;

  let selectedText = "";

  function captureSelection() {
    selectedText = (window.getSelection()?.toString() || "").trim();
  }

  async function openSelection() {
    const text = (
      selectedText || window.getSelection()?.toString() || ""
    ).trim();

    selectedText = "";

    if (!text) {
      return {
        ok: false,
        error: "Selecione um trecho da página antes de clicar em Libras."
      };
    }

    if (text.length > 4000) {
      return {
        ok: false,
        error: "Selecione um trecho de até 4.000 caracteres."
      };
    }

    return await chrome.runtime.sendMessage({
      type: "ACES_LIBRAS_OPEN",
      text
    });
  }

  globalThis.ACESLibras = {
    captureSelection,
    openSelection
  };
})();