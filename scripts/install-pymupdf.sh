#!/bin/bash
# Installation script for PyMuPDF

echo "Installing PyMuPDF..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Found Python version: $PYTHON_VERSION"

# Install PyMuPDF
echo "Installing PyMuPDF..."
pip3 install pymupdf

# Verify installation
echo "Verifying installation..."
python3 -c "import fitz; print(f'PyMuPDF version: {fitz.version}')"

if [ $? -eq 0 ]; then
    echo "✅ PyMuPDF installed successfully!"
else
    echo "❌ PyMuPDF installation failed"
    exit 1
fi

