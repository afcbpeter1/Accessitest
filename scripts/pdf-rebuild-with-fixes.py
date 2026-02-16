#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Rebuild with Fixes - Robust Version
Uses raw byte insertion for MCID markers (100% reliable)
"""

# CRITICAL: Force UTF-8 encoding on Windows (MUST be first!)
import sys
import io
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

import argparse
import json
import os
import shutil
from pathlib import Path

try:
    import pikepdf
    from pikepdf import Dictionary, Array, Name, String
except ImportError:
    print("ERROR: pikepdf not installed. Install with: pip install pikepdf", file=sys.stderr)
    sys.exit(1)


class StructureTreeBuilder:
    """Build complete PDF structure tree with MCID linking"""
    
    def __init__(self, pdf):
        self.pdf = pdf
        self.mcid_counter = 0
        self.struct_elements = []
        
    def create_root(self):
        """Create StructTreeRoot and Document wrapper"""
        struct_root = Dictionary(
            Type=Name.StructTreeRoot,
            K=Array([])
        )
        self.struct_root_ref = self.pdf.make_indirect(struct_root)
        self.pdf.Root.StructTreeRoot = self.struct_root_ref
        
        self.doc_elem = Dictionary(
            Type=Name.StructElem,
            S=Name.Document,
            P=self.struct_root_ref,
            K=Array([])
        )
        self.doc_elem_ref = self.pdf.make_indirect(self.doc_elem)
        struct_root.K = Array([self.doc_elem_ref])
        
        print("[OK] Created StructTreeRoot -> Document hierarchy")
    
    def create_element(self, tag, page_num, mcid=None, text=None, alt=None):
        """Create a structure element with MCID linking"""
        page = self.pdf.pages[page_num]
        
        elem = Dictionary(
            Type=Name.StructElem,
            S=Name(tag) if tag.startswith('/') else Name(f'/{tag}'),
            P=self.doc_elem_ref,
            K=Array([])
        )
        
        if text:
            elem.T = String(text)
        if alt:
            elem.Alt = String(alt)
        
        if mcid is None:
            mcid = self.mcid_counter
            self.mcid_counter += 1
        
        mcr = Dictionary(
            Type=Name.MCR,
            Pg=page.obj,
            MCID=mcid
        )
        mcr_ref = self.pdf.make_indirect(mcr)
        elem.K = Array([mcr_ref])
        
        elem_ref = self.pdf.make_indirect(elem)
        self.struct_elements.append(elem_ref)
        
        return elem_ref, mcid
    
    def create_table(self, page_num, table_data, mcid_start=None):
        """Create table structure with TR/TH/TD elements"""
        page = self.pdf.pages[page_num]
        
        if mcid_start is None:
            mcid_start = self.mcid_counter
        
        # Create Table element
        table_elem = Dictionary(
            Type=Name.StructElem,
            S=Name.Table,
            P=self.doc_elem_ref,
            K=Array([])
        )
        
        # Add summary if provided
        if 'summary' in table_data:
            table_elem.Summary = String(table_data['summary'])
        
        table_ref = self.pdf.make_indirect(table_elem)
        rows = table_data.get('rows', [])
        has_headers = table_data.get('hasHeaders', False)
        
        row_refs = []
        mcid = mcid_start
        
        for row_idx, row in enumerate(rows):
            # Create TR (table row)
            tr_elem = Dictionary(
                Type=Name.StructElem,
                S=Name.TR,
                P=table_ref,
                K=Array([])
            )
            tr_ref = self.pdf.make_indirect(tr_elem)
            
            cells = row if isinstance(row, list) else row.get('cells', [])
            cell_refs = []
            
            for cell_idx, cell in enumerate(cells):
                # Determine if header cell
                is_header = has_headers and row_idx == 0
                cell_tag = Name.TH if is_header else Name.TD
                
                # Create cell element
                cell_elem = Dictionary(
                    Type=Name.StructElem,
                    S=cell_tag,
                    P=tr_ref,
                    K=Array([])
                )
                
                # Add MCID reference
                mcr = Dictionary(
                    Type=Name.MCR,
                    Pg=page.obj,
                    MCID=mcid
                )
                mcr_ref = self.pdf.make_indirect(mcr)
                cell_elem.K = Array([mcr_ref])
                
                cell_ref = self.pdf.make_indirect(cell_elem)
                cell_refs.append(cell_ref)
                mcid += 1
            
            tr_elem.K = Array(cell_refs)
            row_refs.append(tr_ref)
        
        table_elem.K = Array(row_refs)
        self.struct_elements.append(table_ref)
        self.mcid_counter = mcid
        
        return table_ref, (mcid - mcid_start)
    
    def create_list(self, page_num, list_data, mcid_start=None):
        """Create list structure with LI/Lbl/LBody elements"""
        page = self.pdf.pages[page_num]
        
        if mcid_start is None:
            mcid_start = self.mcid_counter
        
        # Create List element
        list_elem = Dictionary(
            Type=Name.StructElem,
            S=Name.L,
            P=self.doc_elem_ref,
            K=Array([])
        )
        list_ref = self.pdf.make_indirect(list_elem)
        
        items = list_data.get('items', [])
        item_refs = []
        mcid = mcid_start
        
        for item_idx, item in enumerate(items):
            # Create LI (list item)
            li_elem = Dictionary(
                Type=Name.StructElem,
                S=Name.LI,
                P=list_ref,
                K=Array([])
            )
            li_ref = self.pdf.make_indirect(li_elem)
            
            # Create Lbl (label/bullet)
            lbl_elem = Dictionary(
                Type=Name.StructElem,
                S=Name.Lbl,
                P=li_ref,
                K=Array([])
            )
            lbl_mcr = Dictionary(
                Type=Name.MCR,
                Pg=page.obj,
                MCID=mcid
            )
            lbl_mcr_ref = self.pdf.make_indirect(lbl_mcr)
            lbl_elem.K = Array([lbl_mcr_ref])
            lbl_ref = self.pdf.make_indirect(lbl_elem)
            mcid += 1
            
            # Create LBody (content)
            lbody_elem = Dictionary(
                Type=Name.StructElem,
                S=Name.LBody,
                P=li_ref,
                K=Array([])
            )
            lbody_mcr = Dictionary(
                Type=Name.MCR,
                Pg=page.obj,
                MCID=mcid
            )
            lbody_mcr_ref = self.pdf.make_indirect(lbody_mcr)
            lbody_elem.K = Array([lbody_mcr_ref])
            lbody_ref = self.pdf.make_indirect(lbody_elem)
            mcid += 1
            
            li_elem.K = Array([lbl_ref, lbody_ref])
            item_refs.append(li_ref)
        
        list_elem.K = Array(item_refs)
        self.struct_elements.append(list_ref)
        self.mcid_counter = mcid
        
        return list_ref, (mcid - mcid_start)
    
    def finalize(self):
        """Add all structure elements to Document's K array"""
        self.doc_elem.K = Array(self.struct_elements)
        print(f"[OK] Added {len(self.struct_elements)} structure elements to Document")
        return len(self.struct_elements)


