const frame = document.getElementById("translator");
const statusElement = document.getElementById("status");

const requestId = new URLSearchParams(location.search).get("id");

let selectedText = "";
let storageKey = "";

function setStatus(message) {
  statusElement.textContent = message;
}

window.addEventListener("message", async (event) => {
  if (event.source !== frame.contentWindow || event.origin !== "null") {
    return;
  }

  try {
    switch (event.data?.type) {
      case "ACES_LIBRAS_READY":
        frame.contentWindow.postMessage({
          type: "ACES_LIBRAS_TEXT",
          text: selectedText
        }, "*");
        break;

      case "ACES_LIBRAS_RECEIVED":
        await chrome.storage.session.remove(storageKey);
        setStatus("Trecho recebido. Carregando a ferramenta...");
        break;

      case "ACES_LIBRAS_WIDGET_LOADED":
        setStatus("Abra o botão do VLibras dentro da área abaixo e clique no trecho.");
        break;

      case "ACES_LIBRAS_ERROR":
        setStatus("Falha ao carregar o VLibras. Confira a conexão e o Console.");
        break;
    }
  } catch (error) {
    setStatus(error.message);
  }
});

async function initialize() {
  if (!requestId) {
    throw new Error("Abra esta área pelo botão Libras da barra do ACES.");
  }

  storageKey = "acesLibras:" + requestId;

  const data = await chrome.storage.session.get(storageKey);
  const text = data[storageKey];

  if (typeof text !== "string" || !text.trim() || text.length > 4000) {
    throw new Error("O trecho não está disponível. Selecione-o novamente na página.");
  }

  selectedText = text;
  frame.src = "sandbox.html";
}

initialize().catch((error) => setStatus(error.message));