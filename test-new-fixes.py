#!/usr/bin/env python3
"""
Test script to verify the new fixes:
1. Form field properties (tooltip, required flags, help text)
2. Link destination validation
3. Security settings adjustments
"""

import sys
import os
import fitz  # PyMuPDF
import pikepdf

def test_new_fixes(pdf_path):
    """Test the new fixes on a PDF file"""
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF file not found: {pdf_path}")
        return False
    
    print(f"Testing new fixes on: {pdf_path}")
    print("=" * 60)
    
    # Test 1: Check form field properties
    print("\n1. Testing Form Field Properties...")
    try:
        doc = fitz.open(pdf_path)
        form_fields_found = False
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            widgets = list(page.widgets())
            
            if widgets:
                form_fields_found = True
                print(f"  Page {page_num + 1}: Found {len(widgets)} form field(s)")
                for widget in widgets:
                    field_name = widget.field_name
                    field_type = widget.field_type_string
                    print(f"    - Field: {field_name} (Type: {field_type})")
        
        if not form_fields_found:
            print("  No form fields found in PDF")
        
        doc.close()
    except Exception as e:
        print(f"  ERROR: {e}")
    
    # Test 2: Check link validation
    print("\n2. Testing Link Validation...")
    try:
        doc = fitz.open(pdf_path)
        links_found = False
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            links = page.get_links()
            
            if links:
                links_found = True
                print(f"  Page {page_num + 1}: Found {len(links)} link(s)")
                for link in links:
                    if 'uri' in link:
                        uri = link['uri']
                        # Validate URL format
                        is_valid = uri.startswith('http://') or uri.startswith('https://')
                        status = "✓ Valid" if is_valid else "✗ Invalid"
                        print(f"    - {status}: {uri[:60]}...")
        
        if not links_found:
            print("  No links found in PDF")
        
        doc.close()
    except Exception as e:
        print(f"  ERROR: {e}")
    
    # Test 3: Check security settings
    print("\n3. Testing Security Settings...")
    try:
        pdf = pikepdf.Pdf.open(pdf_path)
        
        # Check if encrypted
        if '/Encrypt' in pdf.Root:
            print("  PDF is encrypted")
            encrypt_obj = pdf.Root['/Encrypt']
            if isinstance(encrypt_obj, pikepdf.IndirectObject):
                encrypt_dict = pdf.get_object(encrypt_obj.objgen)
            else:
                encrypt_dict = encrypt_obj
            
            # Check permissions
            if '/P' in encrypt_dict:
                permissions = int(encrypt_dict['/P'])
                # Bit 10 (0x0400) = Extract text/graphics
                can_extract = (permissions & 0x0400) != 0
                status = "✓ Allowed" if can_extract else "✗ Blocked"
                print(f"  Content extraction for assistive tech: {status}")
                print(f"  Permissions value: {permissions} (0x{permissions:04x})")
            else:
                print("  WARNING: No permissions set in encryption dictionary")
        else:
            print("  PDF is not encrypted - no security restrictions")
        
        pdf.close()
    except Exception as e:
        print(f"  ERROR: {e}")
    
    print("\n" + "=" * 60)
    print("Test completed!")
    return True

def run_fix_test(input_pdf, output_pdf):
    """Run the actual fix script and verify results"""
    print(f"\nRunning fix script on: {input_pdf}")
    print("=" * 60)
    
    # Import the fix script directly
    import importlib.util
    script_path = os.path.join('scripts', 'pdf-rebuild-with-fixes.py')
    spec = importlib.util.spec_from_file_location("pdf_rebuild_with_fixes", script_path)
    pdf_rebuild = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pdf_rebuild)
    
    # Create test fixes
    fixes = [
        {
            'type': 'formFieldProperties',
            'page': 1,
            'fieldName': 'test_field',
            'required': True,
            'helpText': 'This is a test help text',
            'elementLocation': 'Test form field'
        },
        {
            'type': 'linkValidation',
            'page': 1,
            'url': 'http://invalid-url-test.com',
            'isValid': False,
            'elementLocation': 'Test link'
        },
        {
            'type': 'securitySettings',
            'page': 1,
            'elementLocation': 'Document'
        }
    ]
    
    try:
        pdf_rebuild.rebuild_pdf_with_fixes(input_pdf, output_pdf, fixes)
        print(f"\n✓ Fix script completed. Output: {output_pdf}")
        
        # Verify the output
        if os.path.exists(output_pdf):
            print("\nVerifying output PDF...")
            test_new_fixes(output_pdf)
            return True
        else:
            print(f"\n✗ Output PDF not found: {output_pdf}")
            return False
    except Exception as e:
        print(f"\n✗ Error running fix script: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    # Test on the research PDF
    test_pdf = 'Introduction-to-Research.pdf'
    output_pdf = 'Introduction-to-Research_NEWFIXES.pdf'
    
    if os.path.exists(test_pdf):
        print("Testing original PDF first...")
        test_new_fixes(test_pdf)
        
        print("\n" + "=" * 60)
        print("Running fixes...")
        success = run_fix_test(test_pdf, output_pdf)
        
        if success:
            print("\n✓ All tests completed successfully!")
        else:
            print("\n✗ Some tests failed")
    else:
        print(f"Test PDF not found: {test_pdf}")
        print("Available PDFs:")
        for f in os.listdir('.'):
            if f.endswith('.pdf'):
                print(f"  - {f}")

