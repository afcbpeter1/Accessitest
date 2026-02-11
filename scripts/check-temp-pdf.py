#!/usr/bin/env python3
"""Check if temp PDF has StructTreeRoot before pikepdf processes it"""
import sys
import pikepdf

pdf_path = sys.argv[1] if len(sys.argv) > 1 else sys.argv[0]

try:
    with pikepdf.Pdf.open(pdf_path) as pdf:
        has_struct = '/StructTreeRoot' in pdf.Root
        has_markinfo = '/MarkInfo' in pdf.Root
        has_lang = '/Lang' in pdf.Root
        
        print(f"StructTreeRoot: {has_struct}")
        print(f"MarkInfo: {has_markinfo}")
        print(f"Lang: {has_lang}")
        
        if has_struct:
            sr = pdf.Root['/StructTreeRoot']
            if hasattr(sr, 'objgen'):
                sro = pdf.get_object(sr.objgen)
            else:
                sro = sr
            k = sro.get('/K', [])
            print(f"K array length: {len(k) if k else 0}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

