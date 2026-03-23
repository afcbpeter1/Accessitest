(function () {
  if (typeof window !== 'undefined' && window.__accessScanFocusReaderLoaded) return;
  if (typeof window !== 'undefined') window.__accessScanFocusReaderLoaded = true;

  var enabled = false;
  var lastSpoken = '';
  var lastSpokenAt = 0;
  var pendingTabAnnounce = null;
  var activeAudioSource = null;
  var audioContext = null;
  var speakRequestCounter = 0;

  function getRole(el) {
    var explicitRole = el.getAttribute('role');
    if (explicitRole) return explicitRole.toLowerCase();

    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
      return 'textbox';
    }
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading';
    return tag || 'element';
  }

  function getName(el) {
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      var labelText = labelledBy
        .split(/\s+/)
        .map(function (id) {
          var node = document.getElementById(id);
          return node ? (node.textContent || '').trim() : '';
        })
        .filter(Boolean)
        .join(' ');
      if (labelText) return labelText;
    }

    if (typeof el.innerText === 'string' && el.innerText.trim()) return el.innerText.trim();
    if (typeof el.value === 'string' && el.value.trim()) return el.value.trim();
    var title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    var placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return placeholder.trim();
    return '';
  }

  function getState(el, role) {
    if (role === 'checkbox' || role === 'radio') {
      if (el.hasAttribute('aria-checked')) return el.getAttribute('aria-checked');
      if (typeof el.checked === 'boolean') return el.checked ? 'checked' : 'not checked';
    }
    if (el.hasAttribute('aria-expanded')) return el.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed';
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return 'disabled';
    return '';
  }

  function buildAnnouncement(el) {
    if (!el || !(el instanceof HTMLElement)) return '';
    var role = getRole(el);
    var name = getName(el);
    var state = getState(el, role);

    var parts = [];
    if (name) parts.push(name);
    parts.push(role);
    if (state) parts.push(state);
    return parts.join(', ');
  }

  function speakLocal(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function ensureAudioContext() {
    if (!audioContext) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioContext = new Ctx();
    }
    return audioContext;
  }

  function unlockAudioContext() {
    var ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
  }

  function stopActiveAudio() {
    if (activeAudioSource) {
      try {
        activeAudioSource.stop();
      } catch (e) {}
      activeAudioSource = null;
    }
  }

  function base64ToArrayBuffer(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function playElevenLabsAudio(audioBase64, onFail) {
    try {
      var ctx = ensureAudioContext();
      if (!ctx) {
        onFail();
        return;
      }
      unlockAudioContext();
      var buffer = base64ToArrayBuffer(audioBase64);
      ctx.decodeAudioData(buffer.slice(0))
        .then(function (decoded) {
          if (!enabled) return;
          stopActiveAudio();
          var source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          source.start(0);
          activeAudioSource = source;
        })
        .catch(function () {
          onFail();
        });
    } catch (e) {
      onFail();
    }
  }

  function speak(text) {
    if (!text) return;
    var now = Date.now();
    if (text === lastSpoken && now - lastSpokenAt < 600) return;
    lastSpoken = text;
    lastSpokenAt = now;

    stopActiveAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    var requestId = ++speakRequestCounter;
    var fallbackUsed = false;
    // Fallback voice disabled by request.
    // var fallbackTimer = setTimeout(function () {
    //   if (!enabled || requestId !== speakRequestCounter) return;
    //   fallbackUsed = true;
    //   speakLocal(text);
    // }, 5000);

    chrome.runtime.sendMessage({ type: 'GENERATE_READER_TTS', text: text }, function (response) {
      // if (fallbackTimer) clearTimeout(fallbackTimer);
      if (!enabled || requestId !== speakRequestCounter) return;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        try { console.warn('Reader TTS runtime error:', chrome.runtime.lastError.message); } catch (e) {}
        // if (!fallbackUsed) speakLocal(text);
        return;
      }
      if (!response || !response.ok || !response.audioBase64) {
        try { console.warn('Reader TTS fallback reason:', response && response.error ? response.error : 'unknown'); } catch (e) {}
        // if (!fallbackUsed) speakLocal(text);
        return;
      }
      try {
        if (fallbackUsed && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        playElevenLabsAudio(response.audioBase64, function () {
          // if (!fallbackUsed) speakLocal(text);
        });
      } catch (e) {
        // if (!fallbackUsed) speakLocal(text);
      }
    });
  }

  function onFocusIn(event) {
    if (!enabled) return;
    var text = buildAnnouncement(event.target);
    if (text) speak(text);
  }

  function announceActiveElement() {
    if (!enabled) return;
    var el = document.activeElement;
    if (!el || el === document.body) return;
    var text = buildAnnouncement(el);
    if (text) speak(text);
  }

  function isEditableElement(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea';
  }

  function isPasswordField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input') return false;
    return (el.getAttribute('type') || '').toLowerCase() === 'password';
  }

  function onKeyDown(event) {
    if (!enabled) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    unlockAudioContext();

    // Keep keyboard focus inside the page while reader mode is on.
    // This avoids tabbing into browser/extension chrome.
    if (event.key === 'Tab') {
      var focusable = getFocusableElements();
      if (focusable.length > 0) {
        var active = document.activeElement;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        }
      }
    }

    // Tab navigation can move focus after async handlers/render updates.
    // Announce the resulting active element shortly after keydown.
    if (event.key === 'Tab') {
      if (pendingTabAnnounce) clearTimeout(pendingTabAnnounce);
      pendingTabAnnounce = setTimeout(function () {
        pendingTabAnnounce = null;
        announceActiveElement();
      }, 40);
      return;
    }

    var target = event.target;
    if (!isEditableElement(target)) return;
    if (isPasswordField(target)) return;

    // Speak characters as typed, plus a few common editing keys.
    var key = event.key;
    if (!key) return;
    if (key.length === 1) {
      speakLocal(key === ' ' ? 'space' : key);
      return;
    }
    if (key === 'Backspace') {
      speakLocal('backspace');
      return;
    }
    if (key === 'Delete') {
      speakLocal('delete');
      return;
    }
    if (key === 'Enter') {
      speakLocal('enter');
    }
  }

  function getFocusableElements() {
    var selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    return nodes.filter(function (el) {
      if (!(el instanceof HTMLElement)) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      var style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    });
  }

  function start() {
    enabled = true;
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focus', onFocusIn, true);
    document.addEventListener('keydown', onKeyDown, true);
    if (document.activeElement && document.activeElement !== document.body) {
      var current = buildAnnouncement(document.activeElement);
      if (current) speak(current);
    }
  }

  function stop() {
    enabled = false;
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focus', onFocusIn, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (pendingTabAnnounce) {
      clearTimeout(pendingTabAnnounce);
      pendingTabAnnounce = null;
    }
    stopActiveAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === 'START_FOCUS_READER') {
      start();
      sendResponse({ ok: true, enabled: true });
      return;
    }
    if (msg.type === 'STOP_FOCUS_READER') {
      stop();
      sendResponse({ ok: true, enabled: false });
      return;
    }
  });
})();
