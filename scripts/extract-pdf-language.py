#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract language from PDF document catalog
Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr')
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
        catalog_ref = doc.pdf_catalog()
        
        # Check for Lang key in catalog
        lang_result = doc.xref_get_key(catalog_ref, "Lang")
        language = None
        
        if lang_result[0] != 0:  # Key exists
            lang_value = str(lang_result[1])
            # Remove leading slash if present (PDF names start with /)
            lang_value = lang_value.replace('/', '').strip()
            # Extract just the 2-letter code (remove region code like -US)
            if lang_value:
                lang_code = lang_value.split('-')[0].split('_')[0].lower()
                if len(lang_code) == 2:
                    language = lang_code
        
        doc.close()
        
        result = {
            'success': True,
            'language': language
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
        
except ImportError:
    # Fallback: try pikepdf
    try:
        import pikepdf
        
        if len(sys.argv) < 2:
            print(json.dumps({'success': False, 'error': 'No PDF path provided'}))
            sys.exit(1)
        
        pdf_path = sys.argv[1]
        
        try:
            with pikepdf.Pdf.open(pdf_path) as pdf:
                language = None
                has_viewer_prefs_lang = False
                
                # Check Root.Lang first (PDF/UA requirement)
                if '/Lang' in pdf.Root:
                    lang_obj = pdf.Root['/Lang']
                    if isinstance(lang_obj, pikepdf.Name):
                        lang_value = str(lang_obj).replace('/', '').strip()
                    else:
                        lang_value = str(lang_obj).strip()
                    
                    # Extract just the 2-letter code
                    if lang_value:
                        lang_code = lang_value.split('-')[0].split('_')[0].lower()
                        if len(lang_code) == 2:
                            language = lang_code
                
                # CRITICAL: Check ViewerPreferences.Language (Adobe requirement for Reading Options)
                # Adobe requires BOTH Root.Lang AND ViewerPreferences.Language
                if '/ViewerPreferences' in pdf.Root:
                    vp = pdf.Root['/ViewerPreferences']
                    if isinstance(vp, pikepdf.Dictionary) and '/Language' in vp:
                        has_viewer_prefs_lang = True
                        # If Root.Lang exists but ViewerPreferences.Language doesn't, Adobe will fail
                        # So we should return None to trigger UI warning
                        if not language:
                            # Fallback: use ViewerPreferences if Root.Lang doesn't exist
                            lang_obj = vp['/Language']
                            # ViewerPreferences.Language can be String or Name
                            if isinstance(lang_obj, pikepdf.Name):
                                lang_value = str(lang_obj).replace('/', '').strip()
                            elif isinstance(lang_obj, pikepdf.String):
                                lang_value = str(lang_obj).strip()
                            else:
                                lang_value = str(lang_obj).strip()
                            if lang_value:
                                lang_code = lang_value.split('-')[0].split('_')[0].lower()
                                if len(lang_code) == 2:
                                    language = lang_code
                
                # Adobe requires ViewerPreferences.Language - if Root.Lang exists but ViewerPreferences doesn't, fail
                if language and not has_viewer_prefs_lang:
                    # Root.Lang exists but ViewerPreferences.Language is missing - Adobe will fail
                    # Return None to trigger UI warning
                    language = None
            
            result = {
                'success': True,
                'language': language
            }
            
            print(json.dumps(result))
            
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))
            sys.exit(1)
            
    except ImportError:
        print(json.dumps({'success': False, 'error': 'Neither PyMuPDF nor pikepdf is available'}))
        sys.exit(1)



