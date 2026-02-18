#!/usr/bin/env python3
"""Check PDF structure for accessibility issues"""
import pikepdf
import sys

pdf_path = 'C:/Users/kirby/Accessitest/Mes_premiers_pas_en_francais_revu_le_24_9_2018_auto-fixed.pdf'

with pikepdf.Pdf.open(pdf_path) as pdf:
    print("=== PDF METADATA ===")
    print(f"Root.Lang: {pdf.Root.get('/Lang')}")
    vp = pdf.Root.get('/ViewerPreferences')
    if vp:
        print(f"ViewerPreferences.DisplayDocTitle: {vp.get('/DisplayDocTitle')}")
        print(f"ViewerPreferences.Language: {vp.get('/Language')}")
    else:
        print("ViewerPreferences: None")
    print(f"Root.Outlines: {'Yes' if '/Outlines' in pdf.Root else 'No'}")
    if '/Info' in pdf.Root and pdf.Root.Info:
        print(f"Info.Title: {pdf.Root.Info.get('/Title')}")
    
    print("\n=== STRUCTURE TREE ===")
    if '/StructTreeRoot' in pdf.Root:
        struct_root = pdf.Root.StructTreeRoot
        print("Has StructTreeRoot: Yes")
        
        def check_elements(elem_ref, depth=0, path=""):
            try:
                elem = pdf.get_object(elem_ref.objgen) if hasattr(elem_ref, 'objgen') else elem_ref
                if not isinstance(elem, pikepdf.Dictionary):
                    return []
                
                s = elem.get('/S')
                alt = elem.get('/Alt')
                t = elem.get('/T')
                k = elem.get('/K', [])
                
                results = []
                if s:
                    s_str = str(s)
                    if 'Figure' in s_str:
                        results.append({
                            'type': 'Figure',
                            'has_alt': alt is not None,
                            'alt': str(alt)[:100] if alt else None,
                            'has_text': t is not None,
                            'text': str(t)[:100] if t else None,
                            'path': path
                        })
                
                if isinstance(k, list):
                    for i, kid in enumerate(k):
                        if isinstance(kid, int):
                            continue  # MCID
                        kid_path = f"{path}/{s_str if s else '?'}[{i}]"
                        results.extend(check_elements(kid, depth+1, kid_path))
                
                return results
            except Exception as e:
                return []
        
        k = struct_root.get('/K', [])
        figures = []
        if isinstance(k, list):
            for kid in k:
                figures.extend(check_elements(kid))
        
        print(f"\nFound {len(figures)} Figure elements:")
        with_alt = sum(1 for f in figures if f.get('has_alt'))
        without_alt = len(figures) - with_alt
        print(f"  With alt text: {with_alt}")
        print(f"  Without alt text: {without_alt}")
        
        if without_alt > 0:
            print("\nFigures WITHOUT alt text:")
            for f in figures[:5]:  # Show first 5
                if not f.get('has_alt'):
                    print(f"  - {f.get('path')}")
    else:
        print("Has StructTreeRoot: No")


