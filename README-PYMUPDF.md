# PyMuPDF Integration for PDF Structure Tree Modifications

## Overview

We've integrated **PyMuPDF (fitz)** to actually modify PDF structure trees, which `pdf-lib` cannot do. This allows us to:

- ✅ Add heading tags (H1-H6) to PDF structure tree
- ✅ Add alt text to images
- ✅ Add language tags to text spans
- ✅ Fix table/list structure
- ✅ Preserve document layout exactly

## Installation

### 1. Install Python 3.8+ (if not already installed)

**Windows:**
```bash
# Download from python.org or use chocolatey
choco install python3
```

**macOS:**
```bash
brew install python3
```

**Linux:**
```bash
sudo apt-get install python3 python3-pip
```

### 2. Install PyMuPDF

```bash
pip install pymupdf
```

Or using the requirements file:
```bash
pip install -r scripts/requirements.txt
```

### 3. Verify Installation

```bash
python3 -c "import fitz; print(fitz.version)"
```

Should output something like: `1.23.0` or `2.0.0`

## How It Works

1. **pdf-lib** handles metadata fixes (title, language) - this works perfectly
2. **PyMuPDF** handles structure fixes (headings, alt text, language tags) - this actually modifies the PDF structure tree
3. Both are combined to create a fully repaired PDF

## Architecture

```
Document Repair Request
  ↓
pdf-lib: Apply metadata fixes (title, language)
  ↓
PyMuPDF: Apply structure fixes (headings, alt text, language tags)
  ↓
Repaired PDF with all fixes applied
```

## Files

- `src/lib/pymupdf-wrapper.ts` - Node.js wrapper that calls Python script
- `scripts/pdf-repair.py` - Python script using PyMuPDF to modify PDF structure
- `scripts/requirements.txt` - Python dependencies

## Usage

The integration is automatic. When you repair a PDF:

1. If PyMuPDF is available → Structure fixes are applied
2. If PyMuPDF is not available → Only metadata fixes are applied (fallback)

## Troubleshooting

### "PyMuPDF not available"
- Install Python 3.8+
- Install PyMuPDF: `pip install pymupdf`
- Verify: `python3 -c "import fitz; print(fitz.version)"`

### "Python script not found"
- Ensure `scripts/pdf-repair.py` exists
- Check file permissions (should be executable)

### "Structure fixes not applied"
- Check console logs for PyMuPDF errors
- Verify Python and PyMuPDF are installed correctly
- Check that fixes are being passed correctly to the Python script

## Alternative: PDFBox (Java)

If PyMuPDF doesn't work for your environment, we can switch to **PDFBox (Java)** which is even more powerful but requires Java runtime.

## Status

- ✅ PyMuPDF wrapper created
- ✅ Python script created with structure tree manipulation
- ✅ Integration with document-repair-service
- ✅ Installation scripts created (Windows & Unix)
- ✅ Test script created
- ⚠️ Needs Python 3.8+ and PyMuPDF installed
- ⚠️ Needs testing with actual PDFs to verify structure fixes are applied

## Implementation Notes

The Python script uses PyMuPDF's low-level PDF object manipulation to:
1. Access PDF catalog and structure tree root
2. Create structure elements for headings (H1-H6)
3. Add alt text to images
4. Add language tags to text spans

**Note**: PyMuPDF's API for structure tree manipulation may vary by version. The implementation includes error handling and fallbacks.

## Next Steps

1. Install Python 3.8+ and PyMuPDF (see INSTALLATION.md)
2. Test with a real PDF that has accessibility issues
3. Verify that structure fixes are actually applied (check PDF with accessibility checker)
4. If structure tree manipulation doesn't work, we may need to use PDFBox (Java) instead

