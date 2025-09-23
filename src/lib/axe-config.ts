import { Spec } from 'axe-core';

export const axeConfig: Spec = {
  // WCAG 2.2 AA compliance
  standards: {
    wcag2aa: 'wcag2aa',
    wcag2aaa: 'wcag2aaa',
    wcag21aa: 'wcag21aa',
    wcag21aaa: 'wcag21aaa',
    wcag22aa: 'wcag22aa',
    wcag22aaa: 'wcag22aaa'
  },
  
  // Reporter configuration
  reporter: 'v2',
  
  // Result types to include
  resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
  
  // Performance settings
  performanceTimer: true,
  
  // Element inclusion/exclusion
  elementRef: false,
  
  // Custom branding
  branding: {
    brand: 'AccessScan',
    application: 'Accessibility Testing Platform'
  }
};

export const wcag22Rules = {
  // WCAG 2.0 Level A Rules
  levelA: [
    'area-alt',
    'image-alt',
    'input-image-alt',
    'object-alt',
    'role-img-alt',
    'svg-img-alt',
    'aria-allowed-attr',
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'aria-roles',
    'aria-valid-attr',
    'aria-valid-attr-value',
    'blink',
    'marquee',
    'meta-refresh',
    'no-autoplay-audio',
    'video-caption',
    'bypass',
    'frame-focusable-content',
    'nested-interactive',
    'scrollable-region-focusable',
    'color-contrast',
    'color-contrast-enhanced',
    'focus-order-semantics',
    'keyboard',
    'keyboard-navigation',
    'link-name',
    'page-has-heading-one',
    'page-has-main',
    'region',
    'tabindex'
  ],
  
  // WCAG 2.0 Level AA Rules
  levelAA: [
    // Text Alternatives
    'area-alt',
    'image-alt',
    'input-image-alt',
    'object-alt',
    'role-img-alt',
    'svg-img-alt',
    
    // ARIA
    'aria-allowed-attr',
    'aria-braille-equivalent',
    'aria-command-name',
    'aria-conditional-attr',
    'aria-deprecated-role',
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-input-field-name',
    'aria-meter-name',
    'aria-progressbar-name',
    'aria-prohibited-attr',
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'aria-roles',
    'aria-toggle-field-name',
    'aria-tooltip-name',
    'aria-valid-attr-value',
    'aria-valid-attr',
    
    // Time and Media
    'blink',
    'marquee',
    'meta-refresh',
    'no-autoplay-audio',
    'video-caption',
    
    // Keyboard
    'bypass',
    'frame-focusable-content',
    'nested-interactive',
    'scrollable-region-focusable',
    
    // Color
    'color-contrast',
    'link-in-text-block',
    
    // Structure
    'definition-list',
    'dlitem',
    'list',
    'listitem',
    
    // Language
    'html-has-lang',
    'html-lang-valid',
    'html-xml-lang-mismatch',
    'valid-lang',
    
    // Forms
    'form-field-multiple-labels',
    'label',
    'select-name',
    
    // Frames
    'frame-title',
    'frame-title-unique',
    'server-side-image-map',
    
    // Tables
    'td-headers-attr',
    'th-has-data-cells',
    
    // Name, Role, Value
    'button-name',
    'input-button-name',
    'link-name',
    'summary-name',
    
    // Document Structure
    'document-title',
    'duplicate-id-aria',
    
    // Sensory and Visual Cues
    'meta-viewport'
  ],

  // WCAG 2.1 Level A & AA Rules (Additional)
  wcag21AA: [
    'autocomplete-valid',
    'avoid-inline-spacing'
  ],

  // WCAG 2.2 Level A & AA Rules (Additional)
  wcag22AA: [
    'target-size'
  ],

  // Best Practices Rules
  bestPractices: [
    'accesskeys',
    'aria-allowed-role',
    'aria-dialog-name',
    'aria-text',
    'aria-treeitem-name',
    'empty-heading',
    'empty-table-header',
    'frame-tested',
    'heading-order',
    'image-redundant-alt',
    'label-title-only',
    'landmark-banner-is-top-level',
    'landmark-complementary-is-top-level',
    'landmark-contentinfo-is-top-level',
    'landmark-main-is-top-level',
    'landmark-no-duplicate-banner',
    'landmark-no-duplicate-contentinfo',
    'landmark-no-duplicate-main',
    'landmark-one-main',
    'landmark-unique',
    'meta-viewport-large',
    'page-has-heading-one',
    'presentation-role-conflict',
    'region',
    'scope-attr-valid',
    'skip-link',
    'tabindex',
    'table-duplicate-name'
  ],

  // WCAG 2.x Level AAA Rules
  levelAAA: [
    'color-contrast-enhanced',
    'identical-links-same-purpose',
    'meta-refresh-no-exceptions'
  ],

  // Experimental Rules
  experimental: [
    'css-orientation-lock',
    'focus-order-semantics',
    'hidden-content',
    'label-content-name-mismatch',
    'p-as-heading',
    'table-fake-caption',
    'td-has-header'
  ],

  // Deprecated Rules (included for completeness but disabled by default)
  deprecated: [
    'aria-roledescription',
    'audio-caption',
    'duplicate-id-active',
    'duplicate-id'
  ]
};