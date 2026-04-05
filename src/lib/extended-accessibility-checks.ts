/**
 * Extended accessibility checks: simulated behavior + heuristics.
 * Detection only; remediation is handled by the scanner's AI (generateRemediationSuggestions).
 */

import type { AccessibilityIssue } from './accessibility-scanner';

const MAX_TAB_CYCLES = 60;
const FOCUS_TRAP_TAB_LIMIT = 50;
const READABILITY_GRADE_LEVEL_MAX = 12;
const ALT_MIN_LENGTH = 10;
const ALT_GENERIC = ['image', 'picture', 'photo', 'graphic', 'img', 'icon', 'placeholder'];
const ALT_REDUNDANT_PREFIX = ['image of', 'picture of', 'photo of', 'graphic of'];
const ERROR_TOO_SHORT_LEN = 4;
const ERROR_GENERIC_ONLY = ['invalid', 'error', 'required', 'incorrect', 'wrong'];

const DOCUMENT_TITLE_PLACEHOLDER = /^(untitled|loading|document|new tab|home|page|\.\.\.)$/i;

function emptyNode(html: string, target: string[], failureSummary: string, impact: string) {
  return {
    html,
    target,
    failureSummary,
    impact,
    any: [],
    all: [],
    none: []
  };
}

// WCAG 2.2 tags per extended rule for correct level display (A, AA, AAA)
const EXTENDED_RULE_TAGS: Record<string, string[]> = {
  'modal-focus-escape': ['wcag2a', 'wcag21a'],
  'modal-keyboard-trap': ['wcag2a', 'wcag21a'],
  'keyboard-focus-visible': ['wcag2aa', 'wcag21aa'],
  'keyboard-tabindex-order': ['wcag2a', 'wcag21a'],
  'error-message-clarity': ['wcag2a', 'wcag21a'],
  'alt-text-quality': ['wcag2a', 'wcag21a'],
  'content-readability': ['wcag2aaa', 'wcag22aaa'],
  'aria-hidden-content': ['wcag2a', 'wcag21a'],
  'aria-role-strips-semantics': ['wcag2a', 'wcag21a'],
  'landmark-wrong-role': ['wcag2aa', 'wcag21aa'],
  'landmark-multiple-no-name': ['wcag2aa', 'wcag21aa'],
  'form-structure': ['wcag2a', 'wcag21a'],
  'ad-container-accessibility': ['wcag2a', 'wcag21a'],
  'skip-link-missing': ['wcag2a', 'wcag21a'],
  'skip-link-broken': ['wcag2a', 'wcag21a'],
  'iframe-missing-title': ['wcag2a', 'wcag21a'],
  'duplicate-id': ['wcag2a', 'wcag21a'],
  'focusable-in-aria-hidden': ['wcag2a', 'wcag21a'],
  'form-group-no-fieldset': ['wcag2a', 'wcag21a'],
  'form-fieldset-no-legend': ['wcag2a', 'wcag21a'],
  'interactive-non-semantic': ['wcag2a', 'wcag21a'],
  'link-text-generic': ['wcag2a', 'wcag21a'],
  'button-accessible-name': ['wcag2a', 'wcag21a'],
  'document-title-quality': ['wcag2a', 'wcag21a'],
  'video-missing-captions': ['wcag2a', 'wcag21a', 'wcag22aa'],
  'target-blank-unsafe': ['wcag2a', 'wcag21a'],
  'autofocus-attribute': ['wcag2a', 'wcag21a'],
  'scrollable-region-keyboard': ['wcag2a', 'wcag21a'],
  'heading-structure-policy': ['wcag2a', 'wcag21a'],
  'table-missing-headers': ['wcag2a', 'wcag21a'],
  'landmark-aside-unnamed': ['wcag2aa', 'wcag21aa']
};

function toIssue(
  id: string,
  impact: 'critical' | 'serious' | 'moderate' | 'minor',
  description: string,
  help: string,
  html: string,
  selector: string,
  failureSummary: string
): AccessibilityIssue {
  const tags = EXTENDED_RULE_TAGS[id] || ['best-practice', 'wcag2a'];
  return {
    id,
    impact,
    tags,
    description,
    help,
    helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/',
    nodes: [{ ...emptyNode(html, [selector], failureSummary, impact) }]
  };
}

/**
 * Skip link (behavioural): first Tab stop should be a skip link; activating it should move focus to main content.
 * Runs before other keyboard checks so Tab order is untouched. Complements axe rule `skip-link` (DOM-only).
 */
export async function runSkipLinkBehaviourChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Tab');

    const first = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const text = (el.innerText || '').trim();
      const href = el.getAttribute('href') || '';
      const isSkip =
        /skip/i.test(text) ||
        /skip to/i.test(text) ||
        /skip/i.test(href) ||
        (href.startsWith('#') && /main|content|primary|article/i.test(href));
      return {
        tag: el.tagName.toLowerCase(),
        href,
        text: text.slice(0, 120),
        isSkip,
        isLink: el.tagName === 'A'
      };
    });

    if (!first) {
      issues.push(
        toIssue(
          'skip-link-missing',
          'serious',
          'Could not determine first keyboard focus (no element received focus after Tab).',
          'Ensure the page has a visible focus order starting with a skip link, or focusable content.',
          '',
          'body',
          'No focused element after first Tab.'
        )
      );
      return issues;
    }

    if (!first.isLink || !first.isSkip) {
      issues.push(
        toIssue(
          'skip-link-missing',
          'serious',
          'First focusable element is not a skip-to-content link.',
          'Add a "Skip to main content" link as the first focusable control (visually hidden until focused is OK). Link to #main or your main region id.',
          first.text || first.href,
          'body',
          'WCAG 2.4.1 Bypass Blocks — keyboard users should reach primary content quickly.'
        )
      );
      return issues;
    }

    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 150));

    const landedOnMain = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      if (el.tagName === 'MAIN' || el.getAttribute('role') === 'main') return true;
      const id = (el.id || '').toLowerCase();
      if (id === 'main' || id === 'content' || id === 'main-content') return true;
      const mainEl = document.querySelector('main, [role="main"]');
      return !!(mainEl && mainEl.contains(el));
    });

    if (!landedOnMain) {
      issues.push(
        toIssue(
          'skip-link-broken',
          'serious',
          'Skip link exists but activating it does not move focus to the primary content region.',
          'Point the href at an id on <main> or a wrapper; add tabindex="-1" on that target so focus moves (browser requirement for in-page links).',
          `<a href="${first.href}">`,
          first.href || 'a[href^="#"]',
          'Enter on skip link did not land focus inside main content.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (skip link behaviour) failed:', err);
  }

  return issues;
}

