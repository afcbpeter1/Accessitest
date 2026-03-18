// Collect same-site links from the current page for the AccessScan extension.
// Returns a de-duplicated list of URLs with basic labels so the side panel
// can present them as checkboxes for multi-page scanning.
(function () {
  function getSameSiteLinks() {
    var links = [];
    var seen = new Set();
    var origin = window.location.origin;
    var anchors = document.querySelectorAll('a[href]');

    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

      var url;
      try {
        url = new URL(href, window.location.href);
      } catch (_) {
        continue;
      }

      if (url.origin !== origin) continue;
      if (!/^https?:$/.test(url.protocol)) continue;

      var finalUrl = url.href;
      if (seen.has(finalUrl)) continue;
      seen.add(finalUrl);

      var text = (a.textContent || '').trim().replace(/\s+/g, ' ');
      links.push({
        url: finalUrl,
        text: text || finalUrl
      });

      if (links.length >= 50) break;
    }

    return links;
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg && msg.type === 'GET_LINKS') {
      try {
        var links = getSameSiteLinks();
        sendResponse({ ok: true, links: links });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Failed to collect links' });
      }
      return true;
    }
    return undefined;
  });
})();

