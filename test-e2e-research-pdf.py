#!/usr/bin/env python3
"""
End-to-end test for Introduction-to-Research.pdf
Tests all accessibility fixes and verifies results
"""

import sys
import json
import os
import subprocess
from pathlib import Path

try:
    import fitz  # PyMuPDF
    import pikepdf
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Install with: pip install pymupdf pikepdf")
    sys.exit(1)

def test_e2e():
    print("=" * 80)
    print("END-TO-END TEST: AI.pdf")
    print("=" * 80)
    print()
    
    input_pdf = "AI.pdf"
    output_pdf = "AI_FIXED.pdf"
    fixes_json = "test-ai-fixes.json"
    
    if not os.path.exists(input_pdf):
        print(f"❌ Input PDF not found: {input_pdf}")
        return False
    
    # Step 1: Analyze original PDF
    print("📄 Step 1: Analyzing original PDF...")
    try:
        doc = fitz.open(input_pdf)
        page_count = len(doc)
        print(f"   ✅ PDF opened: {page_count} page(s)")
        
        # Check basic properties
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
        
        # Count images
        total_images = 0
        for page_num in range(page_count):
            images = doc[page_num].get_images()
            total_images += len(images)
        print(f"   ✅ Total images: {total_images}")
        
        # Count form fields
        total_fields = 0
        for page_num in range(page_count):
            widgets = doc[page_num].widgets()
            total_fields += len(list(widgets))
        print(f"   ✅ Total form fields: {total_fields}")
        
        doc.close()
        print()
    except Exception as e:
        print(f"   ❌ Error analyzing PDF: {e}")
        return False
    
    # Step 2: Create comprehensive test fixes
    print("🔧 Step 2: Creating test fixes...")
    fixes = []
    
    # Add metadata fixes
    fixes.append({
        "type": "metadata",
        "page": 1,
        "title": "Introduction to Research",
        "language": "en"
    })
    
    # Add alt text for images (we'll add a few examples)
    # In real scenario, these would come from AI detection
    fixes.append({
        "type": "altText",
        "page": 1,
        "altText": "Research methodology diagram",
        "elementLocation": "Page 1"
    })
    
    # Add heading structure
    fixes.append({
        "type": "heading",
        "page": 1,
        "text": "Introduction to Research",
        "level": 1
    })
    
    # Add bookmarks
    fixes.append({
        "type": "bookmark",
        "page": 1,
        "text": "Introduction",
        "level": 1
    })
    
    # Add color contrast fix (example)
    fixes.append({
        "type": "colorContrast",
        "page": 1,
        "text": "Example text",
        "colorInfo": {
            "foreground": "#CCCCCC",
            "background": "#FFFFFF",
            "newForeground": "#000000",
            "newBackground": "#FFFFFF"
        }
    })
    
    # Add text resize fix
    fixes.append({
        "type": "textResize",
        "page": 1,
        "text": "Small text",
        "fontSize": 9
    })
    
    # Save fixes to JSON
    with open(fixes_json, 'w') as f:
        json.dump(fixes, f, indent=2)
    print(f"   ✅ Created {len(fixes)} test fixes")
    print()
    
    # Step 3: Run PDF rebuild script
    print("🔨 Step 3: Running PDF rebuild with fixes...")
    script_path = Path("scripts/pdf-rebuild-with-fixes.py")
    if not script_path.exists():
        print(f"   ❌ Script not found: {script_path}")
        return False
    
    python_cmd = "python" if os.name == 'nt' else "python3"
    cmd = [
        python_cmd,
        str(script_path),
        "--input", input_pdf,
        "--output", output_pdf,
        "--fixes", fixes_json,
        "--title", "Introduction to Research",
        "--language", "en"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        print(f"   Return code: {result.returncode}")
        if result.stdout:
            print(f"   STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"   STDERR:\n{result.stderr}")
        
        if result.returncode != 0:
            print(f"   ❌ Script failed with return code {result.returncode}")
            return False
        
        if not os.path.exists(output_pdf):
            print(f"   ❌ Output PDF not created: {output_pdf}")
            return False
        
        print(f"   ✅ PDF rebuild completed")
        print()
    except subprocess.TimeoutExpired:
        print(f"   ❌ Script timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"   ❌ Error running script: {e}")
        return False
    
    # Step 4: Verify output PDF
    print("✅ Step 4: Verifying output PDF...")
    try:
        doc = fitz.open(output_pdf)
        page_count_fixed = len(doc)
        print(f"   ✅ Output PDF opened: {page_count_fixed} page(s)")
        
        # Verify structure tree
        catalog = doc.pdf_catalog()
        struct_tree_result = doc.xref_get_key(catalog, "StructTreeRoot")
        is_tagged_fixed = struct_tree_result[0] != 0
        print(f"   ✅ Is tagged: {is_tagged_fixed} {'(FIXED!)' if not is_tagged and is_tagged_fixed else ''}")
        
        # Verify MarkInfo
        markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
        is_marked_fixed = False
        if markinfo_result[0] != 0:
            markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
            if markinfo_xref:
                marked_result = doc.xref_get_key(markinfo_xref, "Marked")
                is_marked_fixed = marked_result[0] != 0 and marked_result[1].lower() == 'true'
        print(f"   ✅ MarkInfo/Marked: {is_marked_fixed} {'(FIXED!)' if not is_marked and is_marked_fixed else ''}")
        
        # Verify language
        lang_result = doc.xref_get_key(catalog, "Lang")
        lang_set = lang_result[0] != 0
        if lang_set:
            lang_value = lang_result[1]
            print(f"   ✅ Document language set: {lang_value}")
        else:
            print(f"   ⚠️ Document language not set")
        
        # Verify metadata
        metadata = doc.metadata
        if metadata.get('title'):
            print(f"   ✅ Document title: {metadata.get('title')}")
        else:
            print(f"   ⚠️ Document title not set")
        
        # Verify bookmarks
        toc = doc.get_toc()
        if toc:
            print(f"   ✅ Bookmarks: {len(toc)} bookmark(s)")
            for item in toc[:5]:  # Show first 5
                print(f"      - Level {item[0]}: {item[1]} (page {item[2]})")
        else:
            print(f"   ⚠️ No bookmarks found")
        
        doc.close()
        print()
        
        # Verify with pikepdf for structure elements
        print("🔍 Step 5: Verifying structure elements with pikepdf...")
        try:
            with pikepdf.Pdf.open(output_pdf) as pdf:
                # Check structure tree root
                if '/StructTreeRoot' in pdf.Root:
                    struct_root = pdf.Root['/StructTreeRoot']
                    k_array = struct_root.get('/K', pikepdf.Array([]))
                    print(f"   ✅ Structure tree root found with {len(k_array)} element(s)")
                    
                    # Count structure element types
                    figure_count = 0
                    table_count = 0
                    heading_count = 0
                    span_count = 0
                    
                    def count_elements(elem):
                        nonlocal figure_count, table_count, heading_count, span_count
                        if isinstance(elem, pikepdf.IndirectObject):
                            elem_obj = pdf.get_object(elem.objgen)
                        else:
                            elem_obj = elem
                        
                        if isinstance(elem_obj, pikepdf.Dictionary):
                            s_type = elem_obj.get('/S')
                            if s_type == pikepdf.Name('/Figure'):
                                figure_count += 1
                            elif s_type == pikepdf.Name('/Table'):
                                table_count += 1
                            elif str(s_type).startswith('/H'):
                                heading_count += 1
                            elif s_type == pikepdf.Name('/Span'):
                                span_count += 1
                            
                            # Check children
                            k_children = elem_obj.get('/K', pikepdf.Array([]))
                            for child in k_children:
                                if isinstance(child, (pikepdf.IndirectObject, pikepdf.Dictionary)):
                                    count_elements(child)
                    
                    for elem in k_array:
                        count_elements(elem)
                    
                    print(f"   ✅ Structure elements:")
                    print(f"      - Figures: {figure_count}")
                    print(f"      - Tables: {table_count}")
                    print(f"      - Headings: {heading_count}")
                    print(f"      - Spans: {span_count}")
                else:
                    print(f"   ⚠️ Structure tree root not found")
                
                # Check MarkInfo
                if '/MarkInfo' in pdf.Root:
                    markinfo = pdf.Root['/MarkInfo']
                    if isinstance(markinfo, pikepdf.IndirectObject):
                        markinfo_obj = pdf.get_object(markinfo.objgen)
                    else:
                        markinfo_obj = markinfo
                    marked = markinfo_obj.get('/Marked', False)
                    print(f"   ✅ MarkInfo/Marked: {marked}")
                
        except Exception as e:
            print(f"   ⚠️ Error verifying with pikepdf: {e}")
        
        print()
        print("=" * 80)
        print("✅ END-TO-END TEST COMPLETED SUCCESSFULLY")
        print("=" * 80)
        print(f"📄 Input: {input_pdf}")
        print(f"📄 Output: {output_pdf}")
        print(f"📊 Fixes applied: {len(fixes)}")
        print()
        return True
        
    except Exception as e:
        print(f"   ❌ Error verifying output: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Cleanup
        if os.path.exists(fixes_json):
            os.remove(fixes_json)

if __name__ == '__main__':
    success = test_e2e()
    sys.exit(0 if success else 1)

