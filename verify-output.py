#!/usr/bin/env python3
"""Verify the output PDF has correct fixes"""

import fitz
import pikepdf
import sys

pdf_path = "syllabus_NOTaccessible_TEST_OUTPUT.pdf"

print("🔍 Verifying output PDF...\n")

try:
    # Check with PyMuPDF
    print("📄 PyMuPDF Check:")
    doc = fitz.open(pdf_path)
    catalog = doc.pdf_catalog()
    
    struct_result = doc.xref_get_key(catalog, "StructTreeRoot")
    has_struct = struct_result[0] != 0
    print(f"   StructTreeRoot: {has_struct}")
    
    markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
    has_markinfo = markinfo_result[0] != 0
    print(f"   MarkInfo exists: {has_markinfo}")
    
    if has_markinfo:
        markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
        if markinfo_xref:
            marked_result = doc.xref_get_key(markinfo_xref, "Marked")
            is_marked = marked_result[0] != 0 and marked_result[1].lower() == 'true'
            print(f"   Marked=true: {is_marked}")
    
    doc.close()
    print()
    
    # Check with pikepdf for structure elements
    print("📊 pikepdf Check:")
    with pikepdf.Pdf.open(pdf_path) as pdf:
        root = pdf.Root
        struct_root = root.get('/StructTreeRoot', None)
        print(f"   StructTreeRoot exists: {struct_root is not None}")
        
        if struct_root:
            k_array = struct_root.get('/K', [])
            print(f"   Structure elements: {len(k_array)}")
            
            # Convert to list to iterate
            k_list = list(k_array) if hasattr(k_array, '__iter__') else []
            for i, elem in enumerate(k_list[:5]):
                try:
                    elem_dict = pdf.get_object(elem.objgen)
                    s_type = str(elem_dict.get('/S', 'Unknown'))
                    alt = elem_dict.get('/Alt', None)
                    summary = elem_dict.get('/Summary', None)
                    
                    alt_str = str(alt) if alt else None
                    summary_str = str(summary) if summary else None
                    
                    print(f"   Element {i+1}: Type={s_type}")
                    if alt_str:
                        print(f"      Alt: {alt_str}")
                    if summary_str:
                        print(f"      Summary: {summary_str}")
                except Exception as e:
                    print(f"   Element {i+1}: Error reading - {e}")
    
    print("\n✅ Verification complete!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

