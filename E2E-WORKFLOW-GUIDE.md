# End-to-End Workflow Guide: PDF Accessibility Scanning & Auto-Fix

## Overview

When you upload a PDF in the application, the system performs a comprehensive accessibility scan using **Adobe PDF Services API** and then automatically fixes issues using **AI-powered repair**. This document explains the complete workflow.

## Complete E2E Workflow

### Step 1: User Uploads PDF
**Location:** `DocumentUpload.tsx` → User selects PDF file

1. User selects a PDF file from their device
2. File is read and converted to base64
3. File metadata is stored (name, size, type)
4. PDF preview is generated (if possible)
5. Document is marked as "uploaded" and ready for scanning

### Step 2: Document Scan API Call
**Location:** `POST /api/document-scan`

#### 2.1 Authentication & Credits Check
- ✅ User authentication verified
- ✅ Credits checked (deducts 1 credit per scan)
- ✅ Returns error if insufficient credits

#### 2.2 PDF Auto-Tagging (Adobe PDF Services)
**What it does:**
- Uses Adobe PDF Services Auto-Tag API to add basic structure tags
- Creates structure tree (`/StructTreeRoot`) if missing
- Adds basic tags for headings, lists, tables, images
- **Fixes:** "Tags are missing" check

**Result:** Tagged PDF buffer (or original if tagging fails)

#### 2.3 Accessibility Check (Adobe PDF Services)
**What it checks:**
Adobe PDF Services runs comprehensive accessibility checks against **PDF/UA** and **WCAG 2.1 AA** standards:

**Document Structure:**
- ✅ Tags are missing
- ✅ Document title is missing
- ✅ Document language is missing
- ✅ Bookmarks are missing
- ✅ Reading order is incorrect
- ✅ Heading structure is missing/incorrect

**Page Content:**
- ✅ Figures alternate text is missing
- ✅ Tables must have a summary
- ✅ Color contrast is insufficient
- ✅ Text language is not identified
- ✅ Fonts are not embedded
- ⚠️ Text is too small

**Form Fields:**
- ✅ Form fields must have labels
- ⚠️ Tab order is incorrect
- ⚠️ Form field properties are missing

**Links:**
- ✅ Link text is not descriptive
- ⚠️ Link destination is invalid

**Other:**
- ✅ Document is not tagged
- ✅ Accessibility permission flag
- ⚠️ Security settings block assistive technologies

**Result:** Comprehensive list of accessibility issues with:
- Issue type (critical, serious, moderate, minor)
- Page number
- Description
- WCAG criterion
- Section 508 requirement
- Remediation suggestions

### Step 3: AI-Powered Auto-Fix
**Location:** `AIAutoFixService.applyAutoFixes()`

**What it does:**
Automatically generates and applies fixes for detected issues:

#### 3.1 Issue Detection & Filtering
The system filters issues by type:
- **Alt Text Issues** → Images missing alt text
- **Table Summary Issues** → Tables missing summaries
- **Metadata Issues** → Missing title/language
- **Bookmark Issues** → Missing bookmarks
- **Reading Order Issues** → Incorrect reading order
- **Color Contrast Issues** → Insufficient contrast
- **Language Issues** → Foreign language text not identified
- **Form Label Issues** → Form fields missing labels
- **Link Text Issues** → Non-descriptive link text
- **Text Size Issues** → Text too small
- **Font Embedding Issues** → Fonts not embedded
- **Tab Order Issues** → Incorrect tab order

#### 3.2 AI Fix Generation

**For Images (Alt Text):**
- Uses **Claude Vision API** to analyze actual images
- Extracts image from PDF using PyMuPDF
- Generates descriptive alt text based on image content
- **Fixes:** "Figures alternate text is missing"

**For Tables:**
- AI analyzes table content and surrounding text
- Generates concise summaries describing table purpose
- **Fixes:** "Tables must have a summary"

**For Metadata:**
- Sets document title (from filename or AI-generated)
- Sets document language (defaults to 'en' or AI-detected)
- **Fixes:** "Document title is missing", "Document language is missing"

