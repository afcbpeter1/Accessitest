#!/usr/bin/env python3
"""Test language detection and tagging"""

import fitz
import pikepdf
import sys

pdf_path = "syllabus_ALL_FEATURES_TEST.pdf"

print("=" * 60)
print("LANGUAGE DETECTION VERIFICATION")
print("=" * 60)
print()

try:
    with pikepdf.Pdf.open(pdf_path) as pdf:
        root = pdf.Root
        struct_root = root.get('/StructTreeRoot', None)
        
        if struct_root:
            k_array = struct_root.get('/K', [])
            k_list = list(k_array) if hasattr(k_array, '__iter__') else []
            
            # Find all Span elements with language attributes
            language_spans = []
            for elem in k_list:
                try:
                    elem_dict = pdf.get_object(elem.objgen)
                    s_type = str(elem_dict.get('/S', 'Unknown'))
                    
                    if s_type == '/Span':
                        lang = elem_dict.get('/Lang', None)
                        if lang:
                            lang_str = str(lang).replace('/', '').strip()
                            language_spans.append({
                                'lang': lang_str,
                                'elem': elem_dict
                            })
                except Exception as e:
                    pass
            
            print(f"📊 Language Spans Found: {len(language_spans)}")
            if language_spans:
                for i, span in enumerate(language_spans, 1):
                    print(f"   ✅ Span {i}: Language = '{span['lang']}'")
            else:
                print("   ⚠️ No language spans found in structure tree")
                print("   Note: Language spans are only created when:")
                print("     1. Foreign language text is detected in the PDF")
                print("     2. The text matches the language fix data")
                print("     3. The language code is valid (ISO 639-1)")
            
            print()
            print("🌐 Language Detection Process:")
            print("   1. AI identifies foreign language text")
            print("   2. Returns ISO 639-1 language code (e.g., 'fr', 'es', 'de')")
            print("   3. Python script creates /Span structure element with /Lang attribute")
            print("   4. Language code is set correctly in PDF structure tree")
            
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

