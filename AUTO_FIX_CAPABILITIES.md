# Auto-Fix Capabilities

This document lists what accessibility issues can be automatically fixed and what requires manual intervention.

**All fixes are implemented using PyMuPDF rebuild approach - extracts all content and rebuilds with fixes applied.**

## ✅ **CAN BE AUTO-FIXED (12 types)**

### 1. Document Metadata ✅
- **Missing Document Title**
  - Automatically adds a document title based on filename or AI-generated title
  - Works for: PDF, Word, HTML
  - **Implementation:** `doc.set_metadata({'title': '...'})`

- **Missing Document Language**
  - Sets document-level language metadata
  - Works for: PDF, Word, HTML
  - **Implementation:** `doc.set_metadata({'language': '...'})`

### 2. Image Alt Text ✅
- **Missing Alt Text**
  - Adds alternative text to images during rebuild
  - Works for: PDF, Word documents
  - **Implementation:** `insert_image(rect, stream=image_bytes, alt_text=alt_text)`

### 3. Heading Structure (H1-H6) ✅
- **Missing Heading Structure**
  - Identifies headings using AI and applies proper heading levels (H1-H6)
  - Creates structure tree elements for headings
  - Works for: PDF, Word documents
  - **Implementation:** Detects heading text, creates structure elements

### 4. Language Span Tagging ✅
- **Foreign Language Content**
  - Identifies foreign language text using AI
  - Tags language appropriately (e.g., French, Spanish, German)
  - Works for: PDF, Word documents
  - **Implementation:** Maps language fixes to text spans during rebuild

### 5. Form Field Labels ✅
- **Missing Form Labels**
  - Adds label text above form fields
  - Works for: PDF forms
  - **Implementation:** Adds text labels near form field positions

### 6. Link Text Improvements ✅
- **Non-Descriptive Link Text**
  - Improves link text based on AI suggestions
  - Works for: PDF, Word documents
  - **Implementation:** Copies link annotations, link text improvements applied

### 7. Color Contrast (WCAG AA) ✅
- **Insufficient Color Contrast**
  - Automatically adjusts colors to meet WCAG AA standards (4.5:1 ratio)
  - Calculates contrast ratio and adjusts foreground/background colors
  - Works for: PDF, Word documents
  - **Implementation:** `calculate_contrast_ratio()`, `get_accessible_color()` - just changes RGB values, doesn't break layout

### 8. Color as Only Indicator ✅
- **Color as Only Indicator**
  - Adds text labels for color-only indicators
  - Works for: PDF, Word documents
  - **Implementation:** Adds text labels near color indicators

### 9. Text Resizing ✅
- **Text Too Small**
  - Enforces minimum font sizes (default 12pt)
  - Works for: PDF, Word documents
  - **Implementation:** Enforces minimum font size during rebuild

### 10. Images of Text (OCR) ✅
- **Images of Text**
  - Extracts text from images using OCR (tesseract.js)
  - Replaces image with extracted text
  - Works for: PDF, Word documents
  - **Implementation:** OCR done in TypeScript, Python script replaces image with text

### 11. Table Structure ✅
- **Missing Table Headers / Table Structure**
  - Creates proper table structure tree (/Table, /TR, /TH, /TD)
  - Marks first row as headers when appropriate
  - Works for: PDF documents
  - **Implementation:** `create_table_structure()` - creates full table hierarchy in structure tree

### 12. List Structure ✅
- **Missing List Structure**
  - Creates proper list structure tree (/L, /LI)
  - Supports ordered and unordered lists
  - Works for: PDF documents
  - **Implementation:** `create_list_structure()` - creates full list hierarchy in structure tree

---

## ❌ **CANNOT BE AUTO-FIXED** (Manual Fix Required)

### Application-Level Issues
- **Keyboard Traps** ❌
  - Requires application code access
  - Cannot be fixed at document level

- **Time Limits** ❌
  - Requires application code access
  - Cannot be fixed at document level

- **Script Accessibility** ❌
  - Requires code modification
  - Developer-level fix needed

- **Plug-in Alternatives** ❌
  - Requires alternative implementations
  - Developer-level fix needed

- **Audio Descriptions** ❌
  - Requires human narration
  - Cannot be automated

---

## Summary

**Auto-Fixable**: **12 issue types** covering:
1. Document metadata (title, language)
2. Image alt text
3. Heading structure (H1-H6)
4. Language span tagging
5. Form field labels
6. Link text improvements
7. Color contrast (WCAG AA)
8. Color as only indicator (text alternatives)
9. Text resizing (minimum font sizes)
10. Images of text (OCR extraction)
11. Table structure (structure tree)
12. List structure (structure tree)

**Manual Fix Required**: **5 issue types** covering:
- Keyboard traps (requires application code)
- Time limits (requires application code)
- Script accessibility (requires code modification)
- Plug-in alternatives (requires alternative implementations)
- Audio descriptions (requires human narration)

**Current Auto-Fix Rate**: **12 out of 17 applicable issue types** (71% of document-level accessibility issues can be automatically fixed).

**Note**: The 4 HTML-specific fixes (auto-playing media, flashing content, focus indicators, video captions) are not applicable to PDFs, which is our primary focus.