/** Iframes: require a non-generic title (axe flags frame-title; this catches empty/generic). */
export async function runIframeTitleChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const GENERIC = new Set([
        'advertisement',
        'banner',
        'frame',
        'iframe',
        'untitled',
        '',
        'ad',
        'sponsor'
      ]);
      return Array.from(document.querySelectorAll('iframe')).map((el) => {
        const title = (el.getAttribute('title') || '').trim().toLowerCase();
        const bad = !title || GENERIC.has(title);
        if (!bad) return null;
        const html = (el as HTMLElement).outerHTML.substring(0, 200);
        const sel = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : 'iframe';
        return { html, sel, title: el.getAttribute('title') };
      }).filter(Boolean) as Array<{ html: string; sel: string; title: string | null }>;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'iframe-missing-title',
          'serious',
          `iframe has no meaningful title attribute (current: ${f.title === null || f.title === '' ? 'missing' : `"${f.title}"`}).`,
          'Add title="…" describing the embedded content (e.g. the ad or widget purpose) so screen readers can identify the frame.',
          f.html,
          f.sel,
          'iframe needs a descriptive title for screen reader users.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (iframe titles) failed:', err);
  }

  return issues;
}

export async function runDuplicateIdChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const dupes = await page.evaluate(() => {
      const counts: Record<string, number> = {};
      document.querySelectorAll('[id]').forEach((el) => {
        const id = (el as HTMLElement).id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      return Object.entries(counts)
        .filter(([, n]) => n > 1)
        .map(([id, count]) => ({ id, count }));
    });

    for (const { id, count } of dupes.slice(0, 20)) {
      issues.push(
        toIssue(
          'duplicate-id',
          'serious',
          `ID "${id}" appears ${count} times on this page.`,
          'IDs must be unique. Duplicates break aria-labelledby, aria-describedby, and in-page links.',
          '',
          `[id="${id}"]`,
          `Duplicate id="${id}" breaks accessibility APIs.`
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (duplicate id) failed:', err);
  }

  return issues;
}

export async function runFocusableInAriaHiddenChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const focusable =
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('[aria-hidden="true"]').forEach((container) => {
        container.querySelectorAll(focusable).forEach((el) => {
          const t = parseInt((el as HTMLElement).getAttribute('tabindex') || '0', 10);
          if (t < 0) return;
          const e = el as HTMLElement;
          out.push({
            html: e.outerHTML.substring(0, 200),
            sel: e.id ? `#${e.id}` : e.tagName.toLowerCase()
          });
        });
      });
      return out.slice(0, 15);
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'focusable-in-aria-hidden',
          'critical',
          'Focusable element is inside aria-hidden="true" (hidden from AT but still in tab order).',
          'Remove aria-hidden from the ancestor, hide content differently, or use tabindex="-1" on children and remove from tab order.',
          f.html,
          f.sel,
          'WCAG 4.1.2 — focusable content must not be exposed inconsistently.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (focusable in aria-hidden) failed:', err);
  }

  return issues;
}

export async function runRadioCheckboxFieldsetChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      type Row = { name: string; type: 'fieldset' | 'legend'; html: string; sel: string; summary: string };
      const out: Row[] = [];
      const groups: Record<string, HTMLInputElement[]> = {};
      document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((el) => {
        const input = el as HTMLInputElement;
        const name = input.getAttribute('name') || '__unnamed__';
        if (!groups[name]) groups[name] = [];
        groups[name].push(input);
      });

      Object.entries(groups).forEach(([name, els]) => {
        if (els.length <= 1) return;
        const fieldset = els[0].closest('fieldset');
        if (!fieldset) {
          out.push({
            name,
            type: 'fieldset',
            html: els[0].outerHTML.substring(0, 120),
            sel: els[0].id ? `#${els[0].id}` : `input[name="${name}"]`,
            summary: `Grouped inputs "${name}" are not wrapped in a fieldset.`
          });
          return;
        }
        if (!fieldset.querySelector('legend')) {
          out.push({
            name,
            type: 'legend',
            html: fieldset.outerHTML.substring(0, 200),
            sel: fieldset.id ? `#${fieldset.id}` : 'fieldset',
            summary: `Fieldset for group "${name}" has no legend.`
          });
        }
      });
      return out;
    });

    for (const f of findings) {
      if (f.type === 'fieldset') {
        issues.push(
          toIssue(
            'form-group-no-fieldset',
            'serious',
            f.summary,
            'Wrap related radio or checkbox inputs in <fieldset><legend>Group label</legend>...</fieldset>.',
            f.html,
            f.sel,
            'Groups of radios/checkboxes need a programmatic group label.'
          )
        );
      } else {
        issues.push(
          toIssue(
            'form-fieldset-no-legend',
            'serious',
            f.summary,
            'Add <legend> as the first child of <fieldset> describing the group.',
            f.html,
            f.sel,
            'Fieldset requires a legend for the group accessible name.'
          )
        );
      }
    }
  } catch (err) {
    console.warn('Extended check (fieldset groups) failed:', err);
  }

  return issues;
}

export async function runInteractiveNonSemanticChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('div[onclick], span[onclick]').forEach((el) => {
        const role = el.getAttribute('role');
        const tabindex = el.getAttribute('tabindex');
        if (!role || !tabindex) {
          const e = el as HTMLElement;
          out.push({
            html: e.outerHTML.substring(0, 200),
            sel: e.id ? `#${e.id}` : e.tagName.toLowerCase()
          });
        }
      });
      return out.slice(0, 10);
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'interactive-non-semantic',
          'serious',
          'Clickable div/span uses onclick without full keyboard semantics (role + tabindex + handlers).',
          'Prefer <button> or <a>; if you must use a div, add role="button", tabindex="0", and Enter/Space handlers.',
          f.html,
          f.sel,
          'Native buttons and links are keyboard accessible by default.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (interactive non-semantic) failed:', err);
  }

  return issues;
}

/**
 * 1. Modal focus trap: find visible dialogs, ensure focus stays in modal and Escape closes it.
 */