**For Bookmarks:**
- AI analyzes document structure
- Identifies headings and creates hierarchical bookmarks
- **Fixes:** "Bookmarks are missing"

**For Headings:**
- AI identifies heading text from document
- Creates H1-H6 structure elements
- **Fixes:** "Heading structure is missing/incorrect"

**For Language Spans:**
- AI detects foreign language text
- Creates language span structure elements with `/Lang` attributes
- **Fixes:** "Text language is not identified"

**For Color Contrast:**
- Calculates contrast ratios
- Suggests accessible colors
- Modifies text colors in content streams
- **Fixes:** "Color contrast is insufficient"

**For Text Size:**
- Detects text smaller than 9pt (WCAG minimum)
- Increases font size to minimum
- **Fixes:** "Text is too small"

**For Form Labels:**
- AI generates descriptive labels for form fields
- Creates form structure elements with labels
- **Fixes:** "Form fields must have labels"

**For Link Text:**
- AI improves non-descriptive link text
- Updates link annotations with better text
- **Fixes:** "Link text is not descriptive"

**For Tab Order:**
- Analyzes form field positions
- Sets logical tab order (top to bottom, left to right)
- **Fixes:** "Tab order is incorrect"

**For Font Embedding:**
- Checks which fonts are embedded
- Flags unembedded fonts (requires font files to embed)
- **Fixes:** "Fonts are not embedded" (checking only, embedding requires font files)

#### 3.3 PDF Repair Execution
**Location:** `PyMuPDFWrapper.repairPDF()` → `scripts/pdf-rebuild-with-fixes.py`

**Process:**
1. **PyMuPDF Processing:**
   - Opens original PDF
   - Copies all pages exactly (preserves layout)
   - Collects structure data (alt text, headings, language spans, etc.)
   - Sets metadata (title, language)
   - Sets MarkInfo/Marked=true

2. **pikepdf Processing:**
   - Opens temporary PDF from PyMuPDF
   - Creates structure tree elements:
     - `/Figure` elements with `/Alt` text
     - `/Table` elements with `/Summary`
     - `/H1-H6` heading elements
     - `/Span` elements with `/Lang` attributes
     - `/Form` elements with labels
     - `/Link` elements with improved text
   - Applies content stream modifications:
     - Color contrast fixes (text color changes)
     - Text size fixes (font size increases)
   - Links structure elements via MCID (Marked Content IDs)
   - Sets tab order for form fields
   - Checks font embedding status

3. **Bookmark Application:**
   - Reopens PDF with PyMuPDF
   - Sets table of contents (bookmarks)
   - Saves final PDF

**Result:** Fixed PDF buffer with all accessibility improvements

### Step 4: Re-Scan Fixed PDF (Optional)
**Location:** `POST /api/document-scan` (if auto-fix was applied)

The system can optionally re-scan the fixed PDF to verify improvements:
- Compares issue counts before/after
- Shows improvement metrics
- Validates fixes were applied correctly

### Step 5: Results Returned to User
**Response includes:**

```json
{
  "success": true,
  "scanId": "scan_1234567890",
  "is508Compliant": false,
  "overallScore": 75,
  "issues": [
    {
      "id": "issue_1",
      "type": "critical",
      "category": "structure",
      "description": "Figures alternate text is missing",
      "page": 1,
      "wcagCriterion": "WCAG 2.1 AA - 1.1.1",
      "remediation": "Add alt text to image",
      "autoFixed": true
    }
  ],
  "summary": {
    "total": 15,
    "critical": 5,
    "serious": 7,
    "moderate": 2,
    "minor": 1
  },
  "metadata": {
    "scanEngine": "Adobe PDF Services API",
    "standard": "PDF/UA, WCAG 2.1 AA",
    "pagesAnalyzed": 14,
    "fileSize": 1234567
  },
  "taggedPdfFileName": "document_auto-fixed.pdf",
  "taggedPdfContent": "base64...",
  "autoFixed": true,
  "autoFixStats": {
    "altText": 5,
    "tableSummaries": 2,
    "metadata": 1,
    "bookmarks": 8,
    "readingOrder": 0,
    "colorContrast": 3,
    "language": 2,
    "formLabel": 0,
    "linkText": 1,
    "textSize": 4,
    "fontEmbedding": 0,
    "tabOrder": 0
  }
}
```

### Step 6: User Interface Display
**Location:** `DocumentUpload.tsx`, `DetailedReport.tsx`

1. **Scan Results Display:**
   - Overall compliance score
   - Issue breakdown by severity
   - Detailed issue list with:
     - Issue description
     - Page number
     - WCAG criterion
     - Remediation steps
     - Auto-fix status

2. **Fixed PDF Download:**
   - Download button for auto-fixed PDF
   - Shows fix statistics
   - Compares before/after

3. **Issue Management:**
   - Add issues to product backlog
   - Filter by severity/category
   - Export reports

## Adobe Acrobat Checks Coverage

### ✅ Fully Automated (12 checks - UPDATED)
1. **Tags are missing** → Auto-tagging via Adobe API
2. **Document title is missing** → Metadata setting
3. **Document language is missing** → Catalog language setting
4. **Figures alternate text is missing** → AI-generated with Claude Vision
5. **Tables must have a summary** → AI-generated summaries
6. **Bookmarks are missing** → AI-generated from document structure
7. **Heading structure is missing/incorrect** → H1-H6 structure elements
8. **Form fields must have labels** → AI-generated labels
9. **Link text is not descriptive** → AI-improved descriptive text
10. **Color contrast is insufficient** → Content stream modification
11. **Text language is not identified** → Language span detection
12. **Text is too small** → Font size increases

### ⚠️ Partially Automated (2 checks)
1. **Reading order is incorrect** → Structure tree order set, MCID linking implemented
2. **Tab order is incorrect** → Tab order set based on field positions

### ✅ Checked but Not Auto-Fixed (1 check)
1. **Fonts are not embedded** → Fonts are checked and flagged (embedding requires font files)

### ❌ Not Automated (1 check)
1. **Security settings block assistive technologies** → Requires manual security policy changes

## Coverage Summary

**Fully Automated: 12/16 checks (75%)**  
**Partially Automated: 2/16 checks (12.5%)**  
**Checked: 1/16 checks (6.25%)**  
**Not Automated: 1/16 checks (6.25%)**

**Total Coverage: 87.5% of checks are addressed (fully or partially)**

## All Critical Checks - Fully Automated ✅

The most critical accessibility issues that Adobe flags are:
1. ✅ Document is not tagged
2. ✅ Figures alternate text is missing
3. ✅ Tables must have a summary
4. ✅ Document title is missing
5. ✅ Document language is missing
6. ✅ Bookmarks are missing
7. ✅ Heading structure is missing

**All critical checks are fully automated and working!**

## Technical Stack

- **Adobe PDF Services API:** Auto-tagging and accessibility checking
- **Claude AI (Anthropic):** Alt text generation, table summaries, language detection
- **PyMuPDF (fitz):** PDF processing, content extraction, page rebuilding
- **pikepdf:** Structure tree manipulation, content stream modification
- **Node.js/TypeScript:** API orchestration, AI service integration

## Performance

- **Scan Time:** ~10-30 seconds (depends on PDF size and Adobe API response)
- **Auto-Fix Time:** ~5-15 seconds (depends on number of issues)
- **Total Time:** ~15-45 seconds for complete scan + fix

## Error Handling

- If Adobe API fails → Uses original PDF, continues with scan
- If auto-fix fails → Returns scan results without fixed PDF
- If specific fix fails → Logs error, continues with other fixes
- All errors are logged and returned to user

## Next Steps After Scan

1. **Review Issues:** User reviews detailed issue list
2. **Download Fixed PDF:** User downloads auto-fixed PDF
3. **Add to Backlog:** User can add issues to product backlog
4. **Re-Scan:** User can re-upload fixed PDF to verify improvements
5. **Export Report:** User can export compliance report