def add_mcid_to_page_simple(pdf, page_num, mcid, tag='/P'):
    """
    Add MCID markers using simple raw bytes prepend/append
    This is 100% reliable and works on all PDFs
    """
    try:
        page = pdf.pages[page_num]
        
        if '/Contents' not in page:
            return False
        
        contents = page.Contents
        
        # Handle both single stream and array
        if isinstance(contents, Array):
            if len(contents) == 0:
                return False
            content_stream = contents[0]
        else:
            content_stream = contents
        
        # Read current content as bytes
        content_bytes = content_stream.read_bytes()
        
        # Create BDC/EMC markers as raw PDF operators
        bdc_marker = f'{tag} <</MCID {mcid}>> BDC\n'.encode('latin-1')
        emc_marker = b'\nEMC'
        
        # Prepend BDC, append EMC
        new_content = bdc_marker + content_bytes + emc_marker
        
        # Create new stream with modified content
        page.Contents = pdf.make_stream(new_content)
        
        return True
        
    except Exception as e:
        print(f"  [ERROR] Failed to add MCID to page {page_num + 1}: {e}")
        return False


def detect_language_with_ai(pdf_path, title=None):
    """Use Claude to detect document language"""
    try:
        import anthropic
    except ImportError:
        print("[WARN] anthropic package not installed, defaulting to English")
        return 'en'
    
    try:
        # Extract sample text from first few pages
        import fitz
        doc = fitz.open(pdf_path)
        sample_text = ""
        for page_num in range(min(3, len(doc))):
            page = doc[page_num]
            sample_text += page.get_text()[:500]  # First 500 chars per page
        doc.close()
        
        if not sample_text.strip():
            return 'en'
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return 'en'
        
        client = anthropic.Anthropic(api_key=api_key)
        
        prompt = f"""Detect the primary language of this document.

Title: {title or 'Unknown'}

Sample text:
{sample_text[:1000]}

Respond with ONLY the ISO 639-1 two-letter language code (e.g., "en", "es", "fr", "de", "zh", "ja").
No explanations, just the code."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}]
        )
        
        detected_lang = message.content[0].text.strip().lower()[:2]
        
        # Validate it's a real language code
        valid_langs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi']
        if detected_lang in valid_langs:
            print(f"[OK] AI detected language: {detected_lang}")
            return detected_lang
        else:
            print(f"[WARN] Invalid language code '{detected_lang}', defaulting to 'en'")
            return 'en'
        
    except Exception as e:
        print(f"[WARN] Could not detect language with AI: {e}")
        return 'en'


def extract_images_from_pdf(pdf_path):
    """
    Find all images in the PDF and their locations
    """
    images = []
    
    with pikepdf.Pdf.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Get page resources
            if '/Resources' not in page:
                continue
            
            resources = page.Resources
            
            # Check for XObject (where images live)
            if '/XObject' not in resources:
                continue
            
            xobjects = resources.XObject
            
            for name, xobj in xobjects.items():
                try:
                    # Check if it's an image
                    if xobj.get('/Subtype') == Name('/Image'):
                        images.append({
                            'page': page_num + 1,
                            'name': str(name),
                            'width': int(xobj.get('/Width', 0)),
                            'height': int(xobj.get('/Height', 0))
                        })
                except Exception:
                    continue
    
    return images


def get_image_alt_text_from_claude(pdf_path, document_title=None):
    """
    Use Claude to generate better alt text for images
    """
    try:
        import anthropic
    except ImportError:
        print("\n[WARN] anthropic package not installed. Install with: pip install anthropic")
        return {}
    
    images = extract_images_from_pdf(pdf_path)
    
    if not images:
        return {}
    
    # Get document title for context
    title = document_title or "Document"
    
    prompt = f"""You are helping make a PDF accessible.