export async function runFocusTrapChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const dialogs = await page.$$('[role="dialog"][aria-modal="true"], [aria-modal="true"]');
    for (let i = 0; i < dialogs.length; i++) {
      const dialog = dialogs[i];
      const isVisible = await dialog.evaluate((el: Element) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      if (!isVisible) continue;

      const dialogInfo = await dialog.evaluate((el: Element) => {
        const d = el as HTMLElement;
        return {
          html: d.outerHTML.substring(0, 500),
          hasId: !!d.id
        };
      });
      const dialogSelectorForReport = await dialog.evaluate((el: Element) => (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '[role="dialog"]');

      try {
        const first = await dialog.$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (first) await first.focus();
        else await dialog.evaluate((el: Element) => (el as HTMLElement).focus());
      } catch (_) {
        // focus might fail if element not focusable
      }

      let focusLeftDialog = false;
      for (let tabCount = 0; tabCount < FOCUS_TRAP_TAB_LIMIT; tabCount++) {
        await page.keyboard.press('Tab');
        const stillInDialog = await dialog.evaluate((el: Element) => {
          const active = document.activeElement;
          return active && (el as HTMLElement).contains(active);
        });
        if (!stillInDialog) {
          focusLeftDialog = true;
          break;
        }
      }

      if (focusLeftDialog) {
        issues.push(toIssue(
          'modal-focus-escape',
          'serious',
          'Modal dialog: focus can escape outside the dialog when using Tab (focus should be trapped inside until closed).',
          'Trap focus inside the modal so keyboard users cannot Tab out. Provide a visible way to close (e.g. Escape or Close button).',
          dialogInfo.html,
          typeof dialogSelectorForReport === 'string' ? dialogSelectorForReport : '[role="dialog"]',
          'Focus escaped the modal when pressing Tab; focus should remain inside the dialog until the user closes it.'
        ));
        continue;
      }

      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 200));

      const closedOrFocusReturned = await dialog.evaluate((el: Element) => {
        const style = window.getComputedStyle(el);
        const hidden = style.display === 'none' || style.visibility === 'hidden' || (el.getAttribute('aria-hidden') === 'true');
        if (hidden) return true;
        const active = document.activeElement;
        return active && !(el as HTMLElement).contains(active);
      });

      if (!closedOrFocusReturned) {
        issues.push(toIssue(
          'modal-keyboard-trap',
          'critical',
          'Modal dialog: no way to exit with keyboard (keyboard trap). Escape does not close the dialog and focus cannot leave with Tab.',
          'Ensure Escape closes the modal and returns focus to the trigger, or provide a focusable Close button that receives focus and closes the dialog.',
          dialogInfo.html,
          typeof dialogSelectorForReport === 'string' ? dialogSelectorForReport : '[role="dialog"]',
          'User cannot leave the modal using Tab or Escape (WCAG 2.1.2 No Keyboard Trap).'
        ));
      }
    }
  } catch (err) {
    console.warn('Extended check (focus trap) failed:', err);
  }

  return issues;
}

/**
 * 2. Keyboard nav quality: tab order, focus visibility, reachability.
 */
export async function runKeyboardNavChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const data = await page.evaluate(() => {
      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });

      const withSelectors = focusables.map((el, i) => {
        const id = el.id ? `#${el.id}` : '';
        const sel = id || (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).join('.') : ''));
        return { selector: sel || `[tabindex="${el.tabIndex}"]`, tabIndex: el.tabIndex, tagName: el.tagName, html: el.outerHTML.substring(0, 300) };
      });

      return { focusables: withSelectors, total: withSelectors.length };
    });

    if (data.total === 0) return issues;

    const tabOrder: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(data.total * 2 + 5, MAX_TAB_CYCLES); i++) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el || el === document.body) return null;
        const id = el.id ? `#${el.id}` : '';
        const sel = id || el.tagName.toLowerCase();
        const outline = window.getComputedStyle(el).outline;
        const outlineWidth = window.getComputedStyle(el).outlineWidth;
        const boxShadow = window.getComputedStyle(el).boxShadow;
        const hasVisibleFocus = outline !== 'none' && outlineWidth !== '0px' && outlineWidth !== '0' ||
          (boxShadow !== 'none' && boxShadow !== 'rgba(0, 0, 0, 0)');
        return { selector: sel, hasVisibleFocus, tagName: el.tagName, html: el.outerHTML.substring(0, 300) };
      });
      if (!active) break;
      const key = active.selector + active.html?.substring(0, 50);
      if (seen.has(key)) break;
      seen.add(key);
      tabOrder.push(active.selector);
      if (!active.hasVisibleFocus) {
        const existing = issues.find(i => i.id === 'keyboard-focus-visible' && i.nodes?.[0]?.target?.[0] === active.selector);
        if (!existing) {
          issues.push(toIssue(
            'keyboard-focus-visible',
            'serious',
            `Element in tab order has no visible focus indicator: ${active.selector}`,
            'Ensure focused elements have a visible focus ring (e.g. outline or box-shadow) so keyboard users can see where focus is.',
            active.html || '',
            active.selector,
            'No visible focus style (outline/box-shadow) when this element is focused.'
          ));
        }
      }
    }

    const tabindexPositive = await page.evaluate(() => {
      const bad = Array.from(document.querySelectorAll<HTMLElement>('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).filter(el => {
        const n = parseInt(el.getAttribute('tabindex') || '0', 10);
        return n > 0;
      });
      return bad.map(el => ({
        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
        tabindex: el.getAttribute('tabindex'),
        html: el.outerHTML.substring(0, 300)
      }));
    });

    for (const el of tabindexPositive.slice(0, 3)) {
      issues.push(toIssue(
        'keyboard-tabindex-order',
        'moderate',
        `tabindex="${el.tabindex}" creates a non-linear tab order. Prefer natural DOM order.`,
        'Avoid tabindex greater than 0; use DOM order and skip links instead.',
        el.html,
        el.selector,
        'Positive tabindex can break predictable keyboard order (WCAG 2.4.3).'
      ));
    }
  } catch (err) {
    console.warn('Extended check (keyboard nav) failed:', err);
  }

  return issues;
}

/**
 * 3. Error message clarity: heuristics on form error text.
 */
