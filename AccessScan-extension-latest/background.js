chrome.action.onClicked.addListener(function (tab) {
  if (tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(function () {});
  }
});

var multiScanPendingNext = null;

function normalizeMultiScanSteps(msg) {
  var out = [];
  if (Array.isArray(msg.targets)) {
    msg.targets.forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      if (t.type === 'url' && typeof t.url === 'string' && /^https?:\/\//.test(t.url)) {
        out.push({ type: 'url', url: t.url });
      } else if (t.type === 'click' && typeof t.selector === 'string') {
        var sel = t.selector.trim();
        if (sel && sel.length <= 2000) {
          out.push({ type: 'click', selector: sel, label: typeof t.label === 'string' ? t.label : '' });
        }
      }
    });
  }
  if (!out.length && Array.isArray(msg.urls)) {
    msg.urls.forEach(function (u) {
      if (typeof u === 'string' && /^https?:\/\//.test(u)) {
        out.push({ type: 'url', url: u });
      }
    });
  }
  return out;
}

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

  if (msg.type === 'MULTI_SCAN_PAGE_SUBMIT_DONE') {
    if (typeof multiScanPendingNext === 'function') {
      multiScanPendingNext();
    }
    return false;
  }

  if (msg.type === 'RUN_MULTI_SCAN') {
    var steps = normalizeMultiScanSteps(msg);
    var tagsMulti = Array.isArray(msg.tags) ? msg.tags : [];
    if (!steps.length) {
      sendResponse({
        error:
          'No pages or click targets to scan. Reload the extension (chrome://extensions), update the a11ytest.ai app, or use extension options to point the side panel at a build that includes the latest /extension page.'
      });
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

      function stepLabel(step) {
        if (step.type === 'url') return step.url;
        return (step.label ? step.label + ' · ' : '') + step.selector;
      }

      function scheduleScan() {
        var currentPage = index;
        var totalPages = steps.length;
        chrome.runtime.sendMessage({
          type: 'MULTI_SCAN_PAGE_START',
          currentPage: currentPage,
          totalPages: totalPages,
          url: stepLabel(steps[index - 1])
        }).catch(function () {});

        setTimeout(function () {
          injectAndRunScan(tabId, tagsMulti, function () {
            multiScanPendingNext = function () {
              multiScanPendingNext = null;
              runNext();
            };
          });
        }, 4000);
      }

      function runNext() {
        if (index >= steps.length) {
          sendResponse({ ok: true, scanned: steps.length });
          return;
        }

        var step = steps[index];
        index++;

        if (step.type === 'url') {
          chrome.tabs.update(tabId, { url: step.url }, function () {
            if (chrome.runtime.lastError) {
              runNext();
              return;
            }
            scheduleScan();
          });
          return;
        }

        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            world: 'MAIN',
            func: function (sel) {
              try {
                var el = document.querySelector(sel);
                if (!el) return { ok: false, error: 'Element not found' };
                el.scrollIntoView({ block: 'center', inline: 'nearest' });
                el.click();
                return { ok: true };
              } catch (e) {
                return { ok: false, error: e && e.message ? e.message : 'click failed' };
              }
            },
            args: [step.selector]
          },
          function (results) {
            if (chrome.runtime.lastError) {
              runNext();
              return;
            }
            var r = results && results[0] && results[0].result;
            if (!r || !r.ok) {
              runNext();
              return;
            }
            scheduleScan();
          }
        );
      }

      runNext();
    });

    return true;
  }
});
