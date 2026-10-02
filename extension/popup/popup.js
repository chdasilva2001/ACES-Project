const STORAGE_KEY = "acesPreferences";

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
    throw new Error(
      "Abra um site comum, como https://www.google.com."
    );
  }
  return tab;
}

async function sendToPage(message) {
  const tab = await getActiveTab();

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error(
      "Recarregue a página depois de carregar a extensão."
    );
  }
}

function readPreferences() {
  return {
    fontScale: Number(
      document.getElementById("fontScale").value
    ),
    contrast:
      document.getElementById("contrast").dataset.active === "true",
    grayscale:
      document.getElementById("grayscale").dataset.active === "true",
    invert:
      document.getElementById("invert").dataset.active === "true",
    highlightLinks:
      document.getElementById("highlightLinks").dataset.active === "true",
    reduceMotion:
      document.getElementById("reduceMotion").dataset.active === "true"
  };
}
function updateFontLabel(value) {
  document.getElementById("fontValue").textContent =
    `${Math.round(Number(value) * 100)}%`;
}
function setButtonState(id, active) {
  const button = document.getElementById(id);

  if (!button) return;

  button.dataset.active = String(active);

  button.classList.toggle("active", active);

  button.setAttribute(
    "aria-pressed",
    String(active)
  );
}
async function applyVisual() {
  const preferences = readPreferences();

  const response = await sendToPage({
    type: "ACES_VISUAL_APPLY",
    preferences
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ||
      "Não foi possível aplicar os ajustes."
    );
  }
  await chrome.storage.local.set({
    [STORAGE_KEY]: preferences
  });

  updateFontLabel(preferences.fontScale);

  setStatus("Ajustes aplicados.");
}

async function resetVisual() {
  const response = await sendToPage({
    type: "ACES_VISUAL_RESET"
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ||
      "Não foi possível restaurar."
    );
  }
  document.getElementById("fontScale").value = "1";
  [
    "contrast",
    "grayscale",
    "invert",
    "highlightLinks",
    "reduceMotion"
  ].forEach((id) => {
    setButtonState(id, false);
  });
  const preferences = readPreferences();

  await chrome.storage.local.set({
    [STORAGE_KEY]: preferences
  });

  updateFontLabel(1);

  setStatus("Ajustes restaurados.");
}

async function toggleToolbar() {
  const button = document.getElementById("toggleToolbar");

  const hiding = button.dataset.hidden !== "true";

  const response = await sendToPage({
    type: "ACES_TOGGLE_TOOLBAR",
    visible: !hiding
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ||
      "Não foi possível alterar a barra."
    );
  }

  button.dataset.hidden = hiding
    ? "true"
    : "false";

  button.textContent = hiding
    ? "Mostrar barra"
    : "Ocultar barra";

  document.getElementById("toolbarState").textContent =
    hiding
      ? "A barra está oculta nesta página."
      : "A barra está ativa nesta página.";
}

async function load() {
  const data = await chrome.storage.local.get(
    STORAGE_KEY
  );

  const preferences = data[STORAGE_KEY];

  if (!preferences) {
    return;
  }

  document.getElementById("fontScale").value =
    String(preferences.fontScale ?? 1);

  setButtonState("contrast",Boolean(preferences.contrast));
  setButtonState("grayscale", Boolean(preferences.grayscale));
  setButtonState("invert", Boolean(preferences.invert));
  setButtonState("highlightLinks", Boolean(preferences.highlightLinks));
  setButtonState("reduceMotion", Boolean(preferences.reduceMotion));
  updateFontLabel(preferences.fontScale ?? 1);
}

document.getElementById("toggleToolbar").addEventListener("click", () => { toggleToolbar().catch((e) => setStatus(e.message));});

document.getElementById("fontScale").addEventListener("input", () => { updateFontLabel(document.getElementById("fontScale").value);
applyVisual().catch((e) => setStatus(e.message));});

document.querySelectorAll("[data-font]").forEach((button) => { button.addEventListener("click", async () => {

      const current = Number( document.getElementById("fontScale").value);

      const next = Math.min( 1.8,Math.max(0.8,current + Number(button.dataset.font)));

      document.getElementById("fontScale").value = String(next);

      updateFontLabel(next);

      applyVisual().catch((e) => setStatus(e.message));});

  });

[
  "contrast",
  "grayscale",
  "invert",
  "highlightLinks",
  "reduceMotion"
].forEach((id) => {

  const button = document.getElementById(id);

  button.addEventListener("click", () => {

    const current =button.dataset.active === "true";

    setButtonState(id, !current);

    applyVisual().catch((e) => setStatus(e.message));});

});

document.getElementById("reset").addEventListener("click", () => {resetVisual().catch((e) => setStatus(e.message));});

load().catch((error) => {console.error("ACES:", error);});
