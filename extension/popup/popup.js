const contrastInput = document.getElementById("contrast");
const applyButton = document.getElementById("apply");
const restoreButton = document.getElementById("restore");
const statusElement = document.getElementById("status");

const STORAGE_KEY = "acesPreferences";

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/^https?:\/\//i.test(tab.url ?? "")) {
    throw new Error(
      "Abra uma página comum de um site para utilizar o ACES."
    );
  }

  return tab;
}

async function sendPreferencesToPage(preferences) {
  const tab = await getActiveTab();

  // Carrega o código que recebe os comandos na página.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/content.js"]
  });

  // Envia as configurações para esse código.
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "ACES_APPLY_PREFERENCES",
    preferences
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ?? "A página não confirmou a aplicação dos ajustes."
    );
  }
}

async function applyPreferences(preferences) {
  setBusy(true);
  showStatus("Aplicando ajustes...");

  try {
    await sendPreferencesToPage(preferences);

    // Só salva depois que a página confirmar a aplicação.
    await chrome.storage.local.set({
      [STORAGE_KEY]: preferences
    });

    contrastInput.checked = preferences.contrast;

    showStatus(
      preferences.contrast
        ? "Modo de contraste aplicado. Preferência salva."
        : "Ajustes removidos. Preferência salva."
    );
  } catch (error) {
    console.error("Erro no ACES:", error);

    showStatus(
      `Não foi possível concluir a operação: ${error.message}`
    );
  } finally {
    setBusy(false);
  }
}

applyButton.addEventListener("click", () => {
  applyPreferences({
    contrast: contrastInput.checked
  });
});

restoreButton.addEventListener("click", () => {
  applyPreferences({
    contrast: false
  });
});

async function initializePopup() {
  setBusy(true);

  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const preferences = data[STORAGE_KEY];

    contrastInput.checked = preferences?.contrast === true;

    showStatus(
      "Escolha uma configuração e clique em Aplicar na página."
    );
  } catch (error) {
    console.error("Erro ao carregar preferências:", error);

    showStatus(
      "Não foi possível recuperar a preferência salva."
    );
  } finally {
    setBusy(false);
  }
}

initializePopup();