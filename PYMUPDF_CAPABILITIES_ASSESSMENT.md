# PyMuPDF Capabilities Assessment - What Can We Actually Fix?

## ✅ **CAN FIX (PyMuPDF supports these)**

### 1. Document metadata (title, language) ✅
- **Status:** FULLY SUPPORTED
- **Method:** `doc.set_metadata({'title': '...', 'language': '...'})`
- **Works:** Yes, PyMuPDF has native support
- **Implementation:** Already working

### 2. Image alt text ✅
- **Status:** SUPPORTED (with structure tree)
- **Method:** Create `/Figure` structure element with `/Alt` attribute
- **Works:** Yes, but requires proper structure tree linking
- **Implementation:** Can be done, needs MCID linking

### 3. PDF structure tree (semantic tags) ✅
- **Status:** SUPPORTED
- **Method:** Create structure tree root, add structure elements (H1-H6, P, Figure, etc.)
- **Works:** Yes, PyMuPDF can create and modify structure trees
- **Implementation:** Complex but doable with low-level PDF object manipulation

---

## ⚠️ **PARTIALLY SUPPORTED (Can do but complex)**

### 4. Heading structure (H1-H6) ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Create structure elements with tags H1-H6, link to text via MCID
- **Works:** Yes, but requires:
  - Creating structure elements
  - Adding MCIDs to content stream
  - Linking structure elements to MCIDs
- **Complexity:** High - requires understanding PDF content streams
- **Implementation:** Possible but needs careful MCID management

### 5. Language span tagging ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Create `/Span` structure elements with `/Lang` attribute
- **Works:** Yes, but requires span-level structure tree manipulation
- **Complexity:** High - need to identify text spans and tag them
- **Implementation:** Possible but complex

### 6. Table headers and structure ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Create `/Table`, `/TR`, `/TH`, `/TD` structure elements
- **Works:** Yes, but requires:
  - Detecting table structure from content
  - Creating proper table structure tree
  - Linking to content
- **Complexity:** Very High - tables are complex structures
- **Implementation:** Possible but very complex

### 7. List structure (ordered/unordered) ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Create `/L`, `/LI` structure elements
- **Works:** Yes, but requires detecting lists and creating structure
- **Complexity:** High
- **Implementation:** Possible but complex

### 8. Form field labels ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Modify form field dictionaries to add `/TU` (tooltip) or create label structure
- **Works:** Yes, PyMuPDF can modify form fields
- **Complexity:** Medium
- **Implementation:** Possible

### 9. Link text improvements ⚠️
- **Status:** PARTIALLY SUPPORTED
- **Method:** Modify link annotations or add structure elements
- **Works:** Yes, but link text is usually in the content, not the annotation
- **Complexity:** Medium-High
- **Implementation:** Possible but may require content modification

---

## ❌ **NOT SUPPORTED (PyMuPDF limitations)**

### 10. Color contrast (WCAG AA) ⚠️
- **Status:** POSSIBLE
- **Reason:** PyMuPDF can extract colors and modify text colors
- **Method:** 
  - Extract text with current colors
  - Calculate new colors that meet WCAG AA (4.5:1 contrast)
  - Rebuild text with new colors (same position, same size, just different RGB values)
- **Complexity:** Medium-High
- **Implementation:** Possible - we're just changing RGB values, not positions or sizes
- **Note:** Should NOT break layout - we're only changing colors, not moving or resizing anything

### 11. Color as only indicator (text alternatives) ⚠️
- **Status:** POSSIBLE
- **Reason:** Can add text labels near color indicators
- **Method:** 
  - Detect color-only indicators
  - Add text labels as annotations or overlay text
  - Could add as structure tree elements
- **Complexity:** Medium
- **Implementation:** Possible - adding text labels shouldn't break existing layout
- **Note:** May add visual elements, but won't break existing layout

### 12. Text resizing (minimum font sizes) ⚠️
- **Status:** POSSIBLE BUT RISKY
- **Reason:** Can modify font sizes, but larger text may overflow
- **Method:** 
  - Extract text with current font sizes
  - Increase font size to meet minimum (e.g., 12pt)
  - Rebuild text with larger font (same position)
- **Complexity:** Medium-High
- **Implementation:** Possible, but:
  - Larger text may overflow containers
  - May need to adjust line spacing
  - Could affect layout if text is too large
- **Note:** This COULD break layout if text overflows, but careful implementation could work

