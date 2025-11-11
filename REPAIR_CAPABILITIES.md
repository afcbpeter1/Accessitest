# Document Repair Capabilities Matrix

This document outlines what accessibility issues can be automatically repaired and what requires manual intervention.

## ✅ CAN REPAIR (Automatic Fixes)

### Document Metadata
- ✅ **Missing Document Title** - Automatically adds title from filename or AI-generated
- ✅ **Missing Document Language** - Sets document-level language metadata (e.g., 'en', 'fr')
- ✅ **Language Declaration** - Adds language property to PDF/Word documents

### Document Structure (Word Documents)
- ✅ **Missing Heading Structure** - AI identifies and adds proper heading hierarchy (H1-H6)
- ✅ **Document Organization** - Rebuilds Word documents with proper paragraph structure

### Document Structure (PDFs)
- ⚠️ **Heading Structure Identification** - AI identifies headings but cannot modify PDF structure tree (pdf-lib limitation)
- ⚠️ **Language Tagging** - Identifies foreign language content but cannot add span-level language tags

### Images (Limited)
- ⚠️ **Missing Alt Text** - Can identify but requires structure tree manipulation for PDFs
- ⚠️ **Image Accessibility** - Documented but not fully implemented

---

## ❌ CANNOT REPAIR (Manual Fixes Required)

### Complex Structure Issues
- ❌ **Table Headers** - Cannot add proper table header structure to existing tables
- ❌ **List Structure** - Cannot fix improperly structured lists
- ❌ **Meaningful Sequence** - Cannot reorganize document reading order

### Color & Contrast
- ❌ **Color Contrast Issues** - Cannot automatically adjust colors to meet WCAG standards
- ❌ **Color as Only Indicator** - Cannot add non-color indicators (requires design changes)
- ❌ **Images of Text** - Cannot convert image-based text to actual text

### Media & Interactive Content
- ❌ **Missing Video Captions** - Cannot add captions to video content
- ❌ **Missing Audio Descriptions** - Cannot add audio descriptions
- ❌ **Synchronized Media Alternatives** - Cannot add alternatives for media
- ❌ **Auto-playing Audio** - Cannot add controls or disable auto-play
- ❌ **Moving/Blinking Content** - Cannot add pause/stop controls

### Forms & Interactive Elements
- ❌ **Form Field Labels** - Cannot add proper labels to form fields (requires structure manipulation)
- ❌ **Form Error Identification** - Cannot add error handling
- ❌ **Form Field Names/Roles** - Cannot add proper ARIA attributes
- ❌ **Keyboard Accessibility** - Cannot fix keyboard navigation issues
- ❌ **Focus Indicators** - Cannot add visible focus indicators

### Navigation & Links
- ❌ **Non-descriptive Link Text** - Cannot automatically rewrite link text (requires content understanding)
- ❌ **Missing Navigation Aids** - Cannot add skip links or navigation aids
- ❌ **Link Purpose** - Cannot make links more descriptive without context

### Language & Content
- ❌ **Foreign Language Spans** - Can identify but cannot add language tags to specific text spans in PDFs
- ❌ **Language of Parts** - Cannot tag specific sections with different languages

### Time-based & Dynamic Content
- ❌ **Time Limits** - Cannot add adjustment options for time limits
- ❌ **Text-only Alternatives** - Cannot generate text-only versions
- ❌ **Script Accessibility** - Cannot make scripts keyboard accessible
- ❌ **Plug-in Alternatives** - Cannot provide accessible alternatives

### Layout & Responsive Design
- ❌ **Text Resizing** - Cannot ensure text resizes to 200%
- ❌ **Orientation Restrictions** - Cannot remove orientation restrictions
- ❌ **Content Reflow** - Cannot fix horizontal scrolling issues
- ❌ **Text Spacing** - Cannot ensure adjustable text spacing

### Advanced PDF Features
- ❌ **PDF Structure Tree** - Cannot modify PDF accessibility structure tree (library limitation)
- ❌ **PDF Bookmarks** - Cannot add bookmarks for navigation
- ❌ **PDF Tags** - Cannot add semantic tags to PDF elements