export async function runErrorMessageClarityChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const formData = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.slice(0, 5).map(form => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea')).map((field: Element) => {
          const f = field as HTMLElement;
          const id = f.id;
          const describedBy = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
          const errorTexts: string[] = [];
          describedBy.forEach(descId => {
            const el = document.getElementById(descId);
            if (el && (el.getAttribute('role') === 'alert' || /error|invalid|required/i.test(el.className + ' ' + (el.getAttribute('aria-live') || '')))) {
              errorTexts.push((el.textContent || '').trim());
            }
          });
          const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
          return { id, label, errorTexts, html: f.outerHTML.substring(0, 250) };
        });
        return { fields: fields.filter(f => f.errorTexts.length > 0), formHtml: form.outerHTML.substring(0, 400) };
      });
    });

    for (const form of formData) {
      for (const field of form.fields) {
        for (const text of field.errorTexts) {
          if (text.length <= ERROR_TOO_SHORT_LEN) {
            issues.push(toIssue(
              'error-message-clarity',
              'moderate',
              `Form error message is too short or empty: "${text}"`,
              'Provide clear, specific error messages that identify the field and what went wrong (WCAG 3.3.1).',
              field.html,
              field.id ? `#${field.id}` : 'input',
              `Error message "${text}" is too short to be helpful.`
            ));
            continue;
          }
          const lower = text.toLowerCase().trim();
          const isGenericOnly = ERROR_GENERIC_ONLY.some(g => lower === g || lower.replace(/[^\w]/g, '') === g);
          if (isGenericOnly) {
            issues.push(toIssue(
              'error-message-clarity',
              'moderate',
              `Form error message is too generic: "${text}"`,
              'Use specific error text that names the field and explains how to fix (e.g. "Email must be a valid address").',
              field.html,
              field.id ? `#${field.id}` : 'input',
              `Generic error "${text}" does not help users fix the problem.`
            ));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Extended check (error message clarity) failed:', err);
  }

  return issues;
}

/**
 * 4. Alt text quality: present but too short or generic.
 */
export async function runAltTextQualityChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLImageElement>('img[alt]')).map(img => ({
        alt: (img.getAttribute('alt') || '').trim(),
        src: img.getAttribute('src') || '',
        id: img.id ? `#${img.id}` : '',
        html: img.outerHTML.substring(0, 350)
      }));
    });

    for (const img of images) {
      if (!img.alt) continue;
      const selector = img.id || 'img[alt]';
      if (img.alt.length < ALT_MIN_LENGTH) {
        issues.push(toIssue(
          'alt-text-quality',
          'moderate',
          `Alt text is very short (${img.alt.length} chars): "${img.alt}"`,
          'Use descriptive alternative text that conveys the same information as the image.',
          img.html,
          selector,
          `Alt text "${img.alt}" is likely too short to be descriptive.`
        ));
        continue;
      }
      const lower = img.alt.toLowerCase();
      if (ALT_GENERIC.some(g => lower === g || lower.replace(/[^\w]/g, '') === g)) {
        issues.push(toIssue(
          'alt-text-quality',
          'serious',
          `Alt text is generic: "${img.alt}"`,
          'Replace with a description of the image content or purpose.',
          img.html,
          selector,
          `Generic alt "${img.alt}" does not describe the image.`
        ));
        continue;
      }
      if (ALT_REDUNDANT_PREFIX.some(p => lower.startsWith(p))) {
        issues.push(toIssue(
          'alt-text-quality',
          'minor',
          `Alt text starts with redundant phrase: "${img.alt}"`,
          'Avoid "image of" / "picture of"; screen readers already announce it as an image.',
          img.html,
          selector,
          `Redundant prefix in "${img.alt}".`
        ));
      }
    }
  } catch (err) {
    console.warn('Extended check (alt text quality) failed:', err);
  }

  return issues;
}

/**
 * 6. ARIA hiding or stripping semantic content (headings/paragraphs not read by screen readers).
 * Catches: aria-hidden on containers with main content; role=presentation/none on article, section, h1-h6, p.
 */
export async function runAriaSemanticContentChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ type: string; selector: string; html: string; summary: string }> = [];

      // (1) Containers with aria-hidden="true" that contain semantic content (headings, paragraphs, article)
      const hiddenContainers = document.querySelectorAll('[aria-hidden="true"]');
      hiddenContainers.forEach((el) => {
        const container = el as HTMLElement;
        if (container === document.body) return; // axe already flags aria-hidden on body
        const hasHeading = container.querySelector('h1, h2, h3, h4, h5, h6');
        const hasParagraph = container.querySelector('p');
        const hasArticle = container.querySelector('article') || (container.tagName === 'ARTICLE');
        const hasSection = container.querySelector('section') || (container.tagName === 'SECTION');
        if (hasHeading || hasParagraph || hasArticle || hasSection) {
          const sel = container.id ? `#${container.id}` : container.tagName.toLowerCase();
          out.push({
            type: 'aria-hidden-content',
            selector: sel,
            html: container.outerHTML.substring(0, 500),
            summary: 'Content with headings, paragraphs, or article/section is inside an aria-hidden container and will not be read by screen readers.'
          });
        }
      });

      // (2) Semantic elements with role="presentation" or role="none" (strips semantics)
      const semanticSelectors = 'article, section, h1, h2, h3, h4, h5, h6, p';
      document.querySelectorAll(semanticSelectors).forEach((el) => {
        const role = (el as HTMLElement).getAttribute('role');
        if (role === 'presentation' || role === 'none') {
          const sel = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : el.tagName.toLowerCase();
          out.push({
            type: 'aria-role-strips-semantics',
            selector: sel,
            html: (el as HTMLElement).outerHTML.substring(0, 400),
            summary: `${el.tagName} has role="${role}" which removes it from the accessibility tree; screen readers may not announce it as a heading/paragraph/article.`
          });
        }
      });

      return out;
    });

    for (const f of findings) {
      issues.push(toIssue(
        f.type === 'aria-hidden-content' ? 'aria-hidden-content' : 'aria-role-strips-semantics',
        'critical',
        f.type === 'aria-hidden-content'
          ? 'Main content is hidden from screen readers (aria-hidden on container with headings/paragraphs).'
          : 'Semantic element has role="presentation" or role="none" so it is not announced correctly.',
        f.type === 'aria-hidden-content'
          ? 'Remove aria-hidden from containers that hold main content, or move content out. Only hide decorative or duplicated content from screen readers.'
          : 'Remove role="presentation" or role="none" from article, section, headings, and paragraphs so screen readers can announce structure.',
        f.html,
        f.selector,
        f.summary
      ));
    }
  } catch (err) {
    console.warn('Extended check (ARIA semantic content) failed:', err);
  }

  return issues;
}

