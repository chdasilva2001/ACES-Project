// SERVICE WORKER
// Fica responsável pelas ações que precisam das APIs do Chrome, como pesquisa Web.
async function openLibrasTab(value) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text || text.length > 4000) {
    throw new Error("Envie um trecho entre 1 e 4.000 caracteres.");
  }

  const requestId = crypto.randomUUID();
  const key = "acesLibras:" + requestId;

  await chrome.storage.session.set({
    [key]: text
  });

  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("libras/libras.html") +
        "?id=" + encodeURIComponent(requestId)
    });
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw error;
  }

  return { ok: true };
} 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ACES_LIBRAS_OPEN") {
    openLibrasTab(message.text)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }
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