### 13. Reading order (logical sequence) ⚠️
- **Status:** POSSIBLE
- **Reason:** Reading order is in structure tree, not visual layout
- **Method:** 
  - Modify structure tree order without changing visual positions
  - Reorder structure elements (H1, P, etc.) in structure tree
  - Visual layout stays the same, only logical order changes
- **Complexity:** Medium
- **Implementation:** Possible - we're only changing structure tree order, not visual positions
- **Note:** Should NOT break layout - reading order is separate from visual layout

### 14. Images of text (OCR extraction) ❌
- **Status:** NOT DIRECTLY SUPPORTED
- **Reason:** Would need to:
  - Detect images of text
  - Run OCR
  - Remove image
  - Add text in same position
- **Workaround:** Possible but complex
- **Complexity:** Very High
- **Implementation:** Possible but requires OCR integration

---

## ❌ **NOT APPLICABLE TO PDFs**

### 15. Auto-playing media removal ❌
- **Status:** NOT APPLICABLE
- **Reason:** PDFs don't have auto-playing media (that's HTML/Flash)
- **Note:** Could detect embedded media and remove, but rare in PDFs

### 16. Flashing/animated content removal ❌
- **Status:** NOT APPLICABLE
- **Reason:** PDFs can have animated content (JavaScript), but:
  - PyMuPDF can't easily detect flashing
  - Removing would require JavaScript removal
- **Complexity:** High
- **Implementation:** Possible but complex

### 17. Focus indicators (HTML) ❌
- **Status:** NOT APPLICABLE
- **Reason:** Focus indicators are HTML/CSS concepts, not PDF
- **Note:** PDFs have form fields, but focus indicators are viewer-dependent

### 18. Video captions (FFmpeg + Whisper) ❌
- **Status:** NOT APPLICABLE
- **Reason:** PDFs don't contain video (that's HTML/embedded media)
- **Note:** Could handle if PDF has embedded video, but extremely rare

---

## Summary

### ✅ **Fully Supported (3):**
1. Document metadata (title, language)
2. Image alt text (with structure tree)
3. PDF structure tree (semantic tags)

### ⚠️ **Partially Supported - Complex (6):**
4. Heading structure (H1-H6) - needs MCID linking
5. Language span tagging - needs span-level manipulation
6. Table headers and structure - very complex
7. List structure - complex
8. Form field labels - medium complexity
9. Link text improvements - medium-high complexity

### ⚠️ **Possible but Complex (5):**
10. Color contrast - **POSSIBLE** (just changing RGB values, won't break layout)
11. Color as only indicator - **POSSIBLE** (adding text labels)
12. Text resizing - **POSSIBLE BUT RISKY** (may overflow if too large)
13. Reading order - **POSSIBLE** (structure tree order, not visual layout)
14. Images of text (OCR) - **POSSIBLE** (complex but doable)

### ❌ **Not Applicable to PDFs (4):**
15. Auto-playing media removal
16. Flashing/animated content removal
17. Focus indicators (HTML)
18. Video captions

---

## Realistic Assessment

**What we can ACTUALLY fix with PyMuPDF rebuild:**
- ✅ Metadata (title, language) - **EASY**
- ✅ Image alt text - **MEDIUM** (needs structure tree)
- ⚠️ Heading structure - **HARD** (needs MCID linking)
- ⚠️ Language tags - **HARD** (needs span-level)
- ⚠️ Tables/Lists - **VERY HARD** (complex structure)
- ⚠️ Forms - **MEDIUM** (form field modification)
- ⚠️ Color/Contrast - **MEDIUM-HARD** (just changing RGB values, won't break layout)
- ⚠️ Color as only indicator - **MEDIUM** (adding text labels)
- ⚠️ Text resizing - **MEDIUM-HARD** (may overflow if too large)
- ⚠️ Reading order - **MEDIUM** (structure tree order, not visual layout)
- ⚠️ Images of text (OCR) - **HARD** (requires OCR integration)

**Realistic fix rate:** **70-80% of issues** (much better than I initially thought!)

**Correction:** I was being overly cautious. Most of these fixes are possible:
- **Color changes** - Just RGB values, won't break layout
- **Reading order** - Structure tree only, not visual layout
- **Text resizing** - Could overflow, but careful implementation could work
- **Color indicators** - Adding text labels shouldn't break layout

**The real challenges:**
- Structure tree linking (MCIDs) - complex but doable
- Table/list structure - very complex but possible
- OCR integration - requires external tools but possible

