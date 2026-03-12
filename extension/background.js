chrome.action.onClicked.addListener(function (tab) {
  if (tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(function () {});
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'GET_CURRENT_TAB') {
    // Get the tab that is selected in the user's browser window (the one they want to scan), not the extension context
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      var url = (tab && tab.url) ? tab.url : null;
      if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://'))) {
        url = null;
      }
      chrome.runtime.sendMessage({ type: 'CURRENT_TAB_URL', url: url }).catch(function () {});
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'RUN_SCAN') {
    var tags = Array.isArray(msg.tags) ? msg.tags : [];
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      var tabUrl = tab.url;
      if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://')) {
        sendResponse({ error: 'Cannot scan this page' });
        return;
      }
      // Inject axe and content script (axe first so it's in scope); avoids page CSP blocking CDN
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['axe.min.js', 'content-scan.js'] }, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message || 'Could not inject scanner' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: 'RUN_SCAN', tags: tags, id: 'scan_' + Date.now() }, function (response) {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message || 'Scan failed' });
            return;
          }
          if (response && response.error) {
            sendResponse({ error: response.error });
            return;
          }
          if (response && response.url) {
            chrome.runtime.sendMessage({
              type: 'SCAN_RESULTS',
              id: response.id,
              url: response.url,
              issues: response.issues || [],
              summary: response.summary || {}
            }).catch(function () {});
          }
          sendResponse({ ok: true });
        });
      });
    });
    return true;
  }
});