/**
 * 7. Landmark correctness (rules only): wrong role for element, multiple same landmark without names.
 */
export async function runLandmarkCorrectnessChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ id: string; selector: string; html: string; summary: string }> = [];
      const landmarkSelectors = 'nav, main, aside, header, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"]';
      const elements = document.querySelectorAll(landmarkSelectors);

      elements.forEach((el) => {
        const tag = (el as HTMLElement).tagName.toLowerCase();
        const role = (el as HTMLElement).getAttribute('role') || (tag === 'nav' ? 'navigation' : tag === 'main' ? 'main' : tag === 'aside' ? 'complementary' : tag === 'header' ? 'banner' : tag === 'footer' ? 'contentinfo' : null);
        const name = (el as HTMLElement).getAttribute('aria-label') || (el as HTMLElement).getAttribute('aria-labelledby') || '';

        if (role === 'main' && (tag === 'nav' || tag === 'aside' || tag === 'header' || tag === 'footer')) {
          out.push({ id: 'landmark-wrong-role', selector: (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : tag, html: (el as HTMLElement).outerHTML.substring(0, 400), summary: `${tag} has role="main"; main content should use <main> or a container with role="main", not ${tag}.` });
        }
        if (role === 'navigation' && (tag === 'main' || tag === 'aside')) {
          out.push({ id: 'landmark-wrong-role', selector: (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : tag, html: (el as HTMLElement).outerHTML.substring(0, 400), summary: `${tag} has role="navigation"; use <nav> for navigation.` });
        }
      });

      const navs = Array.from(document.querySelectorAll('nav, [role="navigation"]'));
      if (navs.length > 1) {
        navs.forEach((nav, i) => {
          const hasName = (nav as HTMLElement).getAttribute('aria-label') || (nav as HTMLElement).getAttribute('aria-labelledby');
          if (!hasName) {
            out.push({ id: 'landmark-multiple-no-name', selector: (nav as HTMLElement).id ? `#${(nav as HTMLElement).id}` : `nav:nth-of-type(${i + 1})`, html: (nav as HTMLElement).outerHTML.substring(0, 400), summary: 'Multiple navigation landmarks present; this one has no accessible name (aria-label or aria-labelledby).' });
          }
        });
      }

      return out;
    });

    for (const f of findings) {
      issues.push(toIssue(
        f.id,
        f.id === 'landmark-wrong-role' ? 'serious' : 'moderate',
        f.id === 'landmark-wrong-role' ? 'Landmark role does not match element (e.g. role="main" on nav).' : 'Multiple landmarks of same type; one or more need an accessible name.',
        f.id === 'landmark-wrong-role' ? 'Use semantic elements that match the role (e.g. <main> for main, <nav> for navigation).' : 'Add aria-label or aria-labelledby to distinguish multiple nav/region landmarks.',
        f.html,
        f.selector,
        f.summary
      ));
    }
  } catch (err) {
    console.warn('Extended check (landmark correctness) failed:', err);
  }

  return issues;
}

/**
 * 8. Form structure (rules only): form contains div/span with form-like roles instead of native elements.
 */
export async function runFormStructureChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ selector: string; html: string; summary: string }> = [];
      document.querySelectorAll('form').forEach((form) => {
        const formEl = form as HTMLElement;
        const bad = formEl.querySelectorAll('div[role="textbox"], div[role="button"], div[role="combobox"], span[role="textbox"], span[role="button"], [contenteditable="true"]:not(textarea), div[role="listbox"], div[role="option"]');
        bad.forEach((el) => {
          const e = el as HTMLElement;
          const role = e.getAttribute('role');
          const sel = e.id ? `#${e.id}` : e.tagName.toLowerCase();
          out.push({ selector: sel, html: e.outerHTML.substring(0, 350), summary: `Form contains ${e.tagName} with role="${role}" instead of native <input>, <select>, <textarea>, or <button>.` });
        });
        const focusableDivs = formEl.querySelectorAll('div[tabindex="0"], div[tabindex], span[tabindex="0"], span[tabindex]');
        focusableDivs.forEach((el) => {
          const e = el as HTMLElement;
          if (e.getAttribute('role') === 'textbox' || e.getAttribute('role') === 'button' || e.getAttribute('contenteditable') === 'true') return;
          const sel = e.id ? `#${e.id}` : e.tagName.toLowerCase();
          out.push({ selector: sel, html: e.outerHTML.substring(0, 350), summary: 'Form contains focusable div/span that may be acting as a control; use native form elements.' });
        });
      });
      return out.slice(0, 10);
    });

    for (const f of findings) {
      issues.push(toIssue(
        'form-structure',
        'serious',
        'Form uses non-semantic elements (div/span) instead of native form controls.',
        'Use <input>, <select>, <textarea>, and <button> so keyboard and screen readers work correctly.',
        f.html,
        f.selector,
        f.summary
      ));
    }
  } catch (err) {
    console.warn('Extended check (form structure) failed:', err);
  }

  return issues;
}

/**
 * 9. Ad-like container accessibility (rules only): containers with ad-like class/id, check images have alt, links have text.
 */
export async function runAdContainerAccessibilityChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ selector: string; html: string; summary: string }> = [];
      const adPatterns = '[class*="ad-"],[class*="advertisement"],[class*="sponsor"],[id*="ad-"],[id*="advertisement"],[id*="sponsor"],[data-ad],[data-advertisement]';
      const containers = document.querySelectorAll(adPatterns);
      containers.forEach((container) => {
        const c = container as HTMLElement;
        const imgs = c.querySelectorAll('img');
        imgs.forEach((img) => {
          const alt = img.getAttribute('alt');
          if (alt === null || (alt && alt.trim() === '')) {
            const sel = img.id ? `#${img.id}` : 'img';
            out.push({ selector: sel, html: img.outerHTML.substring(0, 300), summary: 'Image in ad-like container has no or empty alt text.' });
          }
        });
        const links = c.querySelectorAll('a[href]');
        links.forEach((a) => {
          const text = (a.textContent || '').trim();
          if (text.length < 2 || /^(click here|here|link|ad|more)$/i.test(text)) {
            const sel = a.id ? `#${a.id}` : 'a';
            out.push({ selector: sel, html: (a as HTMLElement).outerHTML.substring(0, 300), summary: 'Link in ad-like container has no or generic link text.' });
          }
        });
      });
      return out.slice(0, 15);
    });

    for (const f of findings) {
      issues.push(toIssue(
        'ad-container-accessibility',
        'moderate',
        'Ad or sponsor container has images without alt or links without descriptive text.',
        'Add descriptive alt text to images and descriptive link text (not "click here" or "ad").',
        f.html,
        f.selector,
        f.summary
      ));
    }
  } catch (err) {
    console.warn('Extended check (ad container accessibility) failed:', err);
  }

  return issues;
}

