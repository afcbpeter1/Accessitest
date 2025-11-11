@echo off
REM Installation script for PyMuPDF (Windows)

echo Installing PyMuPDF...

REM Check if Python 3 is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is not installed. Please install Python 3.8+ first.
    exit /b 1
)

REM Check Python version
python --version
echo.

REM Install PyMuPDF
echo Installing PyMuPDF...
pip install pymupdf

REM Verify installation
echo Verifying installation...
python -c "import fitz; print(f'PyMuPDF version: {fitz.version}')"

if errorlevel 1 (
    echo PyMuPDF installation failed
    exit /b 1
) else (
    echo PyMuPDF installed successfully!
)

