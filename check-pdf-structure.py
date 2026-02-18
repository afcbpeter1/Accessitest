import pikepdf
from pikepdf import Array, Dictionary, Name
import sys

pdf_path = sys.argv[1] if len(sys.argv) > 1 else input('Enter PDF path: ')

with pikepdf.Pdf.open(pdf_path) as pdf:
    figure_num = [0]

    def inspect(elem, depth=0):
        if not isinstance(elem, Dictionary):
            return
        s = str(elem.get('/S', '')).lstrip('/')
        if s == 'Figure':
            figure_num[0] += 1
            has_alt = '/Alt' in elem
            alt_val = str(elem['/Alt'])[:50] if has_alt else 'none'
            kids = []
            if '/K' in elem:
                k = elem['/K']
                if not isinstance(k, Array):
                    k = Array([k])
                for kid in k:
                    if isinstance(kid, int):
                        kids.append(f'int(MCID={kid})')
                        continue
                    try:
                        ko = pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else kid
                        if isinstance(ko, Dictionary):
                            t = str(ko.get('/Type', '')).lstrip('/')
                            s2 = str(ko.get('/S', '')).lstrip('/')
                            kids.append(f'Dict(Type={t}, S={s2})')
                        else:
                            kids.append(f'{type(kid).__name__}')
                    except Exception as e:
                        kids.append(f'ERR:{e}')
            print(f'Figure {figure_num[0]:3d}: alt={has_alt} ({alt_val}), kids={kids}')

        if '/K' not in elem:
            return
        k = elem['/K']
        if not isinstance(k, Array):
            k = Array([k])
        for kid in k:
            if isinstance(kid, int):
                continue
            try:
                ko = pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else kid
                inspect(ko, depth + 1)
            except Exception:
                pass

    sr = pdf.Root.StructTreeRoot
    if hasattr(sr, 'objgen'):
        sr = pdf.get_object(sr.objgen)
    inspect(sr)
    print(f'\nTotal figures found: {figure_num[0]}')