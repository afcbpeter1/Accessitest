(function () {
  const IFRAME_ID = 'app-iframe';
  // Default to production; use extension options to switch to http://localhost:3000 for local testing
  const DEFAULT_APP_URL = 'https://a11ytest.ai';

  var pendingScansById = {};
  var lastScanTags = [];
  var lastWcagLevel = 'AA';
  var isMultiScan = false;
  var currentMultiScanId = null;
  var scanOverlayVisible = false;
  var currentAppBaseUrl = DEFAULT_APP_URL;
  var focusReaderEnabled = false;
  var focusReaderAllowed = false;
  var focusReaderLoggedIn = false;

  function getIframe() {
    return document.getElementById(IFRAME_ID);
  }

  function updateFocusReaderToggle() {
    var btn = document.getElementById('focus-reader-toggle');
    if (!btn) return;
    btn.style.display = 'inline-block';
    btn.disabled = false;
    btn.title = 'Announce focused element as you tab';
    btn.textContent = focusReaderEnabled ? 'Reader: On' : 'Reader: Off';
    btn.classList.toggle('on', focusReaderEnabled);
    btn.setAttribute('aria-pressed', focusReaderEnabled ? 'true' : 'false');
  }

  function setFocusReader(enabled) {
    chrome.runtime.sendMessage({ type: 'SET_FOCUS_READER', enabled: !!enabled }, function (response) {
      focusReaderEnabled = !!(response && response.enabled);
      updateFocusReaderToggle();
    });
  }

  function initFocusReaderToggle() {
    var btn = document.getElementById('focus-reader-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      setFocusReader(!focusReaderEnabled);
    });
    chrome.runtime.sendMessage({ type: 'GET_FOCUS_READER_STATE' }, function (response) {
      focusReaderEnabled = !!(response && response.enabled);
      updateFocusReaderToggle();
    });
  }

  initFocusReaderToggle();


  function showScanOverlay(multiScan, currentPage, totalPages, url) {
    var overlay = document.getElementById('scan-overlay');
    var title = document.getElementById('scan-overlay-title');
    var bar = document.getElementById('scan-progress-bar');
    var fill = document.getElementById('scan-progress-fill');
    var urlEl = document.getElementById('scan-overlay-url');
    if (!overlay) return;
    scanOverlayVisible = true;
    if (multiScan && totalPages > 0) {
      title.textContent = 'Scanning page ' + (currentPage || 1) + ' of ' + totalPages;
      bar.style.display = 'block';
      fill.style.width = ((currentPage || 1) / totalPages * 100) + '%';
      urlEl.textContent = url || '';
      urlEl.style.display = url ? 'block' : 'none';
    } else {
      title.textContent = 'Scanning…';
      bar.style.display = 'none';
      urlEl.style.display = 'none';
    }
    overlay.classList.add('visible');
  }

  function updateScanOverlayProgress(currentPage, totalPages, url) {
    if (!scanOverlayVisible) return;
    var title = document.getElementById('scan-overlay-title');
    var bar = document.getElementById('scan-progress-bar');
    var fill = document.getElementById('scan-progress-fill');
    var urlEl = document.getElementById('scan-overlay-url');
    if (title) title.textContent = 'Scanning page ' + currentPage + ' of ' + totalPages;
    if (bar) bar.style.display = 'block';
    if (fill && totalPages > 0) fill.style.width = (currentPage / totalPages * 100) + '%';
    if (urlEl) { urlEl.textContent = url || ''; urlEl.style.display = url ? 'block' : 'none'; }
  }

  function hideScanOverlay() {
    var overlay = document.getElementById('scan-overlay');
    if (overlay) overlay.classList.remove('visible');
    scanOverlayVisible = false;
    isMultiScan = false;
    currentMultiScanId = null;
  }

  function getAppUrl(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['accessScanAppUrl'], function (data) {
        cb(data.accessScanAppUrl || DEFAULT_APP_URL);
      });
    } else {
      cb(DEFAULT_APP_URL);
    }
  }

  function setIframeSrc(url) {
    const iframe = getIframe();
    if (iframe) {
      const base = url.replace(/\/$/, '');
      currentAppBaseUrl = base;
      chrome.runtime.sendMessage({ type: 'SET_EXTENSION_APP_BASE_URL', baseUrl: base }, function () {});
      iframe.src = base + '/login?redirect=' + encodeURIComponent('/extension');
    }
  }

  getAppUrl(function (url) {
    setIframeSrc(url);
  });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (msg.type === 'SCAN_RESULTS') {
        var scanId = msg.id;
        if (scanId != null) {
          pendingScansById[scanId] = { url: msg.url, issues: msg.issues || [], summary: msg.summary || {} };
        }
        const iframe = getIframe();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SUBMIT_SCAN',
            id: msg.id,
            url: msg.url,
            issues: msg.issues || [],
            summary: msg.summary || {},
            wcagLevel: lastWcagLevel,
            selectedTags: lastScanTags,
            multiScanId: currentMultiScanId
          }, '*');
        }
        if (!isMultiScan) hideScanOverlay();
        sendResponse({ ok: true });
      } else if (msg.type === 'CURRENT_TAB_URL') {
        const iframe = getIframe();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_CURRENT_TAB_URL',
            url: msg.url != null ? msg.url : null
          }, '*');
        }
        sendResponse({ ok: true });
      } else if (msg.type === 'MULTI_SCAN_PAGE_START') {
        updateScanOverlayProgress(msg.currentPage || 1, msg.totalPages || 1, msg.url || '');
        const iframe = getIframe();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_MULTI_SCAN_PAGE_START',
            currentPage: msg.currentPage,
            totalPages: msg.totalPages,
            url: msg.url || ''
          }, '*');
        }
        sendResponse({ ok: true });
      }
      return true;
    });
  }

  window.addEventListener('message', function (event) {
    var iframe = getIframe();
    if (!iframe || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'ACCESSSCAN_GET_CURRENT_TAB') {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, function () {});
      return;
    }

    if (data.type === 'ACCESSSCAN_READER_ENTITLEMENT') {
      focusReaderLoggedIn = !!data.loggedIn;
      focusReaderAllowed = !!data.readerAllowed;
      if (!focusReaderAllowed && focusReaderEnabled) {
        setFocusReader(false);
      } else {
        updateFocusReaderToggle();
      }
      return;
    }

    if (data.type === 'ACCESSSCAN_SET_AUTH_TOKEN') {
      chrome.runtime.sendMessage({ type: 'SET_EXTENSION_AUTH', token: data.token || '' }, function () {});
      return;
    }

    if (data.type === 'ACCESSSCAN_SET_FOCUS_READER') {
      setFocusReader(!!data.enabled);
      return;
    }

    if (data.type === 'ACCESSSCAN_RUN_SCAN') {
      isMultiScan = false;
      showScanOverlay(false);
      currentMultiScanId = null;
      var tags = Array.isArray(data.tags) ? data.tags : [];
      lastScanTags = tags;
      lastWcagLevel = (data.wcagLevel === 'A' || data.wcagLevel === 'AAA') ? data.wcagLevel : 'AA';
      chrome.runtime.sendMessage({ type: 'RUN_SCAN', tags: tags }, function (response) {
        if (!iframe || !iframe.contentWindow) return;
        if (response && response.error) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SCAN_ERROR',
            error: response.error
          }, '*');
          hideScanOverlay();
          return;
        }
        if (response && response.id != null) {
          pendingScansById[response.id] = { url: response.url || '', issues: response.issues || [], summary: response.summary || {} };
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SUBMIT_SCAN',
            id: response.id,
            url: response.url || '',
            issues: response.issues || [],
            summary: response.summary || {},
            wcagLevel: lastWcagLevel,
            selectedTags: lastScanTags,
            multiScanId: currentMultiScanId
          }, '*');
        }
        hideScanOverlay();
      });
      return;
    }

    if (data.type === 'ACCESSSCAN_GET_LINKS') {
      chrome.runtime.sendMessage({ type: 'GET_LINKS' }, function (response) {
        if (!iframe.contentWindow) return;
        if (!response || response.ok === false) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_LINKS_ERROR',
            error: (response && response.error) || 'Failed to get links from this page'
          }, '*');
        } else {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_LINKS',
            links: response.links || []
          }, '*');
        }
      });
      return;
    }

    if (data.type === 'ACCESSSCAN_RUN_MULTI_SCAN') {
      var urls = Array.isArray(data.urls) ? data.urls : [];
      isMultiScan = true;
      currentMultiScanId = 'ms_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      showScanOverlay(true, 1, urls.length, urls[0] || '');
      var tagsMulti = Array.isArray(data.tags) ? data.tags : [];
      lastScanTags = tagsMulti;
      lastWcagLevel = (data.wcagLevel === 'A' || data.wcagLevel === 'AAA') ? data.wcagLevel : 'AA';
      chrome.runtime.sendMessage({ type: 'RUN_MULTI_SCAN', urls: urls, tags: tagsMulti }, function (response) {
        if (response && response.error && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SCAN_ERROR',
            error: response.error
          }, '*');
          hideScanOverlay();
        }
        if (response && response.ok === true && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_MULTI_SCAN_COMPLETE',
            scanned: response.scanned || 0
          }, '*');
          hideScanOverlay();
        }
      });
      return;
    }

    if (data.type === 'ACCESSSCAN_SUBMIT_RESPONSE') {
      var success = data.success;
      var backlogDetail = data.backlogAddedDetail || {};
      var reportUrl = data.reportUrl;
      var scanHistoryId = data.scanHistoryId;
      var remediationReport = data.remediationReport;
      var scanId = data.id;
      var payload = (scanId != null && pendingScansById[scanId]) ? pendingScansById[scanId] : {};
      if (scanId != null) delete pendingScansById[scanId];
      chrome.runtime.sendMessage({ type: 'MULTI_SCAN_PAGE_SUBMIT_DONE' }).catch(function () {});
      if (iframe.contentWindow) {
        if (success) {
          var added = (typeof backlogDetail.added === 'number' ? backlogDetail.added : 0) +
            (typeof backlogDetail.reopened === 'number' ? backlogDetail.reopened : 0);
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SHOW_RESULTS',
            url: payload.url || '',
            issues: payload.issues || [],
            summary: payload.summary || {},
            backlogAdded: added,
            backlogAddedDetail: backlogDetail,
            reportUrl: reportUrl || null,
            scanHistoryId: scanHistoryId || null,
            backlogError: data.backlogError || null,
            remediationReport: Array.isArray(remediationReport) ? remediationReport : []
          }, '*');
        } else {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SCAN_ERROR',
            error: data.error || 'Scan failed'
          }, '*');
          hideScanOverlay();
        }
      }
    }
  });
})();
