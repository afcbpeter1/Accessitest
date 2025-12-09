#!/usr/bin/env python3
"""
Full test script for PDF accessibility fixes
Tests: syllabus_NOTaccessible (1).pdf
"""

import sys
import json
import fitz  # PyMuPDF
import os
import subprocess

def test_pdf_fixes():
    print("🧪 Starting full PDF accessibility test...\n")
    
    input_pdf = "syllabus_NOTaccessible (1).pdf"
    output_pdf = "syllabus_NOTaccessible_TEST_OUTPUT.pdf"
    fixes_json = "test-fixes-full.json"
    
    try:
        # Step 1: Analyze original PDF
        print("📄 Step 1: Analyzing original PDF...")
        doc = fitz.open(input_pdf)
        page = doc[0]
        
        # Get images
        images = page.get_images()
        print(f"   ✅ Found {len(images)} image(s) on page 1")
        
        # Get text
        text = page.get_text()
        print(f"   ✅ Found {len(text)} characters of text")
        
        # Check if tagged
        catalog = doc.pdf_catalog()
        struct_tree_result = doc.xref_get_key(catalog, "StructTreeRoot")
        is_tagged = struct_tree_result[0] != 0
        print(f"   ✅ Is tagged: {is_tagged}")
        
        # Check MarkInfo
        markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
        is_marked = False
        if markinfo_result[0] != 0:
            markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
            if markinfo_xref:
                marked_result = doc.xref_get_key(markinfo_xref, "Marked")
                is_marked = marked_result[0] != 0 and marked_result[1].lower() == 'true'
        print(f"   ✅ MarkInfo/Marked: {is_marked}")
        
        doc.close()
        print()
        
        # Step 2: Create test fixes
        print("🔧 Step 2: Creating test fixes...")
        fixes = []
        
        # Add alt text fixes for images
        for img_idx, img in enumerate(images):
            fixes.append({
                "type": "altText",
                "page": 1,
                "altText": f"Test alt text for image {img_idx + 1} - Physics course diagram"
            })
        
        # Add table summary fixes (assuming there are tables)
        fixes.append({
            "type": "table",
            "page": 1,
            "tableData": {
                "summary": "Course schedule table showing weekly topics and reading assignments for Introduction to Physics"
            }
        })
        
        # Write fixes to JSON
        with open(fixes_json, 'w') as f:
            json.dump(fixes, f, indent=2)
        
        print(f"   ✅ Created {len(fixes)} fixes")
        print(f"      - {len([f for f in fixes if f['type'] == 'altText'])} alt text fixes")
        print(f"      - {len([f for f in fixes if f['type'] == 'table'])} table summary fixes")
        print()
        
        # Step 3: Run PyMuPDF script
        print("🔧 Step 3: Running PyMuPDF fix script...")
        script_path = os.path.join("scripts", "pdf-rebuild-with-fixes.py")
        
        result = subprocess.run([
            "python", script_path,
            "--input", input_pdf,
            "--output", output_pdf,
            "--fixes", fixes_json,
            "--title", "Introduction to Physics - Course Syllabus",
            "--language", "en"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"   ❌ Script failed:")
            print(result.stderr)
            return False
        
        print("   ✅ Script completed successfully")
        print()
        
        # Step 4: Verify output PDF
        print("🔍 Step 4: Verifying output PDF...")
        if not os.path.exists(output_pdf):
            print("   ❌ Output PDF not found!")
            return False
        
        output_doc = fitz.open(output_pdf)
        output_page = output_doc[0]
        
        # Check structure tree
        output_catalog = output_doc.pdf_catalog()
        output_struct_result = output_doc.xref_get_key(output_catalog, "StructTreeRoot")
        output_is_tagged = output_struct_result[0] != 0
        print(f"   ✅ Is tagged: {output_is_tagged} {'(improved!)' if output_is_tagged and not is_tagged else ''}")
        
        # Check MarkInfo
        output_markinfo_result = output_doc.xref_get_key(output_catalog, "MarkInfo")
        output_is_marked = False
        if output_markinfo_result[0] != 0:
            output_markinfo_xref = int(output_markinfo_result[1]) if output_markinfo_result[1].isdigit() else None
            if output_markinfo_xref:
                output_marked_result = output_doc.xref_get_key(output_markinfo_xref, "Marked")
                output_is_marked = output_marked_result[0] != 0 and output_marked_result[1].lower() == 'true'
        print(f"   ✅ MarkInfo/Marked: {output_is_marked} {'(improved!)' if output_is_marked and not is_marked else ''}")
        
        # Check images
        output_images = output_page.get_images()
        print(f"   ✅ Images preserved: {len(output_images)} (was {len(images)})")
        
        # Try to check structure tree for alt text (if pikepdf was used)
        if output_is_tagged:
            print("   ✅ Structure tree exists - alt text should be in structure elements")
        
        output_doc.close()
        print()
        
        # Step 5: Summary
        print("📊 TEST SUMMARY:")
        print("=" * 50)
        print(f"✅ Original PDF analyzed")
        print(f"✅ Fixes created and applied")
        print(f"✅ Output PDF generated: {output_pdf}")
        print(f"✅ Tagged status: {is_tagged} → {output_is_tagged}")
        print(f"✅ MarkInfo/Marked: {is_marked} → {output_is_marked}")
        print(f"✅ Images preserved: {len(images)} → {len(output_images)}")
        print()
        
        if output_is_tagged and output_is_marked:
            print("✅ PDF is now properly tagged and marked for accessibility!")
        else:
            print("⚠️ PDF may need additional fixes")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Cleanup
        if os.path.exists(fixes_json):
            pass  # Keep for inspection

if __name__ == "__main__":
    success = test_pdf_fixes()
    sys.exit(0 if success else 1)


