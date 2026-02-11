#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script to verify Document wrapper is created correctly
This script checks if the PDF structure follows PDF/UA requirements:
StructTreeRoot -> Document -> [all content elements]
"""

import sys
import json
from pathlib import Path

try:
    import pikepdf
except ImportError:
    print("ERROR: pikepdf not installed", file=sys.stderr)
    sys.exit(1)


def test_document_wrapper(pdf_path):
    """Test if Document wrapper exists and is correctly structured"""
    results = {
        'pdf_path': str(pdf_path),
        'has_struct_tree_root': False,
        'has_document_wrapper': False,
        'document_wrapper_is_first': False,
        'document_has_children': False,
        'structure_hierarchy': None,
        'issues': [],
        'passed': False
    }
    
    try:
        with pikepdf.Pdf.open(pdf_path) as pdf:
            # Check 1: StructTreeRoot exists
            if '/StructTreeRoot' not in pdf.Root:
                results['issues'].append("CRITICAL: StructTreeRoot missing")
                return results
            
            results['has_struct_tree_root'] = True
            
            # Get StructTreeRoot
            struct_root = pdf.Root['/StructTreeRoot']
            if hasattr(struct_root, 'objgen'):
                struct_root_obj = pdf.get_object(struct_root.objgen)
            else:
                struct_root_obj = struct_root
            
            # Check 2: K array exists and is not empty
            k_array = struct_root_obj.get('/K', pikepdf.Array([]))
            k_list = list(k_array) if k_array else []
            
            if not k_list or len(k_list) == 0:
                results['issues'].append("CRITICAL: StructTreeRoot K array is empty")
                return results
            
            # Check 3: First child is Document
            first_child = k_list[0]
            if hasattr(first_child, 'objgen'):
                first_child_obj = pdf.get_object(first_child.objgen)
            else:
                first_child_obj = first_child
            
            if not isinstance(first_child_obj, pikepdf.Dictionary):
                results['issues'].append(f"CRITICAL: First child is not a Dictionary (type: {type(first_child_obj)})")
                return results
            
            s_type = first_child_obj.get('/S')
            s_type_str = str(s_type) if s_type else None
            
            if s_type == pikepdf.Name('/Document'):
                results['has_document_wrapper'] = True
                results['document_wrapper_is_first'] = True
            else:
                results['issues'].append(f"CRITICAL: First child is {s_type_str}, not /Document")
                results['structure_hierarchy'] = {
                    'first_child_type': s_type_str,
                    'total_children': len(k_list),
                    'children_types': []
                }
                
                # List all children types
                for i, child in enumerate(k_list[:10]):  # First 10 children
                    if hasattr(child, 'objgen'):
                        child_obj = pdf.get_object(child.objgen)
                    else:
                        child_obj = child
                    if isinstance(child_obj, pikepdf.Dictionary):
                        child_type = child_obj.get('/S')
                        results['structure_hierarchy']['children_types'].append({
                            'index': i,
                            'type': str(child_type) if child_type else None
                        })
                
                return results
            
            # Check 4: Document has children
            doc_k_array = first_child_obj.get('/K', pikepdf.Array([]))
            doc_k_list = list(doc_k_array) if doc_k_array else []
            
            if doc_k_list and len(doc_k_list) > 0:
                results['document_has_children'] = True
                results['structure_hierarchy'] = {
                    'document_children_count': len(doc_k_list),
                    'first_child_type': None,
                    'sample_children_types': []
                }
                
                # Get first child type
                if doc_k_list:
                    first_doc_child = doc_k_list[0]
                    if hasattr(first_doc_child, 'objgen'):
                        first_doc_child_obj = pdf.get_object(first_doc_child.objgen)
                    else:
                        first_doc_child_obj = first_doc_child
                    if isinstance(first_doc_child_obj, pikepdf.Dictionary):
                        first_doc_child_type = first_doc_child_obj.get('/S')
                        results['structure_hierarchy']['first_child_type'] = str(first_doc_child_type) if first_doc_child_type else None
                
                # Sample children types
                for i, child in enumerate(doc_k_list[:10]):  # First 10 children
                    if hasattr(child, 'objgen'):
                        child_obj = pdf.get_object(child.objgen)
                    else:
                        child_obj = child
                    if isinstance(child_obj, pikepdf.Dictionary):
                        child_type = child_obj.get('/S')
                        results['structure_hierarchy']['sample_children_types'].append({
                            'index': i,
                            'type': str(child_type) if child_type else None
                        })
            else:
                results['issues'].append("WARNING: Document wrapper has no children")
            
            # All checks passed
            if results['has_struct_tree_root'] and results['has_document_wrapper'] and results['document_wrapper_is_first'] and results['document_has_children']:
                results['passed'] = True
            
    except Exception as e:
        results['issues'].append(f"ERROR: Test failed: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
    
    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python test-document-wrapper.py <pdf-file>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    results = test_document_wrapper(pdf_path)
    
    # Output JSON results
    print(json.dumps(results, indent=2))
    
    # Exit with error code if test failed
    if not results['passed']:
        sys.exit(1)


if __name__ == '__main__':
    main()

