const textElement = document.getElementById("selectedText");
const statusElement = document.getElementById("widgetStatus");

let started = false;

function notify(type) {
  window.parent.postMessage({ type }, "*");
}

function setStatus(message) {
  statusElement.textContent = message;
}

function loadWidget() {
  const script = document.createElement("script");

  script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
  script.async = true;

  script.onload = () => {
    try {
      if (typeof window.VLibras?.Widget !== "function") {
        throw new Error("O carregamento não disponibilizou o widget.");
      }

      new window.VLibras.Widget({
        position: "R"
      });

      setStatus("Abra o botão do VLibras à direita e clique no texto para traduzi-lo.");
      notify("ACES_LIBRAS_WIDGET_LOADED");
    } catch (error) {
      console.error("ACES Libras:", error);
      setStatus("Não foi possível iniciar o VLibras.");
      notify("ACES_LIBRAS_ERROR");
    }
  };

  script.onerror = () => {
    setStatus("Não foi possível baixar o VLibras. Confira a conexão.");
    notify("ACES_LIBRAS_ERROR");
  };

  document.body.appendChild(script);
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent ||
      event.data?.type !== "ACES_LIBRAS_TEXT" ||
      started) {
    return;
  }

  const text = event.data.text;

  if (typeof text !== "string" || !text.trim() || text.length > 4000) {
    setStatus("O trecho recebido é inválido.");
    notify("ACES_LIBRAS_ERROR");
    return;
  }

  started = true;
  textElement.textContent = text;
  notify("ACES_LIBRAS_RECEIVED");
  loadWidget();
});

notify("ACES_LIBRAS_READY");