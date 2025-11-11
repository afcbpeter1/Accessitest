# Installation Guide - PyMuPDF Integration

## Step 1: Install Python 3.8+

### Windows
1. Download Python from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. **IMPORTANT**: Check "Add Python to PATH" during installation
4. Verify installation:
   ```powershell
   python --version
   ```

### macOS
```bash
brew install python3
```

### Linux
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip
```

## Step 2: Install PyMuPDF

### Windows (PowerShell)
```powershell
pip install pymupdf
```

### macOS/Linux
```bash
pip3 install pymupdf
```

Or use the provided script:
- Windows: `scripts\install-pymupdf.bat`
- macOS/Linux: `bash scripts/install-pymupdf.sh`

## Step 3: Verify Installation

```bash
python -c "import fitz; print(f'PyMuPDF version: {fitz.version}')"
```

Should output: `PyMuPDF version: 1.23.0` or similar

## Step 4: Test the Integration

Once Python and PyMuPDF are installed, the PDF repair service will automatically use PyMuPDF for structure fixes.

To test manually:
```bash
cd scripts
python pdf-repair.py --input test.pdf --output repaired.pdf --fixes fixes.json
```

## Troubleshooting

### "Python not found"
- Make sure Python is installed
- Add Python to your PATH environment variable
- On Windows, restart your terminal after installation

### "PyMuPDF not installed"
- Run: `pip install pymupdf` (or `pip3 install pymupdf` on macOS/Linux)
- Make sure you're using the same Python that Node.js will use

### "Module not found: fitz"
- PyMuPDF is installed as `fitz` but imported as `fitz`
- Try: `pip install --upgrade pymupdf`

## Next Steps

Once installed, the PDF repair service will:
1. Check if PyMuPDF is available
2. If available → Apply structure fixes (headings, alt text, language tags)
3. If not available → Fall back to metadata fixes only

The integration is automatic - no code changes needed after installation!

