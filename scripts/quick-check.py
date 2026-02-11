#!/usr/bin/env python3
import pikepdf
import json
import sys

pdf_path = sys.argv[1] if len(sys.argv) > 1 else "Introduction-to-Research_tagged-test.pdf"

with pikepdf.Pdf.open(pdf_path) as pdf:
    result = {
        'has_struct_root': '/StructTreeRoot' in pdf.Root,
        'has_markinfo': '/MarkInfo' in pdf.Root,
        'has_lang': '/Lang' in pdf.Root,
        'has_title': False
    }
    
    if '/Info' in pdf.Root:
        info = pdf.Root['/Info']
        if hasattr(info, 'objgen'):
            info_obj = pdf.get_object(info.objgen)
        else:
            info_obj = info
        result['has_title'] = '/Title' in info_obj if hasattr(info_obj, 'get') else False
    
    if result['has_struct_root']:
        sr = pdf.Root['/StructTreeRoot']
        if hasattr(sr, 'objgen'):
            sro = pdf.get_object(sr.objgen)
        else:
            sro = sr
        k = sro.get('/K', [])
        result['k_count'] = len(k) if k else 0
        result['first_is_doc'] = False
        if k and len(k) > 0:
            fc = k[0]
            if hasattr(fc, 'objgen'):
                fco = pdf.get_object(fc.objgen)
            else:
                fco = fc
            if hasattr(fco, 'get'):
                result['first_is_doc'] = fco.get('/S') == pikepdf.Name('/Document')
    
    print(json.dumps(result, indent=2))

