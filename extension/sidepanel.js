(function () {
  const IFRAME_ID = 'app-iframe';
  // Default to production; use extension options to switch to http://localhost:3000 for local testing
  const DEFAULT_APP_URL = 'https://a11ytest.ai';

  var pendingScan = null;

  function getIframe() {
    return document.getElementById(IFRAME_ID);
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
      iframe.src = base + '/login?redirect=' + encodeURIComponent('/extension');
    }
  }

  getAppUrl(function (url) {
    setIframeSrc(url);
  });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (msg.type === 'SCAN_RESULTS') {
        pendingScan = { url: msg.url, issues: msg.issues || [], summary: msg.summary || {} };
        const iframe = getIframe();
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SUBMIT_SCAN',
            id: msg.id,
            url: msg.url,
            issues: msg.issues || [],
            summary: msg.summary || {}
          }, '*');
        }
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

    if (data.type === 'ACCESSSCAN_RUN_SCAN') {
      var tags = Array.isArray(data.tags) ? data.tags : [];
      chrome.runtime.sendMessage({ type: 'RUN_SCAN', tags: tags }, function (response) {
        if (response && response.error && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SCAN_ERROR',
            error: response.error
          }, '*');
        }
      });
      return;
    }

    if (data.type === 'ACCESSSCAN_SUBMIT_RESPONSE') {
      var success = data.success;
      var backlogAdded = data.backlogAdded;
      var reportUrl = data.reportUrl;
      var scanHistoryId = data.scanHistoryId;
      var remediationReport = data.remediationReport;
      var payload = pendingScan || {};
      pendingScan = null;
      if (iframe.contentWindow) {
        if (success) {
          var added = (backlogAdded && typeof backlogAdded.added === 'number' ? backlogAdded.added : 0) +
            (backlogAdded && typeof backlogAdded.reopened === 'number' ? backlogAdded.reopened : 0);
          iframe.contentWindow.postMessage({
            type: 'ACCESSSCAN_SHOW_RESULTS',
            url: payload.url || '',
            issues: payload.issues || [],
            summary: payload.summary || {},
            backlogAdded: added,
            backlogAddedDetail: backlogAdded || {},
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
        }
      }
    }
  });
})();
