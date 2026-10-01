// ACES - BARRA FLUTUANTE + VOZ
// Este é o ponto de integração. A voz roda na própria página para manter o botão e o reconhecimento no mesmo contexto.

(() => {
  if (globalThis.__acesMainLoaded) return;
  globalThis.__acesMainLoaded = true;

  const VOICE_STORAGE_KEY = "acesVoiceEnabled";
  const TOOLBAR_STORAGE_KEY = "acesToolbarState";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let voiceActive = false;
  let recognitionRunning = false;
  let restarting = false;
  let speakingHelp = false;

  const toolbarState = {
    hidden: false,
    collapsed: false
  };

  function status(message) {
    const el = document.getElementById("aces-status");
    if (el) el.textContent = message;
  }

  function speak(text, after) {
    speakingHelp = true;
    try { recognition?.stop(); } catch {}

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      speakingHelp = false;
      after?.();
    };

    utterance.onerror = () => {
      speakingHelp = false;
      after?.();
    };

    speechSynthesis.speak(utterance);
  }

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[.,!?;:]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCommand(text) {
    const command = normalize(text);

    if (!command) return { action:"UNKNOWN", text:"" };

    // 1) Comandos específicos vêm antes dos genéricos.
    const pageSearch = command.match(/^pesquisar nesta pagina(?: por)? (.+)$/);
    if (pageSearch) return { action:"PAGE_SEARCH", text:pageSearch[1] };

    const search = command.match(/^(?:pesquisar|buscar)(?: por)? (.+)$/);
    if (search) return { action:"WEB_SEARCH", text:search[1] };

    const buttonNumber = command.match(/^(?:clicar|abrir|selecionar) (?:no )?botao (?:numero )?(\d+)$/);
    if (buttonNumber) return { action:"CLICK_BUTTON_NUMBER", number:Number(buttonNumber[1]) };

    const linkNumber = command.match(/^(?:clicar|abrir|selecionar) (?:no )?link (?:numero )?(\d+)$/);
    if (linkNumber) return { action:"CLICK_LINK_NUMBER", number:Number(linkNumber[1]) };

    const clickButton = command.match(/^(?:clicar|clique|abrir|selecionar) (?:no )?botao (.+)$/);
    if (clickButton) return { action:"CLICK_BUTTON", name:clickButton[1] };

    const clickLink = command.match(/^(?:clicar|clique|abrir|selecionar) (?:no )?link (.+)$/);
    if (clickLink) return { action:"CLICK_LINK", name:clickLink[1] };

    const typeText = command.match(/^(?:digitar|escrever|preencher) (.+)$/);
    if (typeText) return { action:"TYPE_TEXT", text:typeText[1] };

    // Contraste: aceitamos várias formas naturais de falar.
    // Exemplos: "alto contraste", "ativar alto contraste",
    // "colocar em alto contraste" e "desativar o contraste".
    if (/(desativar|desligar|tirar|remover) (?:o )?(?:alto )?contraste|sem contraste/.test(command)) {
      return { action:"CONTRAST_OFF" };
    }

    if (/(ativar|ligar|habilitar|usar|colocar|mudar para) (?:o )?alto contraste/.test(command)
        || /^(?:alto contraste|contraste alto|contraste elevado)$/.test(command)
        || /^(?:ativar|ligar|habilitar) (?:o )?contraste$/.test(command)) {
      return { action:"CONTRAST_ON" };
    }

    const aliases = [
      [/^(?:ler pagina|ler a pagina|comecar leitura)$/, "READ"],
      [/^(?:pausar|pausar leitura)$/, "PAUSE"],
      [/^(?:continuar|continuar leitura|retomar leitura)$/, "RESUME"],
      [/^(?:parar|parar leitura|encerrar leitura)$/, "STOP"],
      [/^(?:proximo|proxima|proximo item|proximo elemento)$/, "NEXT"],
      [/^(?:anterior|item anterior|elemento anterior)$/, "PREVIOUS"],
      [/^(?:ler atual|ler este item|ler elemento atual)$/, "READ_CURRENT"],
      [/^(?:proximo botao|ir para o proximo botao)$/, "NEXT_BUTTON"],
      [/^(?:botao anterior|ir para o botao anterior)$/, "PREVIOUS_BUTTON"],
      [/^(?:proximo link|ir para o proximo link)$/, "NEXT_LINK"],
      [/^(?:link anterior|ir para o link anterior)$/, "PREVIOUS_LINK"],
      [/^(?:proximo campo|ir para o proximo campo)$/, "NEXT_FIELD"],
      [/^(?:campo anterior|ir para o campo anterior)$/, "PREVIOUS_FIELD"],
      [/^(?:proximo titulo|ir para o proximo titulo)$/, "NEXT_HEADING"],
      [/^(?:titulo anterior|ir para o titulo anterior)$/, "PREVIOUS_HEADING"],
      [/^(?:rolar para baixo|descer a pagina|descer)$/, "SCROLL_DOWN"],
      [/^(?:rolar para cima|subir a pagina|subir)$/, "SCROLL_UP"],
      [/^(?:ir para o topo|voltar ao topo|topo da pagina)$/, "TOP"],
      [/^(?:ir para o final|final da pagina|fim da pagina)$/, "BOTTOM"],
      [/^(?:voltar|voltar pagina|pagina anterior)$/, "BACK"],
      [/^(?:avancar|avancar pagina|proxima pagina)$/, "FORWARD"],
      [/^(?:recarregar|atualizar pagina)$/, "RELOAD"],
      [/^(?:marcar caixa|marcar a caixa|selecionar caixa)$/, "CHECK"],
      [/^(?:desmarcar caixa|desmarcar a caixa)$/, "UNCHECK"],
      [/^(?:aumentar texto|aumentar fonte)$/, "FONT_UP"],
      [/^(?:diminuir texto|diminuir fonte)$/, "FONT_DOWN"],
      [/^(?:contraste)$/, "CONTRAST_TOGGLE"],
      [/^(?:escala de cinza|tons de cinza|ativar cinza)$/, "GRAYSCALE"],
      [/^(?:inverter cores|inverter cor)$/, "INVERT"],
      [/^(?:destacar links|destacar os links)$/, "HIGHLIGHT_LINKS"],
      [/^(?:reduzir animacoes|reduzir animações)$/, "REDUCE_MOTION"],
      [/^(?:mostrar barra|abrir barra)$/, "SHOW_TOOLBAR"],
      [/^(?:esconder barra|ocultar barra|fechar barra)$/, "HIDE_TOOLBAR"],
      [/^(?:ajuda|comandos|o que posso falar|o que eu posso falar)$/, "HELP"]
    ];

    for (const [pattern, action] of aliases) {
      if (pattern.test(command)) return { action };
    }

    return { action:"UNKNOWN", text:command };
  }

  function voiceButton() {
    return document.getElementById("aces-voice");
  }

  function updateVoiceUI() {
    const button = voiceButton();
    if (!button) return;
    button.textContent = voiceActive ? "🛑 Voz" : "🎙 Voz";
    button.classList.toggle("aces-active", voiceActive);
    button.title = voiceActive ? "Desativar comandos de voz" : "Ativar comandos de voz";
    button.setAttribute("aria-label", button.title);
  }

  function stopRecognition() {
    restarting = false;
    recognitionRunning = false;
    try { recognition?.stop(); } catch {}
  }

  function scheduleRecognition() {
    if (!voiceActive || speakingHelp || restarting || recognitionRunning) return;
    restarting = true;

    setTimeout(() => {
      restarting = false;
      if (!voiceActive || speakingHelp || recognitionRunning) return;
      try {
        recognition.start();
      } catch (error) {
        console.debug("ACES: reconhecimento não iniciou:", error.message);
      }
    }, 300);
  }

  function setupRecognition() {
    if (!SpeechRecognition) {
      status("Seu Chrome não disponibilizou o reconhecimento de voz nesta página.");
      return false;
    }

    if (recognition) return true;

    recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionRunning = true;
      status("🎙 Ouvindo… fale uma frase.");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) finalText += `${text} `;
        else interim += `${text} `;
      }

      if (interim) status(`🎙 Ouvindo: ${interim.trim()}`);

      if (finalText.trim()) {
        const clean = finalText.trim();
        status(`Comando recebido: “${clean}”`);
        stopRecognition();
        executeCommand(parseCommand(clean));
      }
    };

    recognition.onerror = (event) => {
      recognitionRunning = false;
      console.error("ACES: reconhecimento:", event.error);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        voiceActive = false;
        updateVoiceUI();
        status("Voz continua configurada como ativa, mas o navegador não iniciou o microfone. Clique em 🎙 Voz para tentar novamente.");
        return;
      }

      if (event.error === "audio-capture") {
        status("Não encontrei um microfone disponível.");
        return;
      }

      if (event.error === "network") {
        status("O reconhecimento encontrou um erro de conexão.");
      } else if (event.error === "no-speech") {
        status("Não ouvi uma frase. Tentando novamente…");
      } else {
        status(`Erro de voz: ${event.error}`);
      }

      scheduleRecognition();
    };

    recognition.onend = () => {
      recognitionRunning = false;
      if (voiceActive && !speakingHelp) scheduleRecognition();
    };

    return true;
  }

  async function persistVoicePreference(enabled) {
    try {
      await chrome.storage.local.set({
        [VOICE_STORAGE_KEY]: Boolean(enabled)
      });
    } catch (error) {
      console.debug("ACES: não foi possível salvar voz:", error.message);
    }
  }

  async function activateVoice(options = {}) {
    if (!setupRecognition()) return false;

    voiceActive = true;
    updateVoiceUI();

    if (options.persist !== false) {
      await persistVoicePreference(true);
    }

    // Ao restaurar após recarregar a página, não fazemos uma fala automática
    // para evitar surpresa e evitar que a própria síntese seja reconhecida como comando.
    if (options.restored) {
      status("🎙 Voz ativa. Tentando ouvir…");
      scheduleRecognition();
      return true;
    }

    const introduction =
      "Comando de voz ativado. Fale uma frase por vez. " +
      "Exemplos: ler página; próximo botão; ou pesquisar por matemática.";

    speak(introduction, () => {
      status("🎙 Voz ativa. Fale uma frase por vez.");
      scheduleRecognition();
    });

    return true;
  }

  async function deactivateVoice(options = {}) {
    voiceActive = false;
    stopRecognition();
    updateVoiceUI();

    if (options.persist !== false) {
      await persistVoicePreference(false);
    }

    status("Voz desativada.");
    return true;
  }

  async function toggleVoice() {
    if (voiceActive) await deactivateVoice();
    else await activateVoice();
  }

  async function restoreVoicePreference() {
    try {
      const data = await chrome.storage.local.get(VOICE_STORAGE_KEY);

      if (data?.[VOICE_STORAGE_KEY] === true) {
        // Mantém o estado ligado entre páginas. O navegador ainda pode exigir
        // nova interação/permissão em alguns contextos.
        await activateVoice({ restored: true, persist: false });
      } else {
        updateVoiceUI();
      }
    } catch (error) {
      console.debug("ACES: erro ao restaurar voz:", error.message);
      updateVoiceUI();
    }
  }

  async function executeCommand(command) {
    if (!command || !command.action) return;

    try {
      switch (command.action) {
        case "READ": {
          const result = ACESReader.start();
          status(result.ok ? `Leitura iniciada: ${result.total} itens.` : result.error);
          break;
        }
        case "PAUSE": {
          const result = ACESReader.pause();
          status(result.ok ? "Leitura pausada." : result.error);
          break;
        }
        case "RESUME": {
          const result = ACESReader.resume();
          status(result.ok ? "Leitura continuada." : result.error);
          break;
        }
        case "STOP": {
          const result = ACESReader.stop();
          status(result.ok ? "Leitura parada." : result.error);
          break;
        }
        case "NEXT": {
          const result = ACESReader.next();
          status(result.ok ? `Item ${result.index} de ${result.total}.` : result.error);
          break;
        }
        case "PREVIOUS": {
          const result = ACESReader.previous();
          status(result.ok ? `Item ${result.index} de ${result.total}.` : result.error);
          break;
        }
        case "READ_CURRENT": {
          const result = ACESReader.current();
          status(result.ok ? "Lendo o item atual." : result.error);
          break;
        }
        case "NEXT_BUTTON":
        case "PREVIOUS_BUTTON":
        case "NEXT_LINK":
        case "PREVIOUS_LINK":
        case "NEXT_FIELD":
        case "PREVIOUS_FIELD":
        case "NEXT_HEADING":
        case "PREVIOUS_HEADING": {
          const result = ACESNavigation.execute(command.action);
          status(result.ok ? "Elemento selecionado." : result.error);
          break;
        }
        case "CLICK_BUTTON":
        case "CLICK_LINK":
        case "CLICK_BUTTON_NUMBER":
        case "CLICK_LINK_NUMBER":
        case "PAGE_SEARCH":
        case "TYPE_TEXT":
        case "CHECK":
        case "UNCHECK": {
          const result = ACESNavigation.execute(command.action, command);
          status(result.ok ? "Comando executado." : result.error);
          break;
        }
        case "SCROLL_DOWN":
        case "SCROLL_UP":
        case "TOP":
        case "BOTTOM":
        case "BACK":
        case "FORWARD":
        case "RELOAD": {
          const result = ACESNavigation.execute(command.action);
          status(result.ok ? "Navegação executada." : result.error);
          break;
        }
        case "WEB_SEARCH": {
          status(`Pesquisando por: ${command.text}`);
          const response = await chrome.runtime.sendMessage({
            type: "ACES_SEARCH_WEB",
            text: command.text
          });
          if (!response?.ok) status(response?.error || "Não foi possível pesquisar.");
          break;
        }
        case "FONT_UP": {
          const current = ACESVisual.getState().fontScale;
          ACESVisual.setFontScale(current + .1);
          status(`Texto em ${Math.round(ACESVisual.getState().fontScale * 100)}%.`);
          break;
        }
        case "FONT_DOWN": {
          const current = ACESVisual.getState().fontScale;
          ACESVisual.setFontScale(current - .1);
          status(`Texto em ${Math.round(ACESVisual.getState().fontScale * 100)}%.`);
          break;
        }
        case "CONTRAST_ON": {
          ACESVisual.setContrast(true);
          status("Alto contraste ativado.");
          speak("Alto contraste ativado.");
          break;
        }
        case "CONTRAST_OFF": {
          ACESVisual.setContrast(false);
          status("Alto contraste desativado.");
          speak("Alto contraste desativado.");
          break;
        }
        case "CONTRAST_TOGGLE": {
          const state = ACESVisual.toggleContrast();
          status(state.contrast ? "Alto contraste ativado." : "Alto contraste desativado.");
          speak(state.contrast ? "Alto contraste ativado." : "Alto contraste desativado.");
          break;
        }
        case "GRAYSCALE": {
          const state = ACESVisual.getState();
          ACESVisual.apply({ grayscale: !state.grayscale });
          status(ACESVisual.getState().grayscale ? "Escala de cinza ativada." : "Escala de cinza desativada.");
          break;
        }
        case "INVERT": {
          const state = ACESVisual.getState();
          ACESVisual.apply({ invert: !state.invert });
          status(ACESVisual.getState().invert ? "Cores invertidas." : "Cores normais.");
          break;
        }
        case "HIGHLIGHT_LINKS": {
          const state = ACESVisual.getState();
          ACESVisual.apply({ highlightLinks: !state.highlightLinks });
          status(ACESVisual.getState().highlightLinks ? "Links destacados." : "Destaque de links removido.");
          break;
        }
        case "REDUCE_MOTION": {
          const state = ACESVisual.getState();
          ACESVisual.apply({ reduceMotion: !state.reduceMotion });
          status(ACESVisual.getState().reduceMotion ? "Animações reduzidas." : "Animações normais.");
          break;
        }
        case "SHOW_TOOLBAR": {
          setToolbarVisible(true);
          status("Barra exibida.");
          break;
        }
        case "HIDE_TOOLBAR": {
          setToolbarVisible(false);
          break;
        }
        case "HELP": {
          const help = "Você pode dizer: ler página, próximo botão, próximo link, próximo campo, rolar para baixo, pesquisar por matemática, ou digitar seu texto. Fale uma frase por vez.";
          speak(help, () => {
            status("🎙 Voz ativa. Fale uma frase por vez.");
            scheduleRecognition();
          });
          break;
        }
        default:
          status(`Não entendi “${command.text || ""}”. Diga “ajuda” para ver exemplos.`);
      }
    } catch (error) {
      console.error("ACES:", error);
      status(error.message || "Não foi possível executar o comando.");
    } finally {
      if (voiceActive && !speakingHelp) scheduleRecognition();
    }
  }

  async function saveToolbarState(partial = {}) {
    Object.assign(toolbarState, partial);
    try {
      await chrome.storage.local.set({
        [TOOLBAR_STORAGE_KEY]: { ...toolbarState }
      });
    } catch (error) {
      console.debug("ACES: não foi possível salvar a barra:", error.message);
    }
  }

  function setToolbarVisible(visible, options = {}) {
    toolbarState.hidden = !visible;
    const bar = document.getElementById("aces-toolbar");
    bar?.classList.toggle("aces-hidden", !visible);
    if (options.persist !== false) saveToolbarState();
  }

  function clampToolbar(bar, x, y) {
    const maxX = window.innerWidth - bar.offsetWidth - 8;
    const maxY = window.innerHeight - bar.offsetHeight - 8;
    return {
      x: Math.max(8, Math.min(x, Math.max(8, maxX))),
      y: Math.max(8, Math.min(y, Math.max(8, maxY)))
    };
  }

  function enableDrag(bar, handle) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      handle.setPointerCapture?.(event.pointerId);
      const rect = bar.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      bar.style.right = "auto";
      bar.style.bottom = "auto";
      bar.style.left = `${rect.left}px`;
      bar.style.top = `${rect.top}px`;
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const point = clampToolbar(bar, event.clientX - offsetX, event.clientY - offsetY);
      bar.style.left = `${point.x}px`;
      bar.style.top = `${point.y}px`;
    });

    handle.addEventListener("pointerup", () => {
      dragging = false;
    });

    handle.addEventListener("pointercancel", () => {
      dragging = false;
    });
  }

  function createToolbar() {
    if (document.getElementById("aces-toolbar")) return;

    const bar = document.createElement("div");
    bar.id = "aces-toolbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Controles rápidos do ACES");

    bar.innerHTML = `
      <button id="aces-drag" type="button" title="Arrastar barra" aria-label="Arrastar barra">⠿</button>
      <button id="aces-voice" type="button" title="Ativar comandos de voz" aria-label="Ativar comandos de voz">🎙 Voz</button>
      <button id="aces-read" type="button" title="Ler página" aria-label="Ler página">🔊</button>
      <button id="aces-pause" type="button" title="Pausar leitura" aria-label="Pausar leitura">⏸</button>
      <button id="aces-next" type="button" title="Próximo item" aria-label="Próximo item">▶</button>
      <button id="aces-contrast" type="button" class="aces-optional" title="Alternar contraste" aria-label="Alternar contraste">◐</button>
      <button id="aces-font-down" type="button" class="aces-optional" title="Diminuir texto" aria-label="Diminuir texto">A−</button>
      <button id="aces-font-up" type="button" class="aces-optional" title="Aumentar texto" aria-label="Aumentar texto">A+</button>
      <button id="aces-help" type="button" class="aces-optional" title="Ouvir exemplos de comandos" aria-label="Ouvir exemplos de comandos">?</button>
      <button id="aces-collapse" type="button" title="Recolher barra" aria-label="Recolher barra">-</button>
      <span id="aces-status" role="status" aria-live="polite">ACES pronto.</span>
    `;

    document.documentElement.appendChild(bar);

    document.getElementById("aces-voice").addEventListener("click", toggleVoice);
    document.getElementById("aces-read").addEventListener("click", () => statusResult(ACESReader.start(), "Leitura iniciada."));
    document.getElementById("aces-pause").addEventListener("click", () => statusResult(ACESReader.pause(), "Leitura pausada."));
    document.getElementById("aces-next").addEventListener("click", () => statusResult(ACESReader.next(), "Próximo item."));
    document.getElementById("aces-contrast").addEventListener("click", () => {
      const state = ACESVisual.getState();
      ACESVisual.apply({ contrast: !state.contrast });
      status(ACESVisual.getState().contrast ? "Contraste ativado." : "Contraste desativado.");
    });
    document.getElementById("aces-font-down").addEventListener("click", () => {
      const state = ACESVisual.getState();
      ACESVisual.setFontScale(state.fontScale - .1);
      status(`Texto em ${Math.round(ACESVisual.getState().fontScale * 100)}%.`);
    });
    document.getElementById("aces-font-up").addEventListener("click", () => {
      const state = ACESVisual.getState();
      ACESVisual.setFontScale(state.fontScale + .1);
      status(`Texto em ${Math.round(ACESVisual.getState().fontScale * 100)}%.`);
    });
    document.getElementById("aces-help").addEventListener("click", () => {
      const help = "Comandos: ler página, próximo botão, próximo link, próximo campo, rolar para baixo, pesquisar por matemática, ou digitar seu texto. Fale uma frase por vez.";
      speak(help, () => status("🎙 Voz ativa. Fale uma frase por vez."));
    });
    document.getElementById("aces-collapse").addEventListener("click", () => {
      const collapsed = !bar.classList.contains("aces-collapsed");
      bar.classList.toggle("aces-collapsed", collapsed);
      toolbarState.collapsed = collapsed;
      document.getElementById("aces-collapse").textContent = collapsed ? "+" : "-";
      document.getElementById("aces-collapse").title = collapsed ? "Expandir barra" : "Recolher barra";
      saveToolbarState();
    });

    enableDrag(bar, document.getElementById("aces-drag"));
    updateVoiceUI();
  }

  function statusResult(result, successMessage) {
    status(result?.ok ? successMessage : result?.error || "Não foi possível executar.");
  }

  function handleMessage(message, sendResponse) {
    try {
      switch (message?.type) {
        case "ACES_TOGGLE_TOOLBAR":
          setToolbarVisible(message.visible !== false);
          sendResponse({ ok:true });
          return;
        case "ACES_VISUAL_APPLY":
          ACESVisual.apply(message.preferences || {});
          sendResponse({ ok:true, state:ACESVisual.getState() });
          return;
        case "ACES_VISUAL_RESET":
          ACESVisual.reset();
          sendResponse({ ok:true, state:ACESVisual.getState() });
          return;
        case "ACES_READER_START": sendResponse(ACESReader.start()); return;
        case "ACES_READER_STOP": sendResponse(ACESReader.stop()); return;
        case "ACES_READER_PAUSE": sendResponse(ACESReader.pause()); return;
        case "ACES_READER_RESUME": sendResponse(ACESReader.resume()); return;
        case "ACES_READER_NEXT": sendResponse(ACESReader.next()); return;
        case "ACES_READER_PREVIOUS": sendResponse(ACESReader.previous()); return;
        case "ACES_NAVIGATION": sendResponse(ACESNavigation.execute(message.action, message.payload || {})); return;
        default: sendResponse({ ok:false, error:"Mensagem desconhecida." }); return;
      }
    } catch (error) {
      sendResponse({ ok:false, error:error.message || "Erro no ACES." });
    }
  }

  async function restoreToolbarState() {
    try {
      const data = await chrome.storage.local.get(TOOLBAR_STORAGE_KEY);
      const saved = data?.[TOOLBAR_STORAGE_KEY];
      if (!saved) return;

      toolbarState.hidden = Boolean(saved.hidden);
      toolbarState.collapsed = Boolean(saved.collapsed);

      const bar = document.getElementById("aces-toolbar");
      if (bar) {
        bar.classList.toggle("aces-hidden", toolbarState.hidden);
        bar.classList.toggle("aces-collapsed", toolbarState.collapsed);

        const collapse = document.getElementById("aces-collapse");
        if (collapse) {
          collapse.textContent = toolbarState.collapsed ? "+" : "-";
          collapse.title = toolbarState.collapsed ? "Expandir barra" : "Recolher barra";
        }
      }
    } catch (error) {
      console.debug("ACES: erro ao restaurar barra:", error.message);
    }
  }

  createToolbar();
  restoreToolbarState();
  restoreVoicePreference();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return false;
  });
})();
