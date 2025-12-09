#!/usr/bin/env python3
"""
Verify the output PDF from Introduction-to-Research.pdf fixes
"""

import sys
import os

try:
    import fitz  # PyMuPDF
    import pikepdf
except ImportError:
    print("ERROR: Required libraries not installed")
    sys.exit(1)

def verify_output():
    output_pdf = "Introduction-to-Research_FIXED.pdf"
    
    if not os.path.exists(output_pdf):
        print(f"❌ Output PDF not found: {output_pdf}")
        return False
    
    print("=" * 80)
    print("VERIFICATION REPORT: Introduction-to-Research_FIXED.pdf")
    print("=" * 80)
    print()
    
    # Verify with PyMuPDF
    print("📄 PyMuPDF Verification:")
    try:
        doc = fitz.open(output_pdf)
        print(f"   ✅ PDF opened: {len(doc)} page(s)")
        
        # Check metadata
        metadata = doc.metadata
        print(f"   ✅ Title: {metadata.get('title', 'Not set')}")
        print(f"   ✅ Author: {metadata.get('author', 'Not set')}")
        
        # Check structure tree
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
        
        # Check language
        lang_result = doc.xref_get_key(catalog, "Lang")
        if lang_result[0] != 0:
            print(f"   ✅ Document language: {lang_result[1]}")
        else:
            print(f"   ⚠️ Document language not set")
        
        # Check bookmarks
        toc = doc.get_toc()
        if toc:
            print(f"   ✅ Bookmarks: {len(toc)} bookmark(s)")
        else:
            print(f"   ⚠️ No bookmarks")
        
        doc.close()
        print()
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Verify with pikepdf
    print("🔍 pikepdf Verification:")
    try:
        with pikepdf.Pdf.open(output_pdf) as pdf:
            # Check structure tree
            if '/StructTreeRoot' in pdf.Root:
                struct_root = pdf.Root['/StructTreeRoot']
                k_array = struct_root.get('/K', pikepdf.Array([]))
                print(f"   ✅ Structure tree root found")
                print(f"   ✅ Structure elements: {len(k_array)}")
                
                # Count element types
                figure_count = 0
                table_count = 0
                heading_count = 0
                span_count = 0
                
                def count_elements(elem):
                    nonlocal figure_count, table_count, heading_count, span_count
                    try:
                        if hasattr(elem, 'objgen'):
                            elem_obj = pdf.get_object(elem.objgen)
                        elif hasattr(elem, 'obj'):
                            elem_obj = elem.obj
                        else:
                            elem_obj = elem
                        
                        if isinstance(elem_obj, pikepdf.Dictionary):
                            s_type = elem_obj.get('/S')
                            if s_type:
                                s_str = str(s_type)
                                if s_str == '/Figure':
                                    figure_count += 1
                                    alt = elem_obj.get('/Alt')
                                    if alt:
                                        print(f"      - Figure with Alt: {str(alt)[:50]}...")
                                elif s_str == '/Table':
                                    table_count += 1
                                    summary = elem_obj.get('/Summary')
                                    if summary:
                                        print(f"      - Table with Summary: {str(summary)[:50]}...")
                                elif s_str.startswith('/H'):
                                    heading_count += 1
                                    print(f"      - Heading: {s_str}")
                                elif s_str == '/Span':
                                    span_count += 1
                                    lang = elem_obj.get('/Lang')
                                    if lang:
                                        print(f"      - Span with Lang: {str(lang)}")
                            
                            # Check children
                            k_children = elem_obj.get('/K', pikepdf.Array([]))
                            for child in k_children:
                                count_elements(child)
                    except Exception as e:
                        pass  # Skip errors
                
                for elem in k_array:
                    count_elements(elem)
                
                print(f"   ✅ Structure element counts:")
                print(f"      - Figures: {figure_count}")
                print(f"      - Tables: {table_count}")
                print(f"      - Headings: {heading_count}")
                print(f"      - Spans: {span_count}")
            else:
                print(f"   ⚠️ Structure tree root not found")
            
            # Check MarkInfo
            if '/MarkInfo' in pdf.Root:
                markinfo = pdf.Root['/MarkInfo']
                if hasattr(markinfo, 'objgen'):
                    markinfo_obj = pdf.get_object(markinfo.objgen)
                else:
                    markinfo_obj = markinfo
                marked = markinfo_obj.get('/Marked', False)
                print(f"   ✅ MarkInfo/Marked: {marked}")
            
            # Check language
            if '/Lang' in pdf.Root:
                lang = pdf.Root['/Lang']
                print(f"   ✅ Document language: {lang}")
        
        print()
        print("=" * 80)
        print("✅ VERIFICATION COMPLETED")
        print("=" * 80)
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = verify_output()
    sys.exit(0 if success else 1)

