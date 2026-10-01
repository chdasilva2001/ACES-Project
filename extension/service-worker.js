// SERVICE WORKER
// Fica responsável pelas ações que precisam das APIs do Chrome, como pesquisa Web.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "ACES_SEARCH_WEB") {
    const text = String(message.text || "").trim();

    if (!text) {
      sendResponse({ ok: false, error: "Informe o que deseja pesquisar." });
      return false;
    }

    chrome.search.query({
      text,
      disposition: "CURRENT_TAB"
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("ACES: erro ao pesquisar:", error);
        sendResponse({ ok: false, error: error.message || "Não foi possível pesquisar." });
      });

    return true;
  }

  return false;
});
