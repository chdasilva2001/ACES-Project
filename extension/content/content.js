(() => {
  // Evita cadastrar vários ouvintes na mesma página.
  if (globalThis.__acesbInitialized) {
    return;
  }

  let contrastStyle = null;

  const contrastCSS = `
    html,
    body {
      background-color: #121212 !important;
      color: #f5f5f5 !important;
    }

    body :where(
      main, article, section, header, footer, nav, aside,
      div, p, h1, h2, h3, h4, h5, h6,
      ul, ol, li, span, label,
      form, fieldset, legend,
      table, thead, tbody, tr, th, td
    ) {
      background-color: #121212 !important;
      color: #f5f5f5 !important;
    }

    body a {
      color: #ffe066 !important;
    }

    body :where(button, input, select, textarea) {
      background-color: #222222 !important;
      color: #ffffff !important;
      border-color: #ffffff !important;
    }

    body :focus-visible {
      outline: 3px solid #ffe066 !important;
      outline-offset: 3px !important;
    }
  `;

  function setContrast(enabled) {
    if (enabled) {
      if (!contrastStyle?.isConnected) {
        contrastStyle = document.createElement("style");
        contrastStyle.textContent = contrastCSS;

        document.documentElement.appendChild(contrastStyle);
      }

      return;
    }

    contrastStyle?.remove();
    contrastStyle = null;
  }

  function applyPreferences(preferences) {
    setContrast(preferences?.contrast === true);
  }

  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message?.type !== "ACESB_APPLY_PREFERENCES") {
        return;
      }

      try {
        applyPreferences(message.preferences);

        sendResponse({
          ok: true
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message
        });
      }
    }
  );

  globalThis.__acesbInitialized = true;
})();