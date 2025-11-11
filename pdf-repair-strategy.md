# PDF Repair Strategy - Using PDFBox

## Current Problem
- `pdf-lib` can only modify metadata (title, language)
- Cannot modify PDF structure tree (headings, alt text, language tags)
- All our infrastructure (AI, OCR, parsing) is built but can't be used

## Solution: PDFBox (Java) via Node.js Child Process

### Why PDFBox?
1. **Full Structure Tree Access** - Can modify `/StructTreeRoot` directly
2. **Add Semantic Tags** - H1-H6, P, Table, List, etc.
3. **Set Alt Text** - Can add alt text to existing images
4. **Language Tags** - Can tag text spans with language attributes
5. **Modify Reading Order** - Can reorganize content structure
6. **Node.js Integration** - Can run as child process

### Implementation Plan

#### Phase 1: Setup PDFBox
1. Install Java runtime (if not already installed)
2. Download PDFBox JAR file
3. Create Node.js wrapper to call PDFBox via child process
4. Test basic structure tree modification

#### Phase 2: Implement Structure Fixes
1. **Headings**: Use PDFBox to add H1-H6 tags to identified headings
2. **Alt Text**: Use PDFBox to add alt text to images
3. **Language Tags**: Use PDFBox to tag foreign language text spans
4. **Tables**: Use PDFBox to add proper table header structure
5. **Lists**: Use PDFBox to fix list structure

#### Phase 3: Integration
1. Keep existing infrastructure (AI analysis, OCR, parsing)
2. Use PDFBox to actually APPLY the fixes
3. Preserve document exactly, only modify structure tree

### Architecture

```
Node.js (Next.js API Route)
  ↓
PDFBox Java Process (child_process)
  ↓
PDF Structure Tree Modification
  ↓
Repaired PDF with fixes applied
```

### Files to Create
1. `src/lib/pdfbox-wrapper.ts` - Node.js wrapper for PDFBox
2. `pdfbox-repair.jar` - Java application that modifies PDFs
3. Update `document-repair-service.ts` to use PDFBox for structure fixes

### Alternative: PyMuPDF (Python)
- Also very powerful
- Can modify structure tree
- Might be easier to integrate (Python is simpler than Java)
- Can run as child process from Node.js

## Recommendation
**Start with PDFBox** because:
- Most powerful and well-documented
- Can do everything we need
- Widely used in enterprise PDF processing
- Better for complex structure modifications

If PDFBox is too complex, fall back to **PyMuPDF** which is also excellent.