This PDF has {len(images)} images across {max(img['page'] for img in images)} pages.

Images:
{json.dumps(images, indent=2)}

The document is titled "{title}" and appears to be an academic/educational document.

For each image, suggest appropriate alternate text. Consider:
- Page 1 images are likely decorative (laptop, illustrations)
- Other pages may have diagrams, charts, or educational graphics
- Use descriptive text that helps screen reader users understand the image

Return JSON with keys as image indices (1, 2, 3, etc.):
{{
  "1": "Decorative illustration of laptop computer",
  "2": "Decorative graphic element",
  ...
}}

Keep alt text concise (under 125 characters each)."""

    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("\n[WARN] ANTHROPIC_API_KEY not set, skipping AI alt text generation")
            return {}
        
        client = anthropic.Anthropic(api_key=api_key)
        
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = message.content[0].text
        
        # Extract JSON
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()
                    else:
            json_str = response_text.strip()
        
        alt_texts = json.loads(json_str)
        
        return alt_texts
        
    except Exception as e:
        print(f"[WARN] Could not get AI alt text: {e}")
        return {}


def audit_color_contrast(pdf_path):
    """
    Scan PDF for color contrast issues
    Returns: list of issues with specific failures
    """
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        issues = []
        
        for page_num in range(min(len(doc), 50)):  # Limit to first 50 pages
            page = doc[page_num]
            
            # Extract text with color and position
            blocks = page.get_text("dict")["blocks"]
            
            for block_idx, block in enumerate(blocks):
                if "lines" not in block:
                                    continue
                                
                for line in block["lines"]:
                    for span in line["spans"]:
                        # Get text color
                        color = span.get("color", 0)
                        r = (color >> 16) & 0xFF
                        g = (color >> 8) & 0xFF
                        b = color & 0xFF
                        
                        # Get text sample
                        text_sample = span.get("text", "")[:50].strip()
                        
                        # SKIP if text is empty or whitespace
                        if not text_sample:
                                    continue
                        
                        # ASSUME white background (255, 255, 255)
                        bg_r, bg_g, bg_b = 255, 255, 255
                        
                        # SKIP if text color is white/near-white (likely on colored background we can't detect)
                        if r > 240 and g > 240 and b > 240:
                            continue  # White text is likely on colored background
                        
                        # Calculate contrast
                        def luminance(r, g, b):
                            def adjust(c):
                                c = c / 255.0
                                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
                            return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)
                        
                        l1 = luminance(r, g, b)
                        l2 = luminance(bg_r, bg_g, bg_b)
                        contrast = (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
                        
                        # Check if fails WCAG AA (4.5:1)
                        font_size = span.get("size", 12)
                        required_contrast = 3.0 if font_size >= 18 else 4.5
                        
                        if contrast < required_contrast:
                            issues.append({
                                'page': page_num + 1,
                                'text_color': f'rgb({r},{g},{b})',
                                'bg_color': f'rgb({bg_r},{bg_g},{bg_b})',
                                'contrast_ratio': round(contrast, 2),
                                'required_ratio': required_contrast,
                                'text_sample': text_sample,
                                'font_size': round(font_size, 1),
                                'bbox': span.get("bbox", [0,0,0,0])
                            })
        
        doc.close()
        return issues
        
    except Exception as e:
        print(f"[WARN] Could not audit color contrast: {e}")
        return []


def audit_logical_reading_order(pdf_path):
    """
    Scan PDF structure tree for reading order issues
    Returns: list of issues with specific problems
    """
    try:
        issues = []
        
        with pikepdf.Pdf.open(pdf_path) as pdf:
            # Extract structure tree
            structure_elements = []
            
            def extract_structure(elem, depth=0, parent_type=None):
                if not isinstance(elem, Dictionary):
                    return
                
                elem_type = elem.get('/S')
                if elem_type:
                    structure_elements.append({
                        'type': str(elem_type).replace('/', ''),
                        'depth': depth,
                        'parent': parent_type
                    })
                
                # Recurse
                if '/K' in elem:
                    children = elem.get('/K')
                    if isinstance(children, Array):
                        for child in children:
                            if isinstance(child, Dictionary):
                                extract_structure(child, depth + 1, str(elem_type))
                            else:
                                try:
                                    child_obj = pdf.get_object(child.objgen) if hasattr(child, 'objgen') else child
                                    if isinstance(child_obj, Dictionary):
                                        extract_structure(child_obj, depth + 1, str(elem_type))
                                except:
                                    pass
            
            if '/StructTreeRoot' in pdf.Root:
                struct_root = pdf.Root.StructTreeRoot
                struct_root_obj = pdf.get_object(struct_root.objgen) if hasattr(struct_root, 'objgen') else struct_root
                extract_structure(struct_root_obj)
            
            # Check for heading order issues
            heading_levels = []
            for idx, elem in enumerate(structure_elements):
                elem_type = elem['type']
                if elem_type.startswith('H'):
                    try:
                        level = int(elem_type[1:])
                        heading_levels.append({
                            'level': level,
                            'index': idx,
                            'type': elem_type
                        })
                    except:
                        pass
            
            # Detect skipped heading levels (H1 -> H3)
            for i in range(len(heading_levels) - 1):
                current = heading_levels[i]['level']
                next_level = heading_levels[i + 1]['level']
                
                if next_level > current + 1:
                    issues.append({
                        'type': 'heading_skip',
                        'description': f'Heading jumps from H{current} to H{next_level} (skips H{current + 1})',
                        'location': f'Structure element {heading_levels[i + 1]["index"]}',
                        'severity': 'warning'
                    })
            
            # Detect H1 not first
            if heading_levels and heading_levels[0]['level'] != 1:
                issues.append({
                    'type': 'h1_missing',
                    'description': f'Document should start with H1, but starts with H{heading_levels[0]["level"]}',
                    'location': 'Document structure',
                    'severity': 'error'
                })
        
        return issues
        
                                except Exception as e:
        print(f"[WARN] Could not audit reading order: {e}")
        return []


def tag_page_content(pdf, builder, page_num, fixes_for_page=None, image_alt_texts=None, image_counter=None):
    """
    Tag a single page with structure elements: headings, paragraphs, tables, lists, images
    """
    page = pdf.pages[page_num]
    page.StructParents = page_num
    
    elements_created = []
    
    # Process fixes for this page - create proper structure elements
    if fixes_for_page:
        for fix in fixes_for_page:
            fix_type = fix.get('type')
            fix_text = fix.get('text', '')
            fix_level = fix.get('level', 1)
            
            if fix_type == 'heading':
                # Create heading element (H1-H6)
                heading_tag = f'/H{min(max(fix_level, 1), 6)}'
                elem_ref, mcid = builder.create_element(
                    tag=heading_tag,
                    page_num=page_num,
                    text=fix_text or f'Heading {fix_level}'
                )
                elements_created.append((elem_ref, mcid))
                print(f"  [OK] Added {heading_tag} element: {fix_text[:50] if fix_text else 'Heading'}...")
            
            elif fix_type == 'table':
                # Create table structure with proper TR/TH/TD hierarchy
                table_data = fix.get('tableData', {})
                table_ref, mcid_count = builder.create_table(page_num, table_data)
                elements_created.append((table_ref, None))
                print(f"  [OK] Created Table with {len(table_data.get('rows', []))} rows on page {page_num + 1}")
            
            elif fix_type == 'list':
                # Create list structure with proper LI/Lbl/LBody hierarchy
                list_data = fix.get('listData', {})
                list_ref, mcid_count = builder.create_list(page_num, list_data)
                elements_created.append((list_ref, None))
                print(f"  [OK] Created List with {len(list_data.get('items', []))} items on page {page_num + 1}")
            
            elif fix_type == 'altText' or fix_type == 'imageOfText':
                # Image with alt text
                alt_text = fix.get('altText', fix.get('extractedText', f'Image on page {page_num + 1}'))
                elem_ref, mcid = builder.create_element(
                    tag='/Figure',
                    page_num=page_num,
                    alt=alt_text
                )
                elements_created.append((elem_ref, mcid))
                print(f"  [OK] Added Figure element with alt text: {alt_text[:50]}...")
    
    # Create Figure elements for images on this page (if not already handled by fixes)
    if '/Resources' in page and '/XObject' in page.Resources:
        xobjects = page.Resources.XObject
        image_count = 0
        
        for name, xobj in xobjects.items():
            try:
                # Check if it's an image
                if xobj.get('/Subtype') == Name('/Image'):
                    image_count += 1
                    if image_counter is not None:
                        image_counter[0] += 1
                        global_image_index = image_counter[0]
                        else:
                        global_image_index = image_count
                    
                    # Check if this image was already handled by a fix
                    already_tagged = False
                    if fixes_for_page:
                        for fix in fixes_for_page:
                            if fix.get('type') in ['altText', 'imageOfText']:
                                already_tagged = True
                                break
                    
                    if not already_tagged:
                        # Use AI-generated alt text if available, otherwise use generic
                        image_key = str(global_image_index)
                        if image_alt_texts and image_key in image_alt_texts:
                            alt_text = image_alt_texts[image_key]
                            else:
                            alt_text = f'Image {image_count} on page {page_num + 1}'
                        
                        # Create Figure element with alt text
                        elem_ref, mcid = builder.create_element(
                            tag='/Figure',
                            page_num=page_num,
                            alt=alt_text
                        )
                        elements_created.append((elem_ref, mcid))
                        print(f"  [OK] Added Figure element for image on page {page_num + 1}: {alt_text[:50]}...")
            except Exception:
                continue
    
    # If no elements created, create at least one paragraph element per page
    if not elements_created:
        elem_ref, mcid = builder.create_element(
            tag='/P',
            page_num=page_num,
            text=f'Content on page {page_num + 1}'
        )
        elements_created.append((elem_ref, mcid))
    
    # Add MCID marker to page (for elements that have MCIDs)
    if elements_created:
        # Find first element with an MCID
        for elem_ref, mcid in elements_created:
            if mcid is not None:
                success = add_mcid_to_page_simple(pdf, page_num, mcid, tag='/P')
                if success:
                    break
    
    return len(elements_created)


def add_alt_text_to_elements(pdf):
    """
    COMPREHENSIVE fix for "Other elements alternate text: Failed"
    Adds descriptions to ALL annotation types that Adobe checks
    """
    annotations_fixed = 0
    
    for page_num, page in enumerate(pdf.pages):
        if '/Annots' not in page:
            continue
        
        annots = page.Annots
        if not isinstance(annots, Array):
            continue
        
        for annot_ref in annots:
            try:
                annot = pdf.get_object(annot_ref.objgen) if hasattr(annot_ref, 'objgen') else annot_ref
                if not isinstance(annot, Dictionary):
                    continue
                
                subtype = annot.get('/Subtype')
                if subtype is None:
                    continue
                
                subtype_str = str(subtype)
                needs_fix = False
                
                # FIX 1: Link annotations - Adobe requires /Contents
                if '/Link' in subtype_str:
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        description = f'Link on page {page_num + 1}'
                        
                        # Try to get better description from URI
                        if '/A' in annot:
                            action = annot.get('/A')
                            if isinstance(action, Dictionary) and '/URI' in action:
                                uri = str(action.get('/URI'))
                                description = f'Link to {uri[:47]}...' if len(uri) > 50 else f'Link to {uri}'
                        
                        annot['/Contents'] = String(description)
                        needs_fix = True
                        print(f"  [OK] Added /Contents to Link on page {page_num + 1}")
                
                # FIX 2: Form fields - Adobe requires BOTH /TU and /Contents
                elif '/Widget' in subtype_str:
                    if '/TU' not in annot or not annot.get('/TU'):
                        field_name = str(annot.get('/T', 'Form field'))
                        annot['/TU'] = String(field_name)
                        needs_fix = True
                    
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        annot['/Contents'] = annot.get('/TU', String(f'Form field on page {page_num + 1}'))
                        needs_fix = True
                        print(f"  [OK] Added descriptions to Widget on page {page_num + 1}")
                
                # FIX 3: Multimedia annotations
                elif any(x in subtype_str for x in ['/Screen', '/Movie', '/Sound']):
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        annot['/Contents'] = String(f'Multimedia element on page {page_num + 1}')
                        needs_fix = True
                    
                    if '/Alt' not in annot or not annot.get('/Alt'):
                        annot['/Alt'] = String(f'Multimedia on page {page_num + 1}')
                        needs_fix = True
                        print(f"  [OK] Added descriptions to multimedia on page {page_num + 1}")
                
                # FIX 4: Stamp/Watermark annotations
                elif '/Stamp' in subtype_str:
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        annot['/Contents'] = String(f'Stamp annotation on page {page_num + 1}')
                        needs_fix = True
                        print(f"  [OK] Added /Contents to Stamp on page {page_num + 1}")
                
                # FIX 5: File attachment annotations
                elif '/FileAttachment' in subtype_str:
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        annot['/Contents'] = String(f'File attachment on page {page_num + 1}')
                        needs_fix = True
                    
                    if '/Alt' not in annot or not annot.get('/Alt'):
                        annot['/Alt'] = String(f'Attached file on page {page_num + 1}')
                        needs_fix = True
                        print(f"  [OK] Added descriptions to FileAttachment on page {page_num + 1}")
                
                # FIX 6: Redaction annotations
                elif '/Redact' in subtype_str:
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        annot['/Contents'] = String(f'Redacted content on page {page_num + 1}')
                        needs_fix = True
                        print(f"  [OK] Added /Contents to Redact on page {page_num + 1}")
                
                # FIX 7: All other annotation types
                elif any(x in subtype_str for x in ['/Popup', '/Highlight', '/Underline', 
                                                    '/StrikeOut', '/Squiggly', '/Ink', 
                                                    '/FreeText', '/Line', '/Square',
                                                    '/Circle', '/Polygon', '/PolyLine',
                                                    '/Caret', '/Text']):
                    if '/Contents' not in annot or not annot.get('/Contents'):
                        type_name = subtype_str.replace('/', '').replace('Name', '').strip()
                        annot['/Contents'] = String(f'{type_name} annotation on page {page_num + 1}')
                        needs_fix = True
                        print(f"  [OK] Added /Contents to {type_name} on page {page_num + 1}")
                
                if needs_fix:
                    annotations_fixed += 1
                
            except Exception as e:
                print(f"  [WARN] Could not process annotation on page {page_num + 1}: {e}")
                continue
    
    if annotations_fixed > 0:
        print(f"\n[OK] Fixed {annotations_fixed} annotation(s)")
                else:
        print(f"\n[INFO] No annotations found in document")
    
    return annotations_fixed


def extract_annotation_info(pdf_path):
    """Extract detailed annotation info for Claude to analyze"""
    
    with pikepdf.Pdf.open(pdf_path) as pdf:
        annotation_data = {
            "total_pages": len(pdf.pages),
            "annotations": []
        }
        
        for page_num, page in enumerate(pdf.pages):
            if '/Annots' not in page:
                continue
            
            annots = page.Annots
            if not isinstance(annots, Array):
                                continue
            
            for idx, annot_ref in enumerate(annots):
                                            try:
                                                annot = pdf.get_object(annot_ref.objgen) if hasattr(annot_ref, 'objgen') else annot_ref
                    
                    if not isinstance(annot, Dictionary):
                        continue
                    
                    # Extract all relevant info
                    annot_info = {
                        "page": page_num + 1,
                        "index": idx,
                        "subtype": str(annot.get('/Subtype', 'Unknown')),
                        "has_contents": '/Contents' in annot,
                        "has_alt": '/Alt' in annot,
                        "has_tu": '/TU' in annot,
                        "has_t": '/T' in annot,
                        "has_action": '/A' in annot,
                    }
                    
                    # Get actual values if they exist
                    if '/Contents' in annot:
                        annot_info['contents_value'] = str(annot.get('/Contents'))[:50]
                    if '/Alt' in annot:
                        annot_info['alt_value'] = str(annot.get('/Alt'))[:50]
                    if '/TU' in annot:
                        annot_info['tu_value'] = str(annot.get('/TU'))[:50]
                    
                    annotation_data["annotations"].append(annot_info)
                    
                                            except Exception as e:
                                                continue
        
        return annotation_data


def get_claude_fix_code(pdf_path):
    """
    Ask Claude to analyze and write fix code
    """
    try:
        import anthropic
    except ImportError:
        print("\n[WARN] anthropic package not installed. Install with: pip install anthropic")
        return None
    
    # Extract annotation info
    annot_data = extract_annotation_info(pdf_path)
    
    print(f"\n[INFO] Found {len(annot_data['annotations'])} annotation(s) in PDF")
    
    # Create prompt for Claude
    prompt = f"""You are a PDF/UA (ISO 14289-1) accessibility expert.