/**
 * 5. Content readability: simple grade-level style metric on main text.
 */
function simpleGradeLevel(text: string): number {
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words = (text.trim().split(/\s+/).filter(Boolean).length) || 1;
  const syllables = text.toLowerCase().split(/\s+/).reduce((acc, word) => {
    const v = word.replace(/[^aeiouy]/g, '').length;
    return acc + (v <= 2 ? 1 : Math.min(v, 3));
  }, 0);
  const avgSyllablesPerWord = syllables / words;
  const avgWordsPerSentence = words / sentences;
  return 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
}

export async function runContentReadabilityChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const blocks = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"], article') || document.body;
      const paragraphs = Array.from(main.querySelectorAll('p')).slice(0, 30);
      return paragraphs.map((p, i) => {
        const text = (p.textContent || '').trim();
        if (text.length < 80) return null;
        const id = p.id ? `#${p.id}` : `p:nth-of-type(${i + 1})`;
        return { text, selector: id, html: (p as HTMLElement).outerHTML.substring(0, 400) };
      }).filter(Boolean);
    });

    for (const block of blocks) {
      if (!block) continue;
      const grade = simpleGradeLevel(block.text);
      if (grade > READABILITY_GRADE_LEVEL_MAX) {
        issues.push(toIssue(
          'content-readability',
          'minor',
          `Paragraph may be hard to read (estimated grade level ${grade.toFixed(1)}). Consider simplifying.`,
          'Use shorter sentences and simpler words where possible (helps users with cognitive and language needs).',
          block.html,
          block.selector,
          `Readability grade level ${grade.toFixed(1)} exceeds recommended ${READABILITY_GRADE_LEVEL_MAX}.`
        ));
      }
    }
  } catch (err) {
    console.warn('Extended check (content readability) failed:', err);
  }

  return issues;
}

/** Sitewide link text: empty, generic, or non-descriptive (complements axe `link-name` and ad-container checks). */
export async function runGlobalLinkTextChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const GENERIC_LINK =
        /^(click here|here|read more|more|link|ad|continue|details|learn more)$/i;

      function effectiveLinkName(a: HTMLAnchorElement): string {
        const aria = (a.getAttribute('aria-label') || '').trim();
        if (aria) return aria;
        const lb = a.getAttribute('aria-labelledby');
        if (lb) {
          const text = lb
            .split(/\s+/)
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((el) => (el!.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
          if (text) return text;
        }
        let text = (a.textContent || '').trim();
        const img = a.querySelector('img');
        if (img) {
          const alt = (img.getAttribute('alt') || '').trim();
          if (alt && (!text || text.length < 2)) return alt;
        }
        return text;
      }

      const out: Array<{ html: string; sel: string; name: string; reason: string }> = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        if (out.length >= 25) return;
        const href = (a.getAttribute('href') || '').trim();
        if (/^javascript:/i.test(href)) return;
        const name = effectiveLinkName(a);
        const lower = name.toLowerCase();
        if (!name || name.length < 2) {
          out.push({
            html: a.outerHTML.substring(0, 320),
            sel: a.id ? `#${a.id}` : 'a[href]',
            name: name || '(empty)',
            reason: 'empty'
          });
          return;
        }
        if (GENERIC_LINK.test(lower.replace(/[.…]+$/g, '').trim())) {
          out.push({
            html: a.outerHTML.substring(0, 320),
            sel: a.id ? `#${a.id}` : 'a[href]',
            name,
            reason: 'generic'
          });
        }
      });
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'link-text-generic',
          f.reason === 'empty' ? 'serious' : 'moderate',
          f.reason === 'empty'
            ? `Link has no discernible name: "${f.name}".`
            : `Link text is not descriptive: "${f.name}".`,
          'Use visible text or aria-label that describes the destination; avoid "click here", "read more", or empty links (WCAG 2.4.4).',
          f.html,
          f.sel,
          f.reason === 'empty' ? 'Link has no accessible name.' : 'Generic or non-descriptive link text.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (global link text) failed:', err);
  }

  return issues;
}

/** Buttons and role=button without an accessible name (complements axe `button-name`). */
export async function runUnlabeledButtonChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      function nameFor(el: Element): string {
        const aria = (el.getAttribute('aria-label') || '').trim();
        if (aria) return aria;
        const lb = el.getAttribute('aria-labelledby');
        if (lb) {
          const text = lb
            .split(/\s+/)
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((e) => (e!.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
          if (text) return text;
        }
        const tag = el.tagName.toLowerCase();
        if (tag === 'input') {
          const t = (el as HTMLInputElement).type;
          if (t === 'submit' || t === 'button' || t === 'reset') {
            return ((el as HTMLInputElement).value || '').trim();
          }
        }
        if (tag === 'button') {
          let text = (el.textContent || '').trim();
          const img = el.querySelector('img[alt]');
          if (img) {
            const alt = (img.getAttribute('alt') || '').trim();
            if (alt && (!text || text.length < 2)) return alt;
          }
          return text;
        }
        if ((el as HTMLElement).getAttribute('role') === 'button') {
          let text = (el.textContent || '').trim();
          const img = el.querySelector('img[alt]');
          if (img) {
            const alt = (img.getAttribute('alt') || '').trim();
            if (alt && (!text || text.length < 2)) return alt;
          }
          return text;
        }
        return '';
      }

      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('button:not([disabled]), [role="button"]:not([aria-disabled="true"])').forEach((el) => {
        if (out.length >= 20) return;
        if (nameFor(el)) return;
        const e = el as HTMLElement;
        out.push({
          html: e.outerHTML.substring(0, 320),
          sel: e.id ? `#${e.id}` : e.tagName.toLowerCase()
        });
      });
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'button-accessible-name',
          'serious',
          'Button has no accessible name (visible text, aria-label, aria-labelledby, or img alt).',
          'Add visible text, aria-label, or aria-labelledby so assistive technologies can announce the control (WCAG 4.1.2).',
          f.html,
          f.sel,
          'Interactive button has no accessible name.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (button accessible name) failed:', err);
  }

  return issues;
}

