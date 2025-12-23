#!/usr/bin/env python3
"""Complete verification of all PDF fixes"""

import fitz
import pikepdf
import sys

pdf_path = "syllabus_COMPLETE_TEST.pdf"

print("=" * 60)
print("COMPLETE PDF FIX VERIFICATION")
print("=" * 60)
print()

try:
    # Check with PyMuPDF
    print("📄 PyMuPDF Verification:")
    doc = fitz.open(pdf_path)
    catalog = doc.pdf_catalog()
    
    struct_result = doc.xref_get_key(catalog, "StructTreeRoot")
    has_struct = struct_result[0] != 0
    print(f"   ✅ StructTreeRoot: {has_struct}")
    
    markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
    has_markinfo = markinfo_result[0] != 0
    print(f"   ✅ MarkInfo exists: {has_markinfo}")
    
    if has_markinfo:
        markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
        if markinfo_xref:
            marked_result = doc.xref_get_key(markinfo_xref, "Marked")
            is_marked = marked_result[0] != 0 and marked_result[1].lower() == 'true'
            print(f"   ✅ Marked=true: {is_marked}")
    
    # Check bookmarks
    toc = doc.get_toc()
    print(f"   ✅ Bookmarks: {len(toc)} found")
    if toc:
        for b in toc[:5]:
            print(f"      Level {b[0]}: {b[1]} (page {b[2]})")
    
    doc.close()
    print()
    
    # Check with pikepdf for structure elements
    print("📊 Structure Elements Verification:")
    with pikepdf.Pdf.open(pdf_path) as pdf:
        root = pdf.Root
        struct_root = root.get('/StructTreeRoot', None)
        print(f"   ✅ StructTreeRoot exists: {struct_root is not None}")
        
        if struct_root:
            k_array = struct_root.get('/K', [])
            k_list = list(k_array) if hasattr(k_array, '__iter__') else []
            print(f"   ✅ Total structure elements: {len(k_list)}")
            print()
            
            # Count by type
            figures = 0
            tables = 0
            headings = 0
            spans = 0
            
            for elem in k_list:
                try:
                    elem_dict = pdf.get_object(elem.objgen)
                    s_type = str(elem_dict.get('/S', 'Unknown'))
                    
                    if s_type == '/Figure':
                        figures += 1
                        alt = elem_dict.get('/Alt', None)
                        if alt:
                            print(f"   ✅ Figure {figures}: Alt text = '{str(alt)[:60]}...'")
                    elif s_type == '/Table':
                        tables += 1
                        summary = elem_dict.get('/Summary', None)
                        if summary:
                            print(f"   ✅ Table {tables}: Summary = '{str(summary)[:60]}...'")
                    elif s_type.startswith('/H'):
                        headings += 1
                        if headings <= 3:  # Show first 3
                            print(f"   ✅ {s_type}: Heading structure element")
                    elif s_type == '/Span':
                        spans += 1
                        lang = elem_dict.get('/Lang', None)
                        if lang:
                            print(f"   ✅ Span: Language = {lang}")
                except Exception as e:
                    print(f"   ⚠️ Error reading element: {e}")
            
            print()
            print(f"   Summary:")
            print(f"      - Figures: {figures}")
            print(f"      - Tables: {tables}")
            print(f"      - Headings: {headings}")
            print(f"      - Language Spans: {spans}")
    
    print()
    print("=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)









