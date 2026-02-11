#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check what elements are tagged in a PDF"""

import sys
import pikepdf

if len(sys.argv) < 2:
    print("Usage: python check-tagged-elements.py <pdf-file>")
    sys.exit(1)

pdf_path = sys.argv[1]

try:
    with pikepdf.Pdf.open(pdf_path) as pdf:
        print(f"Analyzing: {pdf_path}\n")
        
        # Check if tagged
        has_struct = '/StructTreeRoot' in pdf.Root
        has_markinfo = '/MarkInfo' in pdf.Root
        
        print(f"[OK] StructTreeRoot: {has_struct}")
        print(f"[OK] MarkInfo: {has_markinfo}")
        
        if has_markinfo:
            markinfo = pdf.Root['/MarkInfo']
            try:
                if hasattr(markinfo, 'objgen'):
                    markinfo_dict = pdf.get_object(markinfo.objgen)
                else:
                    markinfo_dict = markinfo
            except:
                markinfo_dict = markinfo
            marked = markinfo_dict.get('/Marked', 'Not set')
            print(f"[OK] Marked: {marked}")
        
        if has_struct:
            struct = pdf.Root['/StructTreeRoot']
            try:
                if hasattr(struct, 'objgen'):
                    struct_obj = pdf.get_object(struct.objgen)
                else:
                    struct_obj = struct
            except:
                struct_obj = struct
            
            k_array = struct_obj.get('/K', [])
            print(f"\nStructure Elements Found: {len(k_array)}\n")
            
            # Count by type
            element_types = {}
            
            def count_elements(elem, depth=0):
                try:
                    if hasattr(elem, 'objgen'):
                        elem_obj = pdf.get_object(elem.objgen)
                    else:
                        elem_obj = elem
                except:
                    elem_obj = elem
                
                if isinstance(elem_obj, pikepdf.Dictionary):
                    s_type = elem_obj.get('/S')
                    if s_type:
                        s_str = str(s_type)
                        element_types[s_str] = element_types.get(s_str, 0) + 1
                        
                        # Print element details
                        indent = "  " * depth
                        alt_text = elem_obj.get('/Alt', '')
                        summary = elem_obj.get('/Summary', '')
                        lang = elem_obj.get('/Lang', '')
                        
                        info = []
                        if alt_text:
                            info.append(f"Alt: {str(alt_text)[:50]}")
                        if summary:
                            info.append(f"Summary: {str(summary)[:50]}")
                        if lang:
                            info.append(f"Lang: {str(lang)}")
                        
                        info_str = f" ({', '.join(info)})" if info else ""
                        print(f"{indent}- {s_str}{info_str}")
                    
                    # Recurse into children
                    k_children = elem_obj.get('/K', [])
                    for child in k_children:
                        try:
                            if hasattr(child, 'objgen') or isinstance(child, pikepdf.Dictionary):
                                count_elements(child, depth + 1)
                        except:
                            pass
            
            for elem in k_array:
                count_elements(elem)
            
            print(f"\nSummary by Type:")
            for elem_type, count in sorted(element_types.items()):
                print(f"  {elem_type}: {count}")
        else:
            print("\n[ERROR] PDF is not tagged (no StructTreeRoot)")
            
except Exception as e:
    print(f"[ERROR] Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