export async function runDocumentTitleChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const title = (await page.title()).trim();
    if (!title) {
      issues.push(
        toIssue(
          'document-title-quality',
          'serious',
          'Document has no <title> or title is empty.',
          'Set a unique, descriptive <title> in the document head (WCAG 2.4.2).',
          '',
          'title',
          'Missing page title.'
        )
      );
      return issues;
    }
    if (title.length < 4) {
      issues.push(
        toIssue(
          'document-title-quality',
          'moderate',
          `Page title is very short (${title.length} characters): "${title}".`,
          'Use a title that describes the page purpose and site context.',
          '',
          'title',
          'Title may be too short to be descriptive.'
        )
      );
    } else if (DOCUMENT_TITLE_PLACEHOLDER.test(title)) {
      issues.push(
        toIssue(
          'document-title-quality',
          'serious',
          `Page title looks like a placeholder: "${title}".`,
          'Replace with a real title that describes the page (WCAG 2.4.2).',
          '',
          'title',
          'Placeholder or generic document title.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (document title) failed:', err);
  }

  return issues;
}

export async function runVideoCaptionChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('video').forEach((v, i) => {
        const el = v as HTMLVideoElement;
        let hasTextTrack = false;
        el.querySelectorAll('track').forEach((t) => {
          const k = (t.getAttribute('kind') || '').toLowerCase();
          if (k === 'captions' || k === 'subtitles') hasTextTrack = true;
        });
        if (hasTextTrack) return;
        const sel = el.id ? `#${el.id}` : `video:nth-of-type(${i + 1})`;
        out.push({ html: el.outerHTML.substring(0, 400), sel });
      });
      return out.slice(0, 10);
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'video-missing-captions',
          'serious',
          'Video has no captions or subtitles track.',
          'Add <track kind="captions"> or provide a described alternative; prerecorded video needs captions for WCAG 1.2.2.',
          f.html,
          f.sel,
          'No captions/subtitles track on video element.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (video captions) failed:', err);
  }

  return issues;
}

export async function runTargetBlankNoopenerChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('a[target="_blank"], a[target="_blank" i]').forEach((a) => {
        if (out.length >= 25) return;
        const rel = (a.getAttribute('rel') || '').toLowerCase();
        const hasNoopener = /\bnoopener\b/.test(rel) || /\bnoreferrer\b/.test(rel);
        if (hasNoopener) return;
        const e = a as HTMLElement;
        out.push({
          html: e.outerHTML.substring(0, 320),
          sel: e.id ? `#${e.id}` : 'a[target="_blank"]'
        });
      });
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'target-blank-unsafe',
          'moderate',
          'Link opens in a new tab but omits rel="noopener" (or noreferrer).',
          'Add rel="noopener noreferrer" to avoid tab-nabbing and improve predictable behaviour (WCAG 3.2.5 related best practice).',
          f.html,
          f.sel,
          'target="_blank" without noopener/noreferrer.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (target blank) failed:', err);
  }

  return issues;
}

export async function runAutofocusChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('[autofocus]').forEach((el) => {
        if (out.length >= 15) return;
        const e = el as HTMLElement;
        out.push({
          html: e.outerHTML.substring(0, 320),
          sel: e.id ? `#${e.id}` : e.tagName.toLowerCase()
        });
      });
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'autofocus-attribute',
          'moderate',
          'Element uses the autofocus attribute, which can disorient keyboard and screen reader users.',
          'Avoid autofocus on page load; let users reach the first field in natural order or use a skip link.',
          f.html,
          f.sel,
          'autofocus may skip navigation context.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (autofocus) failed:', err);
  }

  return issues;
}

/** Scrollable overflow regions with no keyboard path (no tabindex=0 on container and no focusable descendants). */
export async function runScrollableRegionKeyboardChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const focusableSel =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const out: Array<{ html: string; sel: string }> = [];
      const candidates = document.querySelectorAll(
        'main, [role="main"], article, section, aside, nav, div, form'
      );
      candidates.forEach((el) => {
        if (out.length >= 20) return;
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        const ox = style.overflowX;
        const scrollable =
          oy === 'auto' || oy === 'scroll' || ox === 'auto' || ox === 'scroll';
        if (!scrollable) return;
        const h = el as HTMLElement;
        if (h.scrollHeight <= h.clientHeight + 2 && h.scrollWidth <= h.clientWidth + 2) return;
        if (h.getAttribute('tabindex') === '0') return;
        if (h.querySelector(focusableSel)) return;
        const sel = h.id ? `#${h.id}` : h.tagName.toLowerCase();
        out.push({ html: h.outerHTML.substring(0, 400), sel });
      });
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'scrollable-region-keyboard',
          'moderate',
          'Scrollable region has no keyboard focus path (no focusable content inside and container is not tabindex="0").',
          'Add focusable controls inside the region or tabindex="0" on the scroll container so keyboard users can scroll (WCAG 2.1.1).',
          f.html,
          f.sel,
          'Keyboard users may not be able to scroll this region.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (scrollable region) failed:', err);
  }

  return issues;
}

/** Policy: one h1 in main; prefer an h1 when headings exist (best practice; overlaps with heading-order in spirit). */
export async function runHeadingStructurePolicyChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ kind: 'multi' | 'none'; html: string; sel: string; summary: string }> = [];
      const main = document.querySelector('main, [role="main"]') || document.body;
      const h1s = main.querySelectorAll('h1');
      if (h1s.length > 1) {
        const first = h1s[0] as HTMLElement;
        out.push({
          kind: 'multi',
          html: first.outerHTML.substring(0, 200),
          sel: first.id ? `#${first.id}` : 'h1',
          summary: `Multiple h1 elements (${h1s.length}) in primary content.`
        });
      }
      const anyHeading = main.querySelector('h1, h2, h3, h4, h5, h6');
      if (anyHeading && !main.querySelector('h1')) {
        const h = anyHeading as HTMLElement;
        out.push({
          kind: 'none',
          html: h.outerHTML.substring(0, 200),
          sel: h.id ? `#${h.id}` : h.tagName.toLowerCase(),
          summary: 'Headings exist but there is no h1 in the main content region.'
        });
      }
      return out;
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'heading-structure-policy',
          'moderate',
          f.summary,
          f.kind === 'multi'
            ? 'Use a single h1 for the page topic; use h2–h6 for subsections (WCAG 1.3.1 / best practice).'
            : 'Add one h1 describing the page; start the outline with h1 before h2.',
          f.html,
          f.sel,
          f.summary
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (heading policy) failed:', err);
  }

  return issues;
}

