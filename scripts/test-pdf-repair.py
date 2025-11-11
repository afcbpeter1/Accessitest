#!/usr/bin/env python3
"""
Test script for PDF repair functionality
Creates a simple test PDF and applies structure fixes
"""

import sys
import os
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF (fitz) not installed. Install with: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

def create_test_pdf(output_path: str):
    """Create a simple test PDF with some content"""
    doc = fitz.open()  # Create new PDF
    page = doc.new_page()
    
    # Add some text that should be a heading
    page.insert_text((50, 50), "Test Document Title", fontsize=20)
    page.insert_text((50, 100), "This is a paragraph of text.")
    page.insert_text((50, 150), "Section 1", fontsize=16)
    page.insert_text((50, 200), "More paragraph text here.")
    
    # Add an image placeholder (would need actual image data)
    
    doc.save(output_path)
    doc.close()
    print(f"Created test PDF: {output_path}")

def test_repair():
    """Test the PDF repair functionality"""
    script_dir = Path(__file__).parent
    test_input = script_dir / "test-input.pdf"
    test_output = script_dir / "test-output.pdf"
    fixes_json = script_dir / "test-fixes.json"
    
    # Create test PDF
    create_test_pdf(str(test_input))
    
    # Create test fixes
    fixes = [
        {
            "type": "heading",
            "page": 1,
            "text": "Test Document Title",
            "level": 1
        },
        {
            "type": "heading",
            "page": 1,
            "text": "Section 1",
            "level": 2
        }
    ]
    
    import json
    with open(fixes_json, 'w') as f:
        json.dump(fixes, f, indent=2)
    
    # Import and run repair
    sys.path.insert(0, str(script_dir))
    from pdf_repair import repair_pdf_structure
    
    metadata = {
        "title": "Test Document",
        "language": "en"
    }
    
    success = repair_pdf_structure(
        str(test_input),
        str(test_output),
        fixes,
        metadata
    )
    
    if success:
        print("✅ Test passed! Repaired PDF created.")
        print(f"   Input: {test_input}")
        print(f"   Output: {test_output}")
    else:
        print("❌ Test failed!")
        return False
    
    # Cleanup
    if test_input.exists():
        test_input.unlink()
    if fixes_json.exists():
        fixes_json.unlink()
    
    return True

if __name__ == '__main__':
    success = test_repair()
    sys.exit(0 if success else 1)

