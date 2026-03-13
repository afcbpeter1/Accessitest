chrome.action.onClicked.addListener(function (tab) {
  if (tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(function () {});
  }
});

function injectAndRunScan(tabId, tags, callback) {
  // Inject axe and content script (axe first so it's in scope); avoids page CSP blocking CDN
  chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['axe.min.js', 'content-scan.js'] }, function () {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message || 'Could not inject scanner');
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: 'RUN_SCAN', tags: tags, id: 'scan_' + Date.now() }, function (response) {
      if (chrome.runtime.lastError) {
        callback(chrome.runtime.lastError.message || 'Scan failed');
        return;
      }
      if (response && response.error) {
        callback(response.error);
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
      callback(null);
    });
  });
}

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
      injectAndRunScan(tab.id, tags, function (err) {
        if (err) {
          sendResponse({ error: err });
        } else {
          sendResponse({ ok: true });
        }
      });
    });
    return true;
  }

  if (msg.type === 'GET_LINKS') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      var tabUrl = tab.url;
      if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://')) {
        sendResponse({ ok: false, error: 'Cannot read links on this page' });
        return;
      }
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-links.js'] }, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message || 'Could not inject link collector' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: 'GET_LINKS' }, function (response) {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message || 'Failed to collect links' });
            return;
          }
          if (!response || response.ok === false) {
            sendResponse({ ok: false, error: (response && response.error) || 'Failed to collect links' });
            return;
          }
          sendResponse({ ok: true, links: response.links || [] });
        });
      });
    });
    return true;
  }

  if (msg.type === 'RUN_MULTI_SCAN') {
    var urls = Array.isArray(msg.urls) ? msg.urls.filter(function (u) { return typeof u === 'string' && u && /^https?:\/\//.test(u); }) : [];
    var tagsMulti = Array.isArray(msg.tags) ? msg.tags : [];
    if (!urls.length) {
      sendResponse({ error: 'No URLs to scan' });
      return true;
    }

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }

      var tabId = tab.id;
      var index = 0;

      function runNext() {
        if (index >= urls.length) {
          sendResponse({ ok: true, scanned: urls.length });
          return;
        }

        var targetUrl = urls[index];
        index++;

        chrome.tabs.update(tabId, { url: targetUrl }, function () {
          if (chrome.runtime.lastError) {
            runNext();
            return;
          }

          var listener = function (updatedTabId, changeInfo, updatedTab) {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              injectAndRunScan(tabId, tagsMulti, function () {
                // Ignore individual errors, continue to next URL
                runNext();
              });
            }
          };

          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      runNext();
    });

    return true;
  }
});