/** Data tables should expose header cells. */
export async function runDataTableHeaderChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      document.querySelectorAll('table').forEach((table, ti) => {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) return;
        const cells = table.querySelectorAll('td, th');
        if (cells.length < 4) return;
        if (table.querySelector('th, [role="columnheader"], [role="rowheader"]')) return;
        const t = table as HTMLElement;
        const sel = t.id ? `#${t.id}` : `table:nth-of-type(${ti + 1})`;
        out.push({ html: t.outerHTML.substring(0, 500), sel });
      });
      return out.slice(0, 10);
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'table-missing-headers',
          'serious',
          'Table has multiple rows/cells but no header cells (th or columnheader/rowheader role).',
          'Use th with scope, or headers/id association, so screen readers can relate data to labels (WCAG 1.3.1).',
          f.html,
          f.sel,
          'Data table missing header cells.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (table headers) failed:', err);
  }

  return issues;
}

/** Multiple complementary regions should be distinguished (extends landmark naming). */
export async function runLandmarkAsideUnnamedChecks(page: any): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  try {
    const findings = await page.evaluate(() => {
      const out: Array<{ html: string; sel: string }> = [];
      const asides = Array.from(document.querySelectorAll('aside, [role="complementary"]'));
      if (asides.length <= 1) return out;
      asides.forEach((aside, i) => {
        const a = aside as HTMLElement;
        const hasName =
          (a.getAttribute('aria-label') || '').trim() ||
          (a.getAttribute('aria-labelledby') || '').trim();
        if (hasName) return;
        const sel = a.id ? `#${a.id}` : `aside:nth-of-type(${i + 1})`;
        out.push({
          html: a.outerHTML.substring(0, 400),
          sel
        });
      });
      return out.slice(0, 10);
    });

    for (const f of findings) {
      issues.push(
        toIssue(
          'landmark-aside-unnamed',
          'moderate',
          'Multiple complementary (aside) landmarks; this one has no accessible name.',
          'Add aria-label or aria-labelledby so users can tell sidebars apart (WCAG 1.3.1).',
          f.html,
          f.sel,
          'Unnamed aside when multiple complementary regions exist.'
        )
      );
    }
  } catch (err) {
    console.warn('Extended check (landmark aside) failed:', err);
  }

  return issues;
}

/**
 * Run all extended checks and return combined issues.
 * All detection is rule-based or Puppeteer simulation; AI is used only for remediation.
 */
export async function runExtendedAccessibilityChecks(page: any): Promise<AccessibilityIssue[]> {
  const skipLink = await runSkipLinkBehaviourChecks(page);

  const [
    focusTrap,
    keyboardNav,
    errorMsg,
    altQuality,
    readability,
    ariaSemantic,
    landmarkCorrect,
    formStructure,
    adContainer,
    iframeTitles,
    duplicateIds,
    ariaHiddenFocusable,
    fieldsetGroups,
    interactiveNonSemantic,
    linkTextGlobal,
    buttonNames,
    docTitle,
    videoCaps,
    targetBlank,
    autofocus,
    scrollRegion,
    headingPolicy,
    tableHeaders,
    asideUnnamed
  ] = await Promise.all([
    runFocusTrapChecks(page),
    runKeyboardNavChecks(page),
    runErrorMessageClarityChecks(page),
    runAltTextQualityChecks(page),
    runContentReadabilityChecks(page),
    runAriaSemanticContentChecks(page),
    runLandmarkCorrectnessChecks(page),
    runFormStructureChecks(page),
    runAdContainerAccessibilityChecks(page),
    runIframeTitleChecks(page),
    runDuplicateIdChecks(page),
    runFocusableInAriaHiddenChecks(page),
    runRadioCheckboxFieldsetChecks(page),
    runInteractiveNonSemanticChecks(page),
    runGlobalLinkTextChecks(page),
    runUnlabeledButtonChecks(page),
    runDocumentTitleChecks(page),
    runVideoCaptionChecks(page),
    runTargetBlankNoopenerChecks(page),
    runAutofocusChecks(page),
    runScrollableRegionKeyboardChecks(page),
    runHeadingStructurePolicyChecks(page),
    runDataTableHeaderChecks(page),
    runLandmarkAsideUnnamedChecks(page)
  ]);

  const all = [
    ...skipLink,
    ...focusTrap,
    ...keyboardNav,
    ...errorMsg,
    ...altQuality,
    ...readability,
    ...ariaSemantic,
    ...landmarkCorrect,
    ...formStructure,
    ...adContainer,
    ...iframeTitles,
    ...duplicateIds,
    ...ariaHiddenFocusable,
    ...fieldsetGroups,
    ...interactiveNonSemantic,
    ...linkTextGlobal,
    ...buttonNames,
    ...docTitle,
    ...videoCaps,
    ...targetBlank,
    ...autofocus,
    ...scrollRegion,
    ...headingPolicy,
    ...tableHeaders,
    ...asideUnnamed
  ];
  if (all.length > 0) {
    console.log(
      `✅ Extended checks: ${skipLink.length} skip link, ${focusTrap.length} focus trap, ${keyboardNav.length} keyboard, ${errorMsg.length} error msg, ${altQuality.length} alt quality, ${readability.length} readability, ${ariaSemantic.length} ARIA semantic, ${landmarkCorrect.length} landmark, ${formStructure.length} form structure, ${adContainer.length} ad container, ${iframeTitles.length} iframe title, ${duplicateIds.length} duplicate id, ${ariaHiddenFocusable.length} aria-hidden focusable, ${fieldsetGroups.length} fieldset, ${interactiveNonSemantic.length} non-semantic interactive, ${linkTextGlobal.length} link text, ${buttonNames.length} button name, ${docTitle.length} doc title, ${videoCaps.length} video captions, ${targetBlank.length} target blank, ${autofocus.length} autofocus, ${scrollRegion.length} scroll region, ${headingPolicy.length} heading policy, ${tableHeaders.length} table headers, ${asideUnnamed.length} aside unnamed`
    );
  }
  return all;
}
