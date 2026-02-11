#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diagnose PDF compliance issues - check what Adobe sees
"""

import sys
import json

try:
    import pikepdf
except ImportError:
    print("ERROR: pikepdf not installed", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python diagnose-pdf-compliance.py <pdf-file>", file=sys.stderr)
    sys.exit(1)

pdf_path = sys.argv[1]

try:
    with pikepdf.Pdf.open(pdf_path) as pdf:
        results = {
            'structTreeRoot': False,
            'markInfo': False,
            'marked': False,
            'language': None,
            'title_info': None,
            'title_metadata': None,
            'document_wrapper': False,
            'structure_elements_count': 0,
            'mcid_count': 0,
            'issues': []
        }
        
        # Check StructTreeRoot
        if '/StructTreeRoot' in pdf.Root:
            results['structTreeRoot'] = True
            struct_root = pdf.Root['/StructTreeRoot']
            if isinstance(struct_root, pikepdf.IndirectObject):
                struct_root_obj = pdf.get_object(struct_root.objgen)
            else:
                struct_root_obj = struct_root
            
            k_array = struct_root_obj.get('/K', pikepdf.Array([]))
            results['structure_elements_count'] = len(k_array) if k_array else 0
            
            # Check for Document wrapper
            if k_array and len(k_array) > 0:
                first_child = k_array[0]
                if isinstance(first_child, pikepdf.IndirectObject):
                    first_child_obj = pdf.get_object(first_child.objgen)
                else:
                    first_child_obj = first_child
                
                if isinstance(first_child_obj, pikepdf.Dictionary):
                    s_type = first_child_obj.get('/S')
                    if s_type == pikepdf.Name('/Document'):
                        results['document_wrapper'] = True
                    else:
                        results['issues'].append('Missing Document wrapper - first child is not /Document')
            else:
                results['issues'].append('StructTreeRoot has no children (K array is empty)')
        else:
            results['issues'].append('Missing StructTreeRoot')
        
        # Check MarkInfo
        if '/MarkInfo' in pdf.Root:
            results['markInfo'] = True
            markinfo = pdf.Root['/MarkInfo']
            if isinstance(markinfo, pikepdf.IndirectObject):
                markinfo_dict = pdf.get_object(markinfo.objgen)
            else:
                markinfo_dict = markinfo
            
            marked_value = markinfo_dict.get('/Marked')
            marked_str = str(marked_value)
            if marked_value is True or marked_str == '/true' or marked_str.endswith('/true') or marked_str.lower() == 'true':
                results['marked'] = True
            else:
                results['issues'].append(f'MarkInfo/Marked is not true (value: {marked_value})')
        else:
            results['issues'].append('Missing MarkInfo')
        
        # Check Language
        if '/Lang' in pdf.Root:
            lang_value = pdf.Root['/Lang']
            lang_str = str(lang_value)
            # Remove leading slash if present
            if lang_str.startswith('/'):
                lang_str = lang_str[1:]
            results['language'] = lang_str
            if not lang_str or lang_str.lower() in ['none', 'null', '']:
                results['issues'].append('Language is empty or invalid')
        else:
            results['issues'].append('Missing /Lang in catalog')
        
        # Check Title in Info dictionary
        if '/Info' in pdf.Root:
            info_ref = pdf.Root['/Info']
            if isinstance(info_ref, pikepdf.IndirectObject):
                info_dict = pdf.get_object(info_ref.objgen)
            else:
                info_dict = info_ref
            
            if '/Title' in info_dict:
                results['title_info'] = str(info_dict['/Title'])
            else:
                results['issues'].append('Missing /Title in Info dictionary')
        else:
            results['issues'].append('Missing /Info dictionary')
        
        # Check Title in metadata (XMP)
        # Note: pikepdf doesn't directly access XMP, but we can check if it exists
        if '/Metadata' in pdf.Root:
            # XMP metadata exists, but we can't easily parse it with pikepdf
            results['title_metadata'] = 'XMP metadata exists (cannot parse with pikepdf)'
        else:
            # Title should be in Info dictionary, which we already checked
            pass
        
        # Count MCIDs in structure tree
        def count_mcids(elem, mcid_count):
            if isinstance(elem, pikepdf.IndirectObject):
                elem_obj = pdf.get_object(elem.objgen)
            else:
                elem_obj = elem
            
            if isinstance(elem_obj, pikepdf.Dictionary):
                # Check if this element has MCID
                k_array = elem_obj.get('/K', pikepdf.Array([]))
                for kid in k_array:
                    if isinstance(kid, pikepdf.IndirectObject):
                        kid_obj = pdf.get_object(kid.objgen)
                    else:
                        kid_obj = kid
                    
                    if isinstance(kid_obj, pikepdf.Dictionary):
                        kid_type = kid_obj.get('/Type')
                        if kid_type == pikepdf.Name('/MCR'):
                            mcid = kid_obj.get('/MCID')
                            if mcid is not None:
                                mcid_count[0] += 1
                        else:
                            # Recursively check children
                            count_mcids(kid, mcid_count)
            
            return mcid_count
        
        if results['structTreeRoot']:
            struct_root = pdf.Root['/StructTreeRoot']
            if isinstance(struct_root, pikepdf.IndirectObject):
                struct_root_obj = pdf.get_object(struct_root.objgen)
            else:
                struct_root_obj = struct_root
            
            k_array = struct_root_obj.get('/K', pikepdf.Array([]))
            mcid_count = [0]
            for elem in k_array:
                count_mcids(elem, mcid_count)
            results['mcid_count'] = mcid_count[0]
        
        print(json.dumps(results, indent=2))
        
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)

