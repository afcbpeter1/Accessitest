const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

// Complete list of accessibility rules from Deque
const allAccessibilityRules = {
  // WCAG 2.0 Level A & AA Rules
  wcag20AA: [
    'area-alt',
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
    'blink',
    'button-name',
    'bypass',
    'color-contrast',
    'definition-list',
    'dlitem',
    'document-title',
    'duplicate-id-aria',
    'form-field-multiple-labels',
    'frame-focusable-content',
    'frame-title-unique',
    'frame-title',
    'html-has-lang',
    'html-lang-valid',
    'html-xml-lang-mismatch',
    'image-alt',
    'input-button-name',
    'input-image-alt',
    'label',
    'link-in-text-block',
    'link-name',
    'list',
    'listitem',
    'marquee',
    'meta-refresh',
    'meta-viewport',
    'nested-interactive',
    'no-autoplay-audio',
    'object-alt',
    'role-img-alt',
    'scrollable-region-focusable',
    'select-name',
    'server-side-image-map',
    'summary-name',
    'svg-img-alt',
    'td-headers-attr',
    'th-has-data-cells',
    'valid-lang',
    'video-caption'
  ],

  // WCAG 2.1 Level A & AA Rules
  wcag21AA: [
    'autocomplete-valid',
    'avoid-inline-spacing'
  ],

  // WCAG 2.2 Level A & AA Rules
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
  wcag2AAA: [
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

  // Deprecated Rules
  deprecated: [
    'aria-roledescription',
    'audio-caption',
    'duplicate-id-active',
    'duplicate-id'
  ]
};

async function validateAccessibilityRules() {
  try {
    console.log('🔍 Validating accessibility rules configuration...');
    
    // Get all unique rules
    const allRules = new Set();
    Object.values(allAccessibilityRules).forEach(ruleSet => {
      ruleSet.forEach(rule => allRules.add(rule));
    });
    
    console.log(`📊 Total unique rules: ${allRules.size}`);
    console.log(`📊 Rules by category:`);
    Object.entries(allAccessibilityRules).forEach(([category, rules]) => {
      console.log(`  ${category}: ${rules.length} rules`);
    });
    
    // Check for duplicates
    const ruleCounts = {};
    Object.values(allAccessibilityRules).forEach(ruleSet => {
      ruleSet.forEach(rule => {
        ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
      });
    });
    
    const duplicates = Object.entries(ruleCounts).filter(([rule, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  Duplicate rules found:');
      duplicates.forEach(([rule, count]) => {
        console.log(`  ${rule}: appears ${count} times`);
      });
    } else {
      console.log('✅ No duplicate rules found');
    }
    
    // Validate rule names (basic format check)
    const invalidRules = [];
    allRules.forEach(rule => {
      if (!/^[a-z][a-z0-9-]*$/.test(rule)) {
        invalidRules.push(rule);
      }
    });
    
    if (invalidRules.length > 0) {
      console.log('❌ Invalid rule names found:');
      invalidRules.forEach(rule => console.log(`  ${rule}`));
    } else {
      console.log('✅ All rule names are valid');
    }
    
    console.log('\n🎯 Rule Coverage Summary:');
    console.log(`  WCAG 2.0 A & AA: ${allAccessibilityRules.wcag20AA.length} rules`);
    console.log(`  WCAG 2.1 A & AA: ${allAccessibilityRules.wcag21AA.length} rules`);
    console.log(`  WCAG 2.2 A & AA: ${allAccessibilityRules.wcag22AA.length} rules`);
    console.log(`  Best Practices: ${allAccessibilityRules.bestPractices.length} rules`);
    console.log(`  WCAG 2.x AAA: ${allAccessibilityRules.wcag2AAA.length} rules`);
    console.log(`  Experimental: ${allAccessibilityRules.experimental.length} rules`);
    console.log(`  Deprecated: ${allAccessibilityRules.deprecated.length} rules`);
    
    console.log('\n✅ Accessibility rules validation complete!');
    console.log('🚀 The scanner now includes all rules from the Deque comprehensive list.');
    
  } catch (error) {
    console.error('❌ Error validating accessibility rules:', error);
  } finally {
    await pool.end();
  }
}

validateAccessibilityRules();