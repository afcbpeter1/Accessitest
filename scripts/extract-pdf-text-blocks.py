#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract text blocks from PDF with font information for heading detection
Returns text blocks with font size, style, and position to identify headings
"""

import sys
import json

try:
    import fitz  # PyMuPDF
    
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No PDF path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    try:
        doc = fitz.open(pdf_path)
        text_blocks = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Get text blocks with font information
            text_dict = page.get_text("dict")
            
            for block in text_dict.get("blocks", []):
                if "lines" in block:
                    for line in block["lines"]:
                        line_text = ""
                        max_font_size = 0
                        is_bold = False
                        bbox = line.get("bbox", [0, 0, 0, 0])
                        
                        for span in line.get("spans", []):
                            span_text = span.get("text", "").strip()
                            if span_text:
                                line_text += span_text + " "
                                font_size = span.get("size", 12)
                                max_font_size = max(max_font_size, font_size)
                                
                                # Check if bold (font flags or font name)
                                font_flags = span.get("flags", 0)
                                font_name = span.get("font", "").lower()
                                if font_flags & 16 or "bold" in font_name:
                                    is_bold = True
                        
                        line_text = line_text.strip()
                        if line_text and len(line_text) > 2:
                            text_blocks.append({
                                'text': line_text,
                                'page': page_num + 1,
                                'fontSize': max_font_size,
                                'isBold': is_bold,
                                'bbox': bbox,
                                'y': bbox[1] if len(bbox) > 1 else 0  # Top Y position
                            })
        
        doc.close()
        
        result = {
            'success': True,
            'textBlocks': text_blocks
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
except ImportError:
    print(json.dumps({'success': False, 'error': 'PyMuPDF (fitz) is not available'}))
    sys.exit(1)



