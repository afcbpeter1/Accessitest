// Collect same-site links and in-page nav for multi-page scanning.
// URL steps: open href in the tab. Click steps: same tab, .click() in MAIN world (Blazor / SPA).
(function () {
  function cssEscape(id) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(id);
    return String(id).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  function buildSelector(el) {
    if (!(el && el.nodeType === 1)) return '';
    var idAttr = el.getAttribute('id');
    if (idAttr && idAttr.trim()) {
      try {
        var idSel = '#' + cssEscape(idAttr.trim());
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch (e) {}
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      var tag = node.nodeName.toLowerCase();
      var idx = 1;
      var sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName === node.nodeName) idx++;
      }
      parts.unshift(tag + ':nth-of-type(' + idx + ')');
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function hasInlineOnclick(a) {
    var oc = a.getAttribute('onclick');
    return !!(oc && String(oc).trim());
  }

  function isDummySpaAbsoluteUrl(absUrl) {
    try {
      var path = (new URL(absUrl).pathname || '').toLowerCase();
      return path.indexOf('does-not-exist') !== -1;
    } catch (e) {
      return false;
    }
  }

  function resolveSameSiteHttpUrl(a, origin) {
    var href = (a.getAttribute('href') || '').trim();
    if (!href || href.toLowerCase().indexOf('javascript:') === 0) return null;
    if (href === '#' || href === '') return null;
    try {
      var url = new URL(href, window.location.href);
      if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function shouldCollectAsClick(el, origin) {
    if (hasInlineOnclick(el)) return true;
    var abs = resolveSameSiteHttpUrl(el, origin);
    if (!abs) return false;
    return isDummySpaAbsoluteUrl(abs);
  }

  // Blazor/SPA nav often keeps href on the current page and changes view via JS routing.
  // If several anchors resolve to the same current-page URL, treat them as click steps.
  function normalizeUrlForCompare(absUrl) {
    try {
      var u = new URL(absUrl);
      var p = (u.pathname || '/').replace(/\/+$/, '') || '/';
      return u.origin + p + (u.search || '');
    } catch (e) {
      return absUrl;
    }
  }

  function shouldPreferClickForUrl(a, finalUrl, currentPageUrl, duplicateCounts) {
    if (!a || !finalUrl || !duplicateCounts) return false;
    var count = duplicateCounts[finalUrl] || 0;
    if (count < 2) return false;
    if (normalizeUrlForCompare(finalUrl) !== normalizeUrlForCompare(currentPageUrl)) return false;
    var txt = (a.textContent || '').trim();
    return !!txt;
  }

  function buildLegacyClickUrl(pageUrl, ordinal) {
    try {
      var u = new URL(pageUrl);
      u.hash = 'accessscan-click-' + ordinal;
      return u.href;
    } catch (e) {
      return String(pageUrl || window.location.href).split('#')[0] + '#accessscan-click-' + ordinal;
    }
  }

  function getSameSiteLinks() {
    var links = [];
    var seenUrl = new Set();
    var seenClick = new Set();
    var clickOrdinal = 0;
    var origin = window.location.origin;
    var currentPageUrl = window.location.href.split('#')[0];
    var max = 50;
    var forceClickSelectors = new Set();
    var duplicateUrlCounts = {};

    var withHref = document.querySelectorAll('a[href]');
    for (var pre = 0; pre < withHref.length; pre++) {
      var preA = withHref[pre];
      if (hasInlineOnclick(preA)) continue;
      var preUrl = resolveSameSiteHttpUrl(preA, origin);
      if (!preUrl || isDummySpaAbsoluteUrl(preUrl)) continue;
      duplicateUrlCounts[preUrl] = (duplicateUrlCounts[preUrl] || 0) + 1;
    }

    for (var i = 0; i < withHref.length; i++) {
      if (links.length >= max) break;
      var a = withHref[i];
      if (hasInlineOnclick(a)) continue;
      var href = (a.getAttribute('href') || '').trim();
      if (!href || href.toLowerCase().indexOf('javascript:') === 0) continue;
      if (href === '#' || href === '') continue;

      var url;
      try {
        url = new URL(href, window.location.href);
      } catch (_) {
        continue;
      }

      if (url.origin !== origin) continue;
      if (!/^https?:$/.test(url.protocol)) continue;

      var finalUrl = url.href;
      if (isDummySpaAbsoluteUrl(finalUrl)) continue;
      if (shouldPreferClickForUrl(a, finalUrl, currentPageUrl, duplicateUrlCounts)) {
        var clickSel = buildSelector(a);
        if (clickSel) forceClickSelectors.add(clickSel);
        continue;
      }
      if (seenUrl.has(finalUrl)) continue;
      seenUrl.add(finalUrl);

      var text = (a.textContent || '').trim().replace(/\s+/g, ' ');
      links.push({
        linkId: 'url:' + finalUrl,
        kind: 'url',
        url: finalUrl,
        text: text || finalUrl
      });
    }

    var allA = document.querySelectorAll('a');
    for (var j = 0; j < allA.length; j++) {
      if (links.length >= max) break;
      var el = allA[j];
      var sel = buildSelector(el);
      if (!sel) continue;
      if (!forceClickSelectors.has(sel) && !shouldCollectAsClick(el, origin)) continue;

      if (seenClick.has(sel)) continue;
      seenClick.add(sel);

      var t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      var ordinal = clickOrdinal++;
      links.push({
        linkId: 'click:' + ordinal + ':' + sel,
        kind: 'click',
        selector: sel,
        text: t || sel,
        pageUrl: window.location.href.split('#')[0],
        // Back-compat for older /extension UIs that only understand URL rows.
        // Sidepanel converts this hash marker back into a click target before scan.
        url: buildLegacyClickUrl(window.location.href.split('#')[0], ordinal)
      });
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
