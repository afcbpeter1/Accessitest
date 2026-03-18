(function () {
  if (typeof window !== 'undefined' && window.__accessScanScanLoaded) return;
  if (typeof window !== 'undefined') window.__accessScanScanLoaded = true;

  var lastAxeRun = Promise.resolve();

  /**
   * Wait until the page "settles" before running axe.
   * This helps avoid scanning skeleton/loading placeholders that may still be in the DOM.
   */
  function waitForStableDom(timeoutMs, quietMs) {
    timeoutMs = timeoutMs || 20000;
    quietMs = quietMs || 1500;

    return new Promise(function (resolve) {
      var settled = false;
      var timer = null;

      function markSettled() {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve();
      }

      // Resolve on timeout as a fallback.
      var timeoutHandle = setTimeout(function () {
        markSettled();
      }, timeoutMs);

      // If the document isn't ready, wait for load.
      try {
        if (document.readyState === 'complete') {
          // proceed
        } else {
          window.addEventListener(
            'load',
            function () {
              // Let it stabilize after load before resolving.
            },
            { once: true }
          );
        }
      } catch (e) {
        // Ignore.
      }

      // Observe DOM mutations to detect "quiet" period.
      var observer = null;
      try {
        observer = new MutationObserver(function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () {
            if (observer) observer.disconnect();
            clearTimeout(timeoutHandle);
            markSettled();
          }, quietMs);
        });
        observer.observe(document.documentElement || document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        });
      } catch (e) {
        // If observer fails for any reason, fall back to timeout only.
        observer = null;
      }

      // Start the quiet timer immediately if already settled.
      timer = setTimeout(function () {
        if (observer) observer.disconnect();
        clearTimeout(timeoutHandle);
        markSettled();
      }, quietMs);
    });
  }

  function mapViolationsToIssues(violations) {
    if (!Array.isArray(violations)) return [];
    return violations.map(function (v) {
      return {
        id: v.id,
        description: v.description || '',
        impact: v.impact || 'moderate',
        help: v.help || '',
        helpUrl: v.helpUrl || '',
        tags: v.tags || [],
        nodes: (v.nodes || []).map(function (node) {
          return {
            html: node.html || '',
            target: node.target || [],
            failureSummary: node.failureSummary || ''
          };
        })
      };
    });
  }

  function buildSummary(issues) {
    var total = issues.length;
    var critical = 0, serious = 0, moderate = 0, minor = 0;
    issues.forEach(function (i) {
      if (i.impact === 'critical') critical++;
      else if (i.impact === 'serious') serious++;
      else if (i.impact === 'moderate') moderate++;
      else if (i.impact === 'minor') minor++;
    });
    return { total: total, critical: critical, serious: serious, moderate: moderate, minor: minor };
  }

  function runAxe(tags, id, callback) {
    if (typeof window.axe === 'undefined') {
      callback('axe-core not loaded', null);
      return;
    }
    lastAxeRun = lastAxeRun
      .then(function () {
        return waitForStableDom(20000, 1500).then(function () {
          return window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
        });
      })
      .then(function (r) {
        var issues = mapViolationsToIssues(r.violations || []);
        var summary = buildSummary(issues);
        callback(null, { id: id, url: window.location.href, issues: issues, summary: summary });
      })
      .catch(function (e) {
        callback(e && e.message ? e.message : 'Scan failed', null);
      });
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type !== 'RUN_SCAN') return;
    var tags = Array.isArray(msg.tags) ? msg.tags : ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
    var id = msg.id || 'scan_' + Date.now();
    runAxe(tags, id, function (err, payload) {
      if (err) {
        sendResponse({ error: err });
      } else {
        sendResponse(payload);
      }
    });
    return true;
  });
})();