---

## 🔧 PARTIALLY SUPPORTED (AI Identifies, Limited Repair)

### Heading Structure
- 🔧 **PDF Headings** - AI identifies what should be headings, but cannot modify PDF structure
- ✅ **Word Headings** - Fully supported - AI identifies and applies heading structure

### Language
- ✅ **Document Language** - Fully supported - Sets document-level language
- 🔧 **Language Spans** - AI identifies foreign language but cannot tag specific spans in PDFs

### Alt Text
- 🔧 **Image Alt Text** - AI can suggest alt text, but cannot add to PDF structure tree
- ⚠️ **Word Images** - Not yet implemented (would require image extraction and modification)

---

## 📊 Summary by Category

### Fully Repairable (✅)
- Document title
- Document language (metadata level)
- Word document heading structure
- Word document organization

### Partially Repairable (🔧)
- PDF heading identification (AI identifies, cannot modify structure)
- Foreign language identification (AI identifies, cannot tag spans)
- Image alt text suggestions (AI suggests, cannot add to PDF)

### Not Repairable (❌)
- Table structure
- Color/contrast issues
- Media captions/descriptions
- Form accessibility
- Link text improvements
- Time-based content
- Layout/responsive issues
- PDF structure tree modifications
- Keyboard navigation
- Focus indicators

---

## 🚀 Potential Future Enhancements

### High Value, Technically Feasible
1. **Word Document Image Alt Text** - Extract images, add alt text using docx library
2. **Word Document Table Headers** - Modify table structure in Word docs
3. **Word Document Form Labels** - Add labels to form fields in Word
4. **PDF Bookmarks** - Add bookmarks for navigation (pdf-lib might support this)
5. **Link Text Improvements** - Use AI to suggest better link text

### High Value, Technically Challenging
1. **PDF Structure Tree Manipulation** - Would require advanced PDF library or direct PDF object manipulation
2. **Color Contrast Adjustment** - Would require image processing and color replacement
3. **Table Structure in PDFs** - Requires structure tree manipulation
4. **Form Field Accessibility in PDFs** - Requires form field modification

### Medium Value
1. **Text-only Alternative Generation** - Could generate simplified text version
2. **Navigation Aids** - Could add skip links or table of contents
3. **Language Span Tagging in Word** - Could tag paragraphs with different languages

---

## 💡 Current Repair Success Rate

Based on typical document accessibility issues:

- **Word Documents**: ~40% of issues can be automatically fixed
  - ✅ Title, language, heading structure
  - ❌ Tables, forms, images, links

- **PDF Documents**: ~20% of issues can be automatically fixed
  - ✅ Title, language (document-level)
  - ❌ Structure, images, tables, forms, links

- **HTML Documents**: ~30% of issues can be automatically fixed
  - ✅ Title, language, some alt text
  - ❌ Complex structure, forms, media

---

## 🎯 Value Proposition

**What Makes This Tool Valuable:**

1. **Time Savings**: Automatically fixes common metadata issues (title, language)
2. **Word Document Structure**: Completely rebuilds Word docs with proper heading hierarchy
3. **AI-Powered Analysis**: Identifies what needs fixing even if it can't fix it
4. **Comprehensive Suggestions**: Provides detailed manual fix instructions for complex issues
5. **Batch Processing**: Can process multiple documents quickly

**What Users Still Need to Do Manually:**

1. Fix table structures
2. Add image alt text (especially in PDFs)
3. Improve link text
4. Fix color/contrast issues
5. Add media captions
6. Fix form accessibility
7. Modify PDF structure trees

---

## 📝 Notes

- **PDF Limitations**: pdf-lib has limited support for structure tree manipulation. To fully repair PDFs, would need libraries like `hummus-recipe` or direct PDF object manipulation.
- **Word Advantages**: The `docx` library allows full document reconstruction, making Word repair more comprehensive.
- **AI Integration**: AI is used to identify issues and suggest fixes, but many fixes require structural changes that libraries don't support.

