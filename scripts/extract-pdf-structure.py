#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract PDF Structure Tree using PyMuPDF
This script extracts the structure tree, language attributes, and tags from a PDF
"""

import sys
import json
import fitz  # PyMuPDF
try:
    import pikepdf
    HAS_PIKEPDF = True
except ImportError:
    HAS_PIKEPDF = False

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def extract_structure_tree(pdf_path: str) -> dict:
    """
    Extract structure tree from PDF including language attributes
    """
    try:
        doc = fitz.open(pdf_path)
        structure_tree = []
        
        # Check if PDF is tagged using PyMuPDF's proper API
        # Method 1: Check PDF catalog for StructTreeRoot
        is_tagged = False
        struct_root_xref = None
        struct_root_obj = None
        
        try:
            catalog_ref = doc.pdf_catalog()
            # Check if StructTreeRoot exists in catalog
            struct_tree_result = doc.xref_get_key(catalog_ref, "StructTreeRoot")
            
            # struct_tree_result[0] can be:
            # - 1 = key found
            # - 0 = key not found  
            # - 'null' = key exists but value is null
            # - The actual value if key exists
            if struct_tree_result[0] == 1 or (struct_tree_result[0] != 0 and struct_tree_result[0] != 'null' and struct_tree_result[1] != 'null'):
                is_tagged = True
                struct_root_xref = struct_tree_result[1]
                
                # If xref is 'null', the PDF is not actually tagged
                if struct_root_xref == 'null' or struct_root_xref is None:
                    is_tagged = False
                    struct_root_xref = None
                
                # Try to get the StructTreeRoot object directly from catalog
                try:
                    catalog_obj = doc.xref_get_object(catalog_ref)
                    if isinstance(catalog_obj, dict):
                        struct_root_obj_direct = catalog_obj.get('StructTreeRoot')
                        if struct_root_obj_direct:
                            # If it's already a dict, use it directly
                            if isinstance(struct_root_obj_direct, dict):
                                struct_root_obj = struct_root_obj_direct
                            # Otherwise, try to get xref and then the object
                            elif isinstance(struct_root_obj_direct, int):
                                struct_root_xref = struct_root_obj_direct
                            elif hasattr(struct_root_obj_direct, 'objnum'):
                                struct_root_xref = struct_root_obj_direct.objnum
                except:
                    pass
                
                # Convert xref to integer if it's a string or tuple
                if struct_root_obj is None:
                    if isinstance(struct_root_xref, str):
                        try:
                            # Handle PDF reference format like "6 0 R" - extract the number
                            import re
                            match = re.match(r'(\d+)', struct_root_xref.strip())
                            if match:
                                struct_root_xref = int(match.group(1))
                            else:
                                # Try direct conversion as fallback
                                struct_root_xref = int(struct_root_xref)
                        except Exception as e:
                            print(f"DEBUG: Failed to parse struct_root_xref '{struct_root_xref}': {e}", file=sys.stderr)
                            pass
                    elif isinstance(struct_root_xref, tuple):
                        struct_root_xref = struct_root_xref[0] if len(struct_root_xref) > 0 else None
                    
                    # If we have an integer xref, get the object
                    if isinstance(struct_root_xref, int):
                        try:
                            struct_root_obj = doc.xref_get_object(struct_root_xref)
                        except:
                            pass
        except Exception as e:
            # If catalog check fails, try alternative
            pass
        
        # Method 2: Try using pikepdf to read structure tree (more reliable for pikepdf-created PDFs)
        if not is_tagged and HAS_PIKEPDF:
            try:
                with pikepdf.Pdf.open(pdf_path) as pdf:
                    if '/StructTreeRoot' in pdf.Root:
                        struct_root_pdf = pdf.Root['/StructTreeRoot']
                        is_tagged = True
                        # Get the xref from pikepdf object
                        if hasattr(struct_root_pdf, 'objgen'):
                            struct_root_xref = struct_root_pdf.objgen[0]  # xref number
                            # Try to get the object using PyMuPDF
                            try:
                                struct_root_obj = doc.xref_get_object(struct_root_xref)
                            except:
                                pass
            except:
                pass
        
        # Method 3: Check if document has structure tree using get_struct_tree
        struct_tree_root = None
        try:
            # PyMuPDF has a method to get structure tree
            if not is_tagged and hasattr(doc, 'get_struct_tree'):
                struct_tree_root = doc.get_struct_tree()
                if struct_tree_root:
                    is_tagged = True
        except:
            pass
        
        # Method 3: Check document metadata for tagged status
        if not is_tagged:
            try:
                metadata = doc.metadata
                # Some PDFs indicate tagging in metadata
                if metadata:
                    # Check if PDF has any structure elements by checking pages
                    for page_num in range(len(doc)):
                        page = doc[page_num]
                        # Check if page has structure elements
                        # This is a heuristic - if we can't detect structure tree directly
                        pass
            except:
                pass
        
        # Debug: Print what we found
        print(f"DEBUG: is_tagged={is_tagged}, struct_root_xref={struct_root_xref}, struct_root_obj={struct_root_obj is not None}", file=sys.stderr)
        
        # If PDF is not tagged, return early
        if not is_tagged and struct_root_xref is None and struct_root_obj is None:
            return {
                "success": True,
                "structureTree": [],
                "message": "No structure tree found in PDF (PDF is untagged). Use 'Prepare for Accessibility > Automatically tag for PDF' in Acrobat."
            }
        
        # If we have structure tree root (either xref or object), extract it manually
        if struct_root_obj or struct_root_xref:
            try:
                # If we don't have the object yet, try to get it
                if struct_root_obj is None and struct_root_xref:
                    # Ensure struct_root_xref is an integer xref number
                    if not isinstance(struct_root_xref, int):
                        try:
                            if isinstance(struct_root_xref, str):
                                # Handle PDF reference format like "6 0 R" - extract the number
                                import re
                                match = re.match(r'(\d+)', struct_root_xref.strip())
                                if match:
                                    struct_root_xref = int(match.group(1))
                                else:
                                    # Try direct conversion as fallback
                                    struct_root_xref = int(struct_root_xref)
                            elif isinstance(struct_root_xref, tuple) and len(struct_root_xref) > 0:
                                struct_root_xref = int(struct_root_xref[0])
                        except Exception as e:
                            print(f"DEBUG: Failed to parse struct_root_xref '{struct_root_xref}': {e}", file=sys.stderr)
                            pass
                    
                    # Try to get the object using the xref
                    # Note: PyMuPDF Document doesn't have xref_get_object, so we'll use pikepdf fallback
                    # For now, skip PyMuPDF object extraction and go straight to pikepdf
                    struct_root_obj = None
                    
                    # Fallback: Use pikepdf to extract entire structure tree if PyMuPDF failed
                    # This is necessary because pikepdf-created structure trees may not be readable by PyMuPDF
                    if struct_root_obj is None and HAS_PIKEPDF:
                        try:
                            print(f"DEBUG: Trying pikepdf to extract entire structure tree (xref={struct_root_xref})", file=sys.stderr)
                            with pikepdf.Pdf.open(pdf_path) as pdf:
                                if '/StructTreeRoot' in pdf.Root:
                                    struct_tree_root = pdf.Root['/StructTreeRoot']
                                    
                                    # Recursively extract structure tree using pikepdf
                                    def extract_pikepdf_structure(elem, depth=0, max_depth=20):
                                        """Extract structure element from pikepdf object"""
                                        if depth > max_depth:
                                            return None
                                        
                                        try:
                                            # Get the actual object - pikepdf objects are usually already resolved
                                            # but we need to handle indirect references
                                            elem_obj = elem
                                            if hasattr(elem, 'objgen'):
                                                # It's an indirect reference, get the actual object
                                                try:
                                                    elem_obj = pdf.get_object(elem.objgen)
                                                except:
                                                    elem_obj = elem
                                            
                                            if not isinstance(elem_obj, pikepdf.Dictionary):
                                                return None
                                            
                                            # Extract tag type
                                            s_type = elem_obj.get('/S')
                                            tag_type = str(s_type) if s_type else ''
                                            if tag_type.startswith('/'):
                                                tag_type = tag_type[1:]  # Remove leading /
                                            
                                            # Extract text content
                                            text = ''
                                            if '/T' in elem_obj:
                                                text = str(elem_obj['/T'])
                                            elif '/Alt' in elem_obj:
                                                text = str(elem_obj['/Alt'])
                                            
                                            # Extract language
                                            lang = None
                                            if '/Lang' in elem_obj:
                                                lang = str(elem_obj['/Lang'])
                                            
                                            # Extract MCID from MCR objects in K array
                                            mcid = None
                                            children = []
                                            k_array = elem_obj.get('/K', [])
                                            
                                            # Handle case where k_array might be an int (direct MCID) instead of a list
                                            if isinstance(k_array, int):
                                                # This is a direct MCID reference, not a list - return element without children
                                                return {
                                                    'type': tag_type,
                                                    'text': text,
                                                    'mcid': int(k_array),
                                                    'children': [],
                                                    'lang': lang
                                                }
                                            
                                            for kid in k_array:
                                                # Handle bare MCID integer (direct MCID, not a dictionary)
                                                if isinstance(kid, int):
                                                    # This is a direct MCID reference - skip or handle as needed
                                                    continue
                                                
                                                # Get the actual object if it's an indirect reference
                                                kid_obj = kid
                                                if hasattr(kid, 'objgen'):
                                                    try:
                                                        kid_obj = pdf.get_object(kid.objgen)
                                                    except:
                                                        kid_obj = kid
                                                
                                                if isinstance(kid_obj, pikepdf.Dictionary):
                                                    kid_type = kid_obj.get('/Type')
                                                    if kid_type and ('MCR' in str(kid_type) or '/MCR' in str(kid_type)):
                                                        # Extract MCID from MCR
                                                        kid_mcid = kid_obj.get('/MCID')
                                                        if kid_mcid is not None:
                                                            if mcid is None:
                                                                mcid = int(kid_mcid) if isinstance(kid_mcid, (int, float)) else kid_mcid
                                                    else:
                                                        # It's a child structure element
                                                        child_data = extract_pikepdf_structure(kid, depth + 1, max_depth)
                                                        if child_data:
                                                            children.append(child_data)
                                            
                                            # Build node data
                                            node_data = {
                                                "type": tag_type,
                                                "text": text,
                                                "language": lang,
                                                "mcid": mcid,
                                                "attributes": {
                                                    "Lang": lang,
                                                    "lang": lang,
                                                    "Language": lang,
                                                    "MCID": mcid
                                                } if lang or mcid is not None else {},
                                                "children": children if children else []
                                            }
                                            
                                            return node_data
                                        except Exception as e:
                                            print(f"DEBUG: Error extracting pikepdf element at depth {depth}: {e}", file=sys.stderr)
                                            import traceback
                                            traceback.print_exc(file=sys.stderr)
                                            return None
                                    
                                    # Extract all root children
                                    k_array = struct_tree_root.get('/K', [])
                                    structure_tree = []
                                    
                                    # Handle case where k_array might be an int instead of a list
                                    if isinstance(k_array, int):
                                        k_array = []
                                    
                                    for kid in k_array:
                                        # Get the actual object if it's an indirect reference
                                        kid_obj = kid
                                        if hasattr(kid, 'objgen'):
                                            try:
                                                kid_obj = pdf.get_object(kid.objgen)
                                            except:
                                                kid_obj = kid
                                        
                                        if isinstance(kid_obj, pikepdf.Dictionary):
                                            s_type = kid_obj.get('/S')
                                            if s_type and str(s_type) == '/Document':
                                                # Extract Document's children directly
                                                doc_k_array = kid_obj.get('/K', [])
                                                for doc_kid in doc_k_array:
                                                    child_data = extract_pikepdf_structure(doc_kid, 0, 20)
                                                    if child_data:
                                                        if isinstance(child_data, list):
                                                            structure_tree.extend(child_data)
                                                        else:
                                                            structure_tree.append(child_data)
                                            else:
                                                # Regular structure element
                                                child_data = extract_pikepdf_structure(kid, 0, 20)
                                                if child_data:
                                                    if isinstance(child_data, list):
                                                        structure_tree.extend(child_data)
                                                    else:
                                                        structure_tree.append(child_data)
                                    
                                    print(f"DEBUG: Successfully extracted {len(structure_tree)} structure elements using pikepdf", file=sys.stderr)
                                    
                                    # Close PyMuPDF doc and return the structure tree directly
                                    doc.close()
                                    return {
                                        "success": True,
                                        "structureTree": structure_tree,
                                        "message": f"Extracted {len(structure_tree)} structure elements using pikepdf"
                                    }
                        except Exception as e:
                            print(f"DEBUG: pikepdf structure tree extraction failed: {e}", file=sys.stderr)
                            import traceback
                            traceback.print_exc(file=sys.stderr)
                            pass
                
                if struct_root_obj is None:
                    # If we still don't have the object, return empty structure tree
                    print(f"DEBUG: Could not extract StructTreeRoot object (xref={struct_root_xref})", file=sys.stderr)
                    doc.close()
                    return {
                        "success": True,
                        "structureTree": [],
                        "message": "StructTreeRoot found but could not extract structure elements"
                    }
                
                # Recursively extract structure elements
                def extract_from_pdf_object(obj_ref, depth=0, max_depth=20):
                    """Extract structure tree from PDF object reference"""
                    if depth > max_depth:
                        return None
                    
                    try:
                        # Ensure obj_ref is an integer xref number
                        obj_xref = obj_ref
                        if not isinstance(obj_ref, int):
                            try:
                                if isinstance(obj_ref, str):
                                    # Handle PDF reference format like "6 0 R" - extract the number
                                    import re
                                    match = re.match(r'(\d+)', obj_ref.strip())
                                    if match:
                                        obj_xref = int(match.group(1))
                                    else:
                                        # Try direct conversion as fallback
                                        obj_xref = int(obj_ref)
                                elif isinstance(obj_ref, tuple) and len(obj_ref) > 0:
                                    obj_xref = int(obj_ref[0])
                                else:
                                    # Try to get object directly (might be a reference object)
                                    try:
                                        obj = doc.xref_get_object(obj_ref)
                                        if obj is None:
                                            return None
                                    except:
                                        return None
                            except:
                                # If conversion fails, try to get object directly
                                try:
                                    obj = doc.xref_get_object(obj_ref)
                                    if obj is None:
                                        return None
                                except:
                                    return None
                            else:
                                # Successfully converted to int
                                obj = doc.xref_get_object(obj_xref)
                        else:
                            # Already an integer
                            obj = doc.xref_get_object(obj_xref)
                        
                        if obj is None:
                            return None
                        
                        if isinstance(obj, dict):
                            # Get tag type
                            tag_type = obj.get('S')  # Structure element type
                            if tag_type:
                                tag_type = str(tag_type).replace('/', '').strip()
                            else:
                                tag_type = 'Unknown'
                            
                            # Skip Document wrapper at root level - extract its children directly
                            # Document is just a container, not actual content
                            if tag_type == 'Document' and depth == 0:
                                doc_kids = obj.get('K', [])
                                if doc_kids:
                                    all_children = []
                                    for doc_kid_ref in doc_kids:
                                        if doc_kid_ref:
                                            doc_kid_data = extract_from_pdf_object(doc_kid_ref, depth + 1, max_depth)
                                            if doc_kid_data:
                                                if isinstance(doc_kid_data, list):
                                                    all_children.extend(doc_kid_data)
                                                else:
                                                    all_children.append(doc_kid_data)
                                    return all_children if all_children else None
                                return None  # Document wrapper with no children - skip it
                            
                            # Get language
                            lang = obj.get('Lang') or obj.get('lang')
                            if lang:
                                lang = str(lang).replace('/', '').strip()
                            
                            # Get text content (ActualText or from content stream)
                            text = obj.get('ActualText') or obj.get('Alt')
                            if text:
                                text = str(text)
                            
                            # Get page number (P - Page reference)
                            page_num = obj.get('P')
                            if page_num:
                                # P is usually a page reference, extract page number
                                try:
                                    if isinstance(page_num, int):
                                        page_num = page_num
                                    else:
                                        page_num = None
                                except:
                                    page_num = None
                            
                            # Get children (K - Kids array)
                            kids = obj.get('K', [])
                            children = []
                            mcid = None  # Extract MCID from MCR objects in K array
                            
                            if isinstance(kids, list):
                                for kid_ref in kids:
                                    if kid_ref:
                                        # Check if this is an MCR (Marked Content Reference) object
                                        try:
                                            kid_obj = doc.xref_get_object(kid_ref)
                                            if isinstance(kid_obj, dict):
                                                # Check if it's an MCR object (has Type /MCR and MCID)
                                                kid_type = kid_obj.get('Type') or kid_obj.get('type')
                                                if kid_type and ('MCR' in str(kid_type) or '/MCR' in str(kid_type)):
                                                    # Extract MCID from MCR
                                                    kid_mcid = kid_obj.get('MCID') or kid_obj.get('mcid')
                                                    if kid_mcid is not None:
                                                        # Store MCID for this structure element
                                                        if mcid is None:
                                                            mcid = int(kid_mcid) if isinstance(kid_mcid, (int, float)) else kid_mcid
                                                        # MCR objects don't have children, but continue to check for more MCRs or children
                                                        continue
                                                else:
                                                    # Not an MCR, treat as child structure element
                                                    child_data = extract_from_pdf_object(kid_ref, depth + 1, max_depth)
                                                    if child_data:
                                                        if isinstance(child_data, list):
                                                            children.extend(child_data)
                                                        else:
                                                            children.append(child_data)
                                        except Exception as e:
                                            # If MCR check fails, try to extract as child structure element
                                            try:
                                                child_data = extract_from_pdf_object(kid_ref, depth + 1, max_depth)
                                                if child_data:
                                                    if isinstance(child_data, list):
                                                        children.extend(child_data)
                                                    else:
                                                        children.append(child_data)
                                            except:
                                                pass
                            
                            # Build node data
                            node_data = {
                                "type": tag_type,
                                "text": text,
                                "language": lang,
                                "mcid": mcid,  # Add MCID if found in MCR
                                "attributes": {
                                    "Lang": lang,
                                    "lang": lang,
                                    "Language": lang,
                                    "MCID": mcid  # Also add to attributes for compatibility
                                } if lang or mcid is not None else {},
                                "page": page_num,
                                "children": children
                            }
                            
                            # If no MCID in attributes but we found one, add it
                            if mcid is not None and "MCID" not in node_data["attributes"]:
                                node_data["attributes"]["MCID"] = mcid
                            
                            return node_data
                        elif isinstance(obj, list):
                            # If object is a list, process each element
                            nodes = []
                            for item in obj:
                                if item:
                                    node = extract_from_pdf_object(item, depth + 1, max_depth)
                                    if node:
                                        nodes.append(node)
                            return nodes if nodes else None
                    except Exception as e:
                        # Skip objects that can't be extracted
                        return None
                    
                    return None
                
                # Extract root structure elements
                if isinstance(struct_root_obj, dict):
                    kids = struct_root_obj.get('K', [])
                    print(f"DEBUG: Found {len(kids) if kids else 0} root children in StructTreeRoot", file=sys.stderr)
                    if kids:
                        for kid_ref in kids:
                            if kid_ref:
                                try:
                                    node_data = extract_from_pdf_object(kid_ref, 0, 20)
                                    if node_data:
                                        if isinstance(node_data, list):
                                            structure_tree.extend(node_data)
                                        else:
                                            structure_tree.append(node_data)
                                except Exception as e:
                                    # If extraction fails, try to get basic info
                                    try:
                                        kid_obj = doc.xref_get_object(kid_ref)
                                        if isinstance(kid_obj, dict):
                                            tag_type = kid_obj.get('S') or kid_obj.get('s')
                                            if tag_type:
                                                tag_type = str(tag_type).replace('/', '').strip()
                                                # If it's a Document wrapper, extract its children directly
                                                if tag_type == 'Document':
                                                    doc_kids = kid_obj.get('K', [])
                                                    if doc_kids:
                                                        for doc_kid_ref in doc_kids:
                                                            if doc_kid_ref:
                                                                try:
                                                                    doc_kid_data = extract_from_pdf_object(doc_kid_ref, 1, 20)
                                                                    if doc_kid_data:
                                                                        if isinstance(doc_kid_data, list):
                                                                            structure_tree.extend(doc_kid_data)
                                                                        else:
                                                                            structure_tree.append(doc_kid_data)
                                                                except Exception as e2:
                                                                    # If child extraction fails, try to get basic info about the child
                                                                    try:
                                                                        doc_kid_obj = doc.xref_get_object(doc_kid_ref)
                                                                        if isinstance(doc_kid_obj, dict):
                                                                            child_tag = doc_kid_obj.get('S') or doc_kid_obj.get('s')
                                                                            if child_tag:
                                                                                child_tag = str(child_tag).replace('/', '').strip()
                                                                                structure_tree.append({
                                                                                    "type": child_tag,
                                                                                    "text": None,
                                                                                    "language": None,
                                                                                    "mcid": None,
                                                                                    "attributes": {},
                                                                                    "page": None,
                                                                                    "children": []
                                                                                })
                                                                    except:
                                                                        pass
                                                else:
                                                    structure_tree.append({
                                                        "type": tag_type,
                                                        "text": None,
                                                        "language": None,
                                                        "mcid": None,
                                                        "attributes": {},
                                                        "page": None,
                                                        "children": []
                                                    })
                                    except:
                                        pass
                    else:
                        # StructTreeRoot exists but K array is empty - PDF is tagged but has no structure elements
                        # Return a minimal Document element to indicate PDF is tagged
                        structure_tree.append({
                            "type": "Document",
                            "text": None,
                            "language": None,
                            "attributes": {},
                            "page": None,
                            "children": []
                        })
                
            except Exception as e:
                # If manual extraction fails, at least confirm PDF is tagged
                # Return a minimal Document element to indicate PDF is tagged
                return {
                    "success": True,
                    "structureTree": [{
                        "type": "Document",
                        "text": None,
                        "language": None,
                        "attributes": {},
                        "page": None,
                        "children": []
                    }],
                    "message": f"PDF is tagged (StructTreeRoot found) but extraction failed: {str(e)}. PDF structure tree exists but could not be fully parsed."
                }
        
        # If we got structure tree from get_struct_tree method
        if struct_tree_root:
            def extract_node(node, parent_lang=None, depth=0, max_depth=20):
                """Recursively extract structure tree nodes"""
                if node is None or depth > max_depth:
                    return None
                
                try:
                    node_data = {
                        "type": getattr(node, 'tag', 'Unknown') if hasattr(node, 'tag') else 'Unknown',
                        "text": None,
                        "language": None,
                        "attributes": {},
                        "page": None,
                        "children": []
                    }
                    
                    # Extract language attribute
                    lang = None
                    if hasattr(node, 'lang'):
                        lang = node.lang
                    elif hasattr(node, 'attributes'):
                        attrs = node.attributes
                        if isinstance(attrs, dict):
                            lang = attrs.get('Lang') or attrs.get('lang') or attrs.get('Language')
                    
                    effective_lang = lang or parent_lang
                    if effective_lang:
                        lang_str = str(effective_lang).replace('/', '').strip()
                        node_data["language"] = lang_str
                        node_data["attributes"]["Lang"] = lang_str
                        node_data["attributes"]["lang"] = lang_str
                        node_data["attributes"]["Language"] = lang_str
                    
                    # Extract text content
                    if hasattr(node, 'content') and node.content:
                        node_data["text"] = str(node.content)
                    
                    # Extract page number
                    if hasattr(node, 'page') and node.page is not None:
                        node_data["page"] = int(node.page) + 1  # 1-based
                    
                    # Process children
                    if hasattr(node, 'children') and node.children:
                        for child in node.children:
                            child_data = extract_node(child, effective_lang, depth + 1, max_depth)
                            if child_data:
                                node_data["children"].append(child_data)
                                if not node_data["text"] and child_data.get("text"):
                                    node_data["text"] = child_data["text"]
                    
                    return node_data
                except Exception as e:
                    return None
            
            # Extract from struct_tree_root
            if hasattr(struct_tree_root, 'children') and struct_tree_root.children:
                for root_node in struct_tree_root.children:
                    node_data = extract_node(root_node)
                    if node_data:
                        structure_tree.append(node_data)
            elif struct_tree_root:
                root_data = extract_node(struct_tree_root)
                if root_data:
                    structure_tree.append(root_data)
        
        doc.close()
        
        if len(structure_tree) > 0:
            return {
                "success": True,
                "structureTree": structure_tree,
                "message": f"Extracted {len(structure_tree)} root elements from tagged PDF"
            }
        elif is_tagged:
            # PDF is tagged (StructTreeRoot exists) but structure tree is empty
            # Return a minimal Document element to indicate PDF is tagged
            return {
                "success": True,
                "structureTree": [{
                    "type": "Document",
                    "text": None,
                    "language": None,
                    "attributes": {},
                    "page": None,
                    "children": []
                }],
                "message": "PDF is tagged (StructTreeRoot found) but structure tree is empty or could not be extracted"
            }
        else:
            return {
                "success": True,
                "structureTree": [],
                "message": "No structure tree found in PDF (PDF is untagged)"
            }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "structureTree": [],
            "error": str(e),
            "traceback": traceback.format_exc(),
            "message": f"Failed to extract structure tree: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python extract-pdf-structure.py <pdf_path>"
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_structure_tree(pdf_path)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["success"] else 1)
