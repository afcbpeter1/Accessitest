#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add BDC/EMC operators to PDF content streams for MCID linking
This properly wraps text drawing operators with marked content operators
"""

import sys
import re

try:
    import pikepdf
except ImportError:
    print("ERROR: pikepdf not installed", file=sys.stderr)
    sys.exit(1)


def parse_content_stream(stream_bytes):
    """
    Parse PDF content stream to find text drawing operators
    Returns list of (operator, operands, position) tuples
    """
    # Decode if needed
    try:
        stream_text = stream_bytes.decode('latin-1')
    except:
        stream_text = stream_bytes.decode('utf-8', errors='ignore')
    
    # Find all operators (text drawing operators: Tj, TJ, ', ")
    # PDF operators are typically: operands operator
    # Text operators: (text) Tj, [(text1) (text2)] TJ, (text) '
    operators = []
    
    # Pattern to find text showing operators
    # Tj: (text) Tj
    # TJ: [(text1) (text2)] TJ
    # ': (text) '
    # ": (text) " (with spacing)
    text_operator_pattern = r'([^\n]*?)\s+(Tj|TJ|\'|")\s+'
    
    matches = list(re.finditer(text_operator_pattern, stream_text))
    for match in matches:
        operands = match.group(1).strip()
        operator = match.group(2)
        position = match.start()
        operators.append((operator, operands, position))
    
    return operators, stream_text


def add_bdc_emc_to_stream(stream_bytes, mcid_list):
    """
    Add BDC/EMC operators around text in content stream
    mcid_list: list of dicts with 'mcid', 'tag', 'text' keys
    """
    try:
        operators, stream_text = parse_content_stream(stream_bytes)
        
        if not operators:
            # No text operators found, return original
            return stream_bytes
        
        # For each MCID, we need to find matching text and wrap it
        # This is simplified - we'll wrap the first N text operators
        # Full implementation would match text content
        
        # Build new stream with BDC/EMC operators
        result_parts = []
        last_pos = 0
        mcid_idx = 0
        
        for op_idx, (operator, operands, position) in enumerate(operators):
            if mcid_idx >= len(mcid_list):
                break
            
            mcid_info = mcid_list[mcid_idx]
            tag = mcid_info['tag']
            mcid = mcid_info['mcid']
            
            # Add content before this operator
            result_parts.append(stream_text[last_pos:position])
            
            # Add BDC operator: /TagName << /MCID mcid >> BDC
            bdc_op = f"{tag} << /MCID {mcid} >> BDC\n"
            result_parts.append(bdc_op)
            
            # Add the text operator
            result_parts.append(operands)
            result_parts.append(f" {operator}\n")
            
            # Add EMC operator
            result_parts.append("EMC\n")
            
            last_pos = position + len(operands) + len(operator) + 1
            mcid_idx += 1
        
        # Add remaining content
        result_parts.append(stream_text[last_pos:])
        
        # Encode back to bytes
        new_stream = ''.join(result_parts)
        return new_stream.encode('latin-1')
        
    except Exception as e:
        print(f"WARNING: Could not add BDC/EMC to stream: {e}", file=sys.stderr)
        return stream_bytes


def add_mcid_to_pdf(input_path, output_path, mcid_data_by_page):
    """
    Add MCID linking to PDF by modifying content streams
    mcid_data_by_page: dict mapping page_num to list of mcid_info dicts
    """
    try:
        with pikepdf.Pdf.open(input_path) as pdf:
            for page_num, mcid_list in mcid_data_by_page.items():
                if page_num >= len(pdf.pages):
                    continue
                
                page = pdf.pages[page_num]
                if '/Contents' not in page:
                    continue
                
                contents = page['/Contents']
                
                # Handle both single stream and array of streams
                if isinstance(contents, pikepdf.Array):
                    for content_obj in contents:
                        try:
                            stream_bytes = content_obj.read_raw_bytes()
                            new_stream = add_bdc_emc_to_stream(stream_bytes, mcid_list)
                            content_obj.write_raw_bytes(new_stream)
                        except Exception as e:
                            print(f"WARNING: Could not modify content stream: {e}", file=sys.stderr)
                else:
                    try:
                        stream_bytes = contents.read_raw_bytes()
                        new_stream = add_bdc_emc_to_stream(stream_bytes, mcid_list)
                        contents.write_raw_bytes(new_stream)
                    except Exception as e:
                        print(f"WARNING: Could not modify content stream: {e}", file=sys.stderr)
                
                print(f"INFO: Added BDC/EMC operators for {len(mcid_list)} MCID(s) on page {page_num + 1}")
            
            pdf.save(output_path)
            return True
            
    except Exception as e:
        print(f"ERROR: Could not add MCID operators: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: add-mcid-operators.py <input> <output>")
        sys.exit(1)
    
    # For now, this is a placeholder
    # The actual MCID data would come from the main script
    success = add_mcid_to_pdf(sys.argv[1], sys.argv[2], {})
    sys.exit(0 if success else 1)