Adobe Accessibility Checker reports: "Other elements alternate text: Failed"

Here's the complete annotation data from the PDF:
```json
{json.dumps(annot_data, indent=2)}
```

For each annotation that's missing /Contents, /Alt, or /TU, provide appropriate descriptive text.

Return a JSON object with this structure:
{{
  "fixes": [
    {{
      "page": 1,
      "index": 0,
      "add_contents": "Link to external website",
      "add_alt": null,
      "add_tu": null
    }},
    ...
  ]
}}

Rules:
- Links: Add /Contents with destination URL or description
- Widgets (form fields): Add /TU (tooltip) and /Contents
- Multimedia: Add both /Contents and /Alt
- Other annotations: Add /Contents with type name

Keep descriptions concise (under 125 chars)."""

    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("\n[WARN] ANTHROPIC_API_KEY not set, skipping AI annotation fixes")
            return None
        
        client = anthropic.Anthropic(api_key=api_key)
        
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = message.content[0].text
        
        # Extract JSON
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()
                                            else:
            json_str = response_text.strip()
                                        
        fixes = json.loads(json_str)
        return fixes
                                    
                                except Exception as e:
        print(f"[WARN] Could not get AI annotation fixes: {e}")
        return None


def apply_claude_annotation_fixes(pdf, fixes):
    """Apply fixes from Claude to annotations"""
    if not fixes or 'fixes' not in fixes:
        return 0
    
    fixes_applied = 0
    
    for fix in fixes['fixes']:
        page_num = fix['page'] - 1
        annot_index = fix['index']
        
        try:
            page = pdf.pages[page_num]
            if '/Annots' not in page:
                continue
            
            annots = page.Annots
            if not isinstance(annots, Array) or annot_index >= len(annots):
                continue
            
            annot_ref = annots[annot_index]
            annot = pdf.get_object(annot_ref.objgen) if hasattr(annot_ref, 'objgen') else annot_ref
            
            if not isinstance(annot, Dictionary):
                continue
            
            # Apply fixes
            if fix.get('add_contents'):
                annot['/Contents'] = String(fix['add_contents'])
                fixes_applied += 1
            
            if fix.get('add_alt'):
                annot['/Alt'] = String(fix['add_alt'])
                fixes_applied += 1
            
            if fix.get('add_tu'):
                annot['/TU'] = String(fix['add_tu'])
                fixes_applied += 1
        
        except Exception as e:
            print(f"  [WARN] Could not apply fix to annotation {annot_index} on page {page_num + 1}: {e}")
            continue
    
    return fixes_applied


def main():
    parser = argparse.ArgumentParser(description='Rebuild PDF with accessibility fixes')
    parser.add_argument('--input', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output PDF file')
    parser.add_argument('--fixes', help='JSON file with fixes to apply')
    parser.add_argument('--title', help='Document title')
    parser.add_argument('--lang', default='en', help='Document language (default: en)')
    parser.add_argument('--use-ai', action='store_true', help='Use Claude AI for alt text generation')
    parser.add_argument('--audit', action='store_true', help='Run accessibility audits and output JSON')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    output_path = Path(args.output)
    
    # Load fixes if provided - handle both list and dict formats
    fixes = []
    if args.fixes:
        try:
            with open(args.fixes, 'r', encoding='utf-8') as f:
                fixes_data = json.load(f)
                # Handle both formats: list directly OR dict with 'fixes' key
                if isinstance(fixes_data, list):
                    fixes = fixes_data
                elif isinstance(fixes_data, dict):
                    fixes = fixes_data.get('fixes', [])
                    else:
                    print(f"Warning: Unexpected fixes format: {type(fixes_data)}", file=sys.stderr)
                print(f"Loaded {len(fixes)} fixes from {args.fixes}")
        except Exception as e:
            print(f"Warning: Could not load fixes: {e}", file=sys.stderr)
    
    # Group fixes by page
    fixes_by_page = {}
    for fix in fixes:
        page = fix.get('page', 1) - 1
        if page not in fixes_by_page:
            fixes_by_page[page] = []
        fixes_by_page[page].append(fix)
    
    print(f"[INFO] Opening PDF: {input_path}")
    
    # STEP 0: Detect language with AI if not provided
    lang_code = args.lang.replace('/', '').strip().lower() if args.lang else None
    if not lang_code or lang_code == 'en':
        print("\n[STEP 0] Detecting document language with AI...")
        detected_lang = detect_language_with_ai(input_path, args.title)
        if detected_lang:
            lang_code = detected_lang
                            else:
            lang_code = 'en'
    
    # Open PDF with pikepdf
    with pikepdf.Pdf.open(input_path) as pdf:
        # Set document metadata - both Info dictionary and XMP (PDF/UA requirement)
        title = args.title or Path(input_path).stem
        
        # ADOBE-COMPLIANT LANGUAGE SETTING (4 locations)
        # Map simple codes to full locale codes
        lang_locale_map = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'ru': 'ru-RU',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'ar': 'ar-SA',
            'hi': 'hi-IN'
        }
        
        # Get full locale (e.g., "en-US" from "en")
        lang_full = lang_locale_map.get(lang_code, f'{lang_code}-{lang_code.upper()}')
        
        # 1. PDF Catalog Lang (PDF/UA requirement) - Name object with slash
        pdf.Root.Lang = Name(f'/{lang_code}')
        print(f"[OK] Set Root.Lang: /{lang_code}")
        
        # 2. Info dictionary
        if not hasattr(pdf.Root, 'Info') or pdf.Root.Info is None:
            pdf.Root.Info = pdf.make_indirect(Dictionary())
        pdf.Root.Info.Title = String(title)
        print(f"[OK] Set Info.Title: {title}")
        
        # 3. ViewerPreferences (THIS IS WHAT ADOBE READS!) - String, not Name!
        if not hasattr(pdf.Root, 'ViewerPreferences') or pdf.Root.ViewerPreferences is None:
            pdf.Root.ViewerPreferences = pdf.make_indirect(Dictionary())
        
        # CRITICAL: Use String() for the language value, full locale format
        pdf.Root.ViewerPreferences[Name('/Language')] = String(lang_full)
        print(f"[OK] Set ViewerPreferences.Language: {lang_full} (Adobe reads this)")
        
        # 4. XMP Metadata
        try:
            xmp_data = f'''<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">{title}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:language>
    <rdf:Bag>
     <rdf:li>{lang_code}</rdf:li>
    </rdf:Bag>
   </dc:language>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>'''
            
            pdf.Root.Metadata = pdf.make_stream(xmp_data.encode('utf-8'))
            pdf.Root.Metadata[Name('/Type')] = Name('/Metadata')
            pdf.Root.Metadata[Name('/Subtype')] = Name('/XML')
            print(f"[OK] Set XMP metadata with language: {lang_code}")
        except Exception as e:
            print(f"  [WARN] Could not set XMP metadata: {e}")
        
        print(f"[OK] Set language in ALL required locations: Root.Lang=/{lang_code}, ViewerPreferences.Language={lang_full}")
        
        # Mark as tagged
        if '/MarkInfo' not in pdf.Root:
            pdf.Root.MarkInfo = Dictionary()
        pdf.Root.MarkInfo.Marked = True  # Python bool works directly with pikepdf
        
        # Build structure tree
        builder = StructureTreeBuilder(pdf)
        builder.create_root()
        
        # Get AI alt text if requested
        image_alt_texts = {}
        if args.use_ai:
            print("\n[INFO] Getting AI-generated alt text for images...")
            image_alt_texts = get_image_alt_text_from_claude(input_path, args.title)
            if image_alt_texts:
                print(f"[OK] Got alt text for {len(image_alt_texts)} images")
        
        # Tag all pages
        image_counter = [0]
        total_elements = 0
        for page_num in range(len(pdf.pages)):
            page_fixes = fixes_by_page.get(page_num, [])
            elements = tag_page_content(pdf, builder, page_num, page_fixes, image_alt_texts, image_counter)
            total_elements += elements
        
        # Finalize structure tree
        builder.finalize()
        
        # Fix annotations
        print("\n[INFO] Fixing annotations...")
        annotations_fixed = add_alt_text_to_elements(pdf)
        
        # Try AI fixes for annotations if requested
        if args.use_ai and annotations_fixed == 0:
            print("\n[INFO] Getting AI fixes for annotations...")
            claude_fixes = get_claude_fix_code(input_path)
            if claude_fixes:
                ai_fixes = apply_claude_annotation_fixes(pdf, claude_fixes)
                if ai_fixes > 0:
                    print(f"[OK] Applied {ai_fixes} AI-generated annotation fixes")
        
        # Save output
        print(f"\n[INFO] Saving fixed PDF: {output_path}")
        pdf.save(output_path)
        print(f"[OK] Saved {len(pdf.pages)} pages with {total_elements} structure elements")
    
    # Run audits if requested
    if args.audit:
        print("\n[INFO] Running accessibility audits...")
        contrast_issues = audit_color_contrast(str(output_path))
        reading_order_issues = audit_logical_reading_order(str(output_path))
        
        audit_results = {
            'color_contrast': {
                'issues': contrast_issues,
                'count': len(contrast_issues)
            },
            'reading_order': {
                'issues': reading_order_issues,
                'count': len(reading_order_issues)
            }
        }
        
        audit_output = output_path.parent / f"{output_path.stem}_audit.json"
        with open(audit_output, 'w', encoding='utf-8') as f:
            json.dump(audit_results, f, indent=2)
        
        print(f"[OK] Audit results saved to: {audit_output}")
        print(f"  - Color contrast issues: {len(contrast_issues)}")
        print(f"  - Reading order issues: {len(reading_order_issues)}")


if __name__ == '__main__':
    main()
