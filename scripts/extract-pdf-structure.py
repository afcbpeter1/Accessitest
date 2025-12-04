#!/usr/bin/env python3
"""
Extract PDF Structure Tree using PyMuPDF
This script extracts the structure tree, language attributes, and tags from a PDF
"""

import sys
import json
import fitz  # PyMuPDF

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
        
        try:
            catalog_ref = doc.pdf_catalog()
            # Check if StructTreeRoot exists in catalog
            struct_tree_result = doc.xref_get_key(catalog_ref, "StructTreeRoot")
            
            if struct_tree_result[0] == 1:  # Key exists (1 = found)
                is_tagged = True
                struct_root_xref = struct_tree_result[1]
        except Exception as e:
            # If catalog check fails, try alternative
            pass
        
        # Method 2: Check if document has structure tree using get_struct_tree
        struct_tree_root = None
        try:
            # PyMuPDF has a method to get structure tree
            if hasattr(doc, 'get_struct_tree'):
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
        
        # If PDF is not tagged, return early
        if not is_tagged and struct_root_xref is None:
            return {
                "success": True,
                "structureTree": [],
                "message": "No structure tree found in PDF (PDF is untagged). Use 'Prepare for Accessibility > Automatically tag for PDF' in Acrobat."
            }
        
        # If we have structure tree root xref, extract it manually
        if struct_root_xref:
            try:
                # Get the structure tree root object
                struct_root_obj = doc.xref_get_object(struct_root_xref)
                
                # Recursively extract structure elements
                def extract_from_pdf_object(obj_ref, depth=0, max_depth=20):
                    """Extract structure tree from PDF object reference"""
                    if depth > max_depth:
                        return None
                    
                    try:
                        obj = doc.xref_get_object(obj_ref)
                        
                        if isinstance(obj, dict):
                            # Get tag type
                            tag_type = obj.get('S')  # Structure element type
                            if tag_type:
                                tag_type = str(tag_type).replace('/', '').strip()
                            else:
                                tag_type = 'Unknown'
                            
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
                            
                            if isinstance(kids, list):
                                for kid_ref in kids:
                                    if kid_ref:
                                        child_data = extract_from_pdf_object(kid_ref, depth + 1, max_depth)
                                        if child_data:
                                            children.append(child_data)
                            
                            # Build node data
                            node_data = {
                                "type": tag_type,
                                "text": text,
                                "language": lang,
                                "attributes": {
                                    "Lang": lang,
                                    "lang": lang,
                                    "Language": lang
                                } if lang else {},
                                "page": page_num,
                                "children": children
                            }
                            
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
                    if kids:
                        for kid_ref in kids:
                            if kid_ref:
                                node_data = extract_from_pdf_object(kid_ref, 0, 20)
                                if node_data:
                                    if isinstance(node_data, list):
                                        structure_tree.extend(node_data)
                                    else:
                                        structure_tree.append(node_data)
                
            except Exception as e:
                # If manual extraction fails, at least confirm PDF is tagged
                return {
                    "success": True,
                    "structureTree": [],
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
            return {
                "success": True,
                "structureTree": [],
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
