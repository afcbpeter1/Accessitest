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
  // WCAG 2.2 Level A rules
  levelA: [
    'target-size',
    'focus-indicator',
    'page-title',
    'landmark-one-main',
    'landmark-unique',
    'list',
    'listitem',
    'definition-list',
    'dlitem',
    'table-duplicate-name',
    'td-has-header',
    'th-has-data-cells',
    'html-has-lang',
    'html-lang-valid',
    'valid-lang',
    'meta-viewport',
    'meta-refresh',
    'meta-viewport-large'
  ],
  
  // WCAG 2.2 Level AA rules (includes Level A)
  levelAA: [
    'color-contrast',
    'image-alt',
    'input-image-alt',
    'label',
    'label-title-only',
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'aria-roles',
    'aria-valid-attr-value',
    'aria-valid-attr',
    'aria-allowed-attr',
    'aria-allowed-role',
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-input-field-name',
    'aria-toggle-field-name',
    'button-name',
    'document-title',
    'frame-title',
    'frame-title-unique',
    'heading-order',
    'link-name',
    'list-button',
    'listbox',
    'menu-button',
    'radiogroup',
    'region',
    'scope-attr-valid',
    'server-side-image-map',
    'skip-link',
    'tabindex',
    'table-fake-caption',
    'td-headers-attr',
    'th-has-data-cells',
    'valid-lang'
  ],

  // WCAG 2.2 Level AAA rules (includes Level A and AA)
  levelAAA: [
    // Enhanced color contrast requirements
    'color-contrast-enhanced',
    
    // Enhanced focus indicators
    'focus-visible',
    
    // Enhanced keyboard navigation
    'keyboard',
    
    // Enhanced text alternatives
    'image-alt',
    'input-image-alt',
    
    // Enhanced form labels
    'label',
    'label-title-only',
    
    // Enhanced heading structure
    'heading-order',
    
    // Enhanced link text
    'link-name',
    
    // Enhanced language identification
    'html-lang-valid',
    'valid-lang',
    
    // Enhanced page titles
    'document-title',
    
    // Enhanced frame titles
    'frame-title',
    'frame-title-unique',
    
    // Enhanced table structure
    'table-duplicate-name',
    'td-has-header',
    'th-has-data-cells',
    'table-fake-caption',
    'td-headers-attr',
    
    // Enhanced list structure
    'list',
    'listitem',
    'definition-list',
    'dlitem',
    
    // Enhanced landmark structure
    'landmark-one-main',
    'landmark-unique',
    
    // Enhanced ARIA usage
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'aria-roles',
    'aria-valid-attr-value',
    'aria-valid-attr',
    'aria-allowed-attr',
    'aria-allowed-role',
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-input-field-name',
    'aria-toggle-field-name',
    
    // Enhanced button accessibility
    'button-name',
    
    // Enhanced form controls
    'list-button',
    'listbox',
    'menu-button',
    'radiogroup',
    
    // Enhanced page structure
    'region',
    'scope-attr-valid',
    'server-side-image-map',
    'skip-link',
    'tabindex',
    
    // Enhanced target size (AAA requires larger targets)
    'target-size',
    
    // Enhanced focus indicators
    'focus-indicator',
    
    // Enhanced page titles
    'page-title',
    
    // Enhanced viewport settings
    'meta-viewport',
    'meta-refresh',
    'meta-viewport-large'
  ]
};
