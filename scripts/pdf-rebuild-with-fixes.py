#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Accessibility Fixer - Combined Rebuild + Patch
Automatically detects whether input PDF already has an Adobe structure tree:
  - PATCH MODE  (Adobe auto-tagged): preserves structure, patches metadata/bookmarks/figures/tables/annotations
  - REBUILD MODE (untagged):          builds structure tree from scratch
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
from pathlib import Path

try:
    import pikepdf
    from pikepdf import Dictionary, Array, Name, String
except ImportError:
    print("ERROR: pikepdf not installed. Run: pip install pikepdf", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Language map
# ---------------------------------------------------------------------------
LANG_NAME_MAP = {
    'ar': 'Arabic', 'bg': 'Bulgarian',
    'zh': 'Chinese - Simplified', 'zh-cn': 'Chinese - Simplified', 'zh-tw': 'Chinese - Traditional',
    'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch',
    'en': 'English', 'en-ar': 'English with Arabic support', 'en-he': 'English with Hebrew support',
    'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French', 'fr-ma': 'French (Morocco)',
    'de': 'German', 'el': 'Greek', 'he': 'Hebrew', 'hu': 'Hungarian',
    'it': 'Italian', 'ja': 'Japanese', 'ko': 'Korean',
    'lv': 'Latvian', 'lt': 'Lithuanian', 'no': 'Norwegian', 'pl': 'Polish',
    'pt': 'Portuguese Brazil', 'pt-br': 'Portuguese Brazil',
    'ro': 'Romanian', 'ru': 'Russian', 'sk': 'Slovak', 'sl': 'Slovenian',
    'es': 'Spanish', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian',
}


# ===========================================================================
# SHARED UTILITIES
# ===========================================================================

def detect_language_with_ai(pdf_path, title=None):
    try:
        import anthropic, fitz
        doc = fitz.open(pdf_path)
        sample = ''.join(doc[i].get_text()[:500] for i in range(min(3, len(doc))))
        doc.close()
        if not sample.strip():
            return 'en'
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return 'en'
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model='claude-sonnet-4-20250514', max_tokens=10,
            messages=[{'role': 'user', 'content':
                f'Respond with ONLY the ISO 639-1 two-letter language code (e.g. en, fr, de):\n\nTitle: {title or ""}\n\n{sample[:800]}'}]
        )
        code = msg.content[0].text.strip().lower()[:2]
        return code if code in LANG_NAME_MAP else 'en'
    except Exception as e:
        print(f'[WARN] Language detection failed: {e}')
        return 'en'


def set_metadata(pdf, title, lang_code, lang_name):
    """Set title + language in all 4 required locations."""
    # 1. Root.Lang
    pdf.Root[Name('/Lang')] = String(lang_code)

    # 2. Info dictionary (via trailer)
    if '/Info' not in pdf.trailer or pdf.trailer['/Info'] is None:
        pdf.trailer['/Info'] = pdf.make_indirect(Dictionary())
    pdf.trailer['/Info'][Name('/Title')] = String(title)

    # 3. ViewerPreferences
    if '/ViewerPreferences' not in pdf.Root:
        pdf.Root.ViewerPreferences = pdf.make_indirect(Dictionary())
    vp = pdf.Root.ViewerPreferences
    vp[Name('/DisplayDocTitle')] = True
    vp[Name('/Language')] = String(lang_name)
    vp[Name('/PrintArea')] = Name('/MediaBox')
    vp[Name('/ViewArea')] = Name('/MediaBox')

    # 4. XMP Metadata
    try:
        xmp = f'''<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">{title}</rdf:li></rdf:Alt></dc:title>
   <dc:language><rdf:Bag><rdf:li>{lang_code}</rdf:li></rdf:Bag></dc:language>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>'''
        pdf.Root.Metadata = pdf.make_stream(xmp.encode('utf-8'))
        pdf.Root.Metadata[Name('/Type')] = Name('/Metadata')
        pdf.Root.Metadata[Name('/Subtype')] = Name('/XML')
    except Exception as e:
        print(f'  [WARN] XMP update failed: {e}')

    # Ensure MarkInfo.Marked
    if '/MarkInfo' not in pdf.Root:
        pdf.Root.MarkInfo = Dictionary()
    pdf.Root.MarkInfo.Marked = True

    print(f'[OK] Metadata: title="{title}", lang={lang_code} ({lang_name}), DisplayDocTitle=True')


def fix_annotation_tagging(pdf):
    """Add /StructParent and /Contents to annotations missing them."""
    fixed = 0
    sp_next = 0
    if '/StructTreeRoot' in pdf.Root:
        sr = pdf.Root.StructTreeRoot
        if '/ParentTree' not in sr:
            sr[Name('/ParentTree')] = pdf.make_indirect(Dictionary(Nums=Array([])))
        if '/ParentTreeNextKey' in sr:
            try:
                sp_next = int(sr['/ParentTreeNextKey'])
            except Exception:
                pass

    for page_num, page in enumerate(pdf.pages):
        if '/Annots' not in page:
            continue
        annots = page['/Annots']
        if not isinstance(annots, Array):
            continue
        for annot_ref in annots:
            try:
                annot = pdf.get_object(annot_ref.objgen) if hasattr(annot_ref, 'objgen') else annot_ref
                if not isinstance(annot, Dictionary):
                    continue
                subtype = str(annot.get('/Subtype', '')).lstrip('/')

                if '/StructParent' not in annot:
                    annot[Name('/StructParent')] = sp_next  # Native int, not pikepdf.Integer
                    sp_next += 1

                if subtype == 'Link' and '/Contents' not in annot:
                    uri = ''
                    if '/A' in annot:
                        action = annot['/A']
                        if isinstance(action, Dictionary) and '/URI' in action:
                            uri = str(action['/URI'])
                    annot[Name('/Contents')] = String(f'Link: {uri[:80]}' if uri else f'Link on page {page_num + 1}')
                    fixed += 1
                elif subtype == 'Widget':
                    if '/TU' not in annot:
                        field_name = str(annot.get('/T', f'Form field on page {page_num + 1}'))
                        annot[Name('/TU')] = String(field_name)
                        fixed += 1
                    if '/Contents' not in annot:
                        annot[Name('/Contents')] = annot.get('/TU', String(f'Form field on page {page_num + 1}'))
                        fixed += 1
                elif subtype in ('Screen', 'Movie', 'Sound'):
                    if '/Contents' not in annot:
                        annot[Name('/Contents')] = String(f'Multimedia on page {page_num + 1}')
                        fixed += 1
                    if '/Alt' not in annot:
                        annot[Name('/Alt')] = String(f'Multimedia on page {page_num + 1}')
                        fixed += 1
                else:
                    if '/Contents' not in annot:
                        annot[Name('/Contents')] = String(f'{subtype} on page {page_num + 1}')
                        fixed += 1
            except Exception as e:
                print(f'  [WARN] Annotation on page {page_num + 1}: {e}')

    if '/StructTreeRoot' in pdf.Root:
        pdf.Root.StructTreeRoot[Name('/ParentTreeNextKey')] = sp_next  # Native int

    print(f'[OK] Annotations: {fixed} fixed, {sp_next} tagged')
    return fixed


# ===========================================================================
# PATCH MODE FUNCTIONS  (operate on existing structure tree)
# ===========================================================================

def _get_page_num(pdf, elem):
    if '/Pg' in elem:
        try:
            pg_ref = elem['/Pg']
            for i, page in enumerate(pdf.pages):
                if page.obj.objgen == pg_ref.objgen:
                    return i
        except Exception:
            pass
    if '/K' in elem:
        kids = elem['/K']
        if not isinstance(kids, Array):
            kids = Array([kids])
        for kid in kids:
            try:
                ko = pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else kid
                if isinstance(ko, Dictionary) and ko.get('/Type') == Name('/MCR') and '/Pg' in ko:
                    for i, page in enumerate(pdf.pages):
                        if page.obj.objgen == ko['/Pg'].objgen:
                            return i
            except Exception:
                pass
    return 0


def _walk_tree(pdf, func, elem=None, depth=0):
    """Generic tree walker; calls func(elem) for every dict node."""
    if elem is None:
        if '/StructTreeRoot' not in pdf.Root:
            return
        root = pdf.Root.StructTreeRoot
        if hasattr(root, 'objgen'):
            root = pdf.get_object(root.objgen)
        _walk_tree(pdf, func, root, 0)
        return
    if not isinstance(elem, Dictionary):
        return
    func(elem)
    if '/K' in elem:
        kids = elem['/K']
        if not isinstance(kids, Array):
            kids = Array([kids])
        for kid in kids:
            try:
                if isinstance(kid, Dictionary):
                    _walk_tree(pdf, func, kid, depth + 1)
                elif hasattr(kid, 'objgen'):
                    ko = pdf.get_object(kid.objgen)
                    if isinstance(ko, Dictionary):
                        _walk_tree(pdf, func, ko, depth + 1)
            except Exception:
                pass


def patch_fix_bookmarks(pdf):
    """Build Outlines — from heading tags if present, otherwise page-based fallback."""
    headings = []

    def collect(elem):
        s = str(elem.get('/S', '')).lstrip('/')
        level = None
        if s == 'H':
            level = 1
        elif s.startswith('H') and len(s) >= 2:
            try:
                level = int(s[1:])
            except ValueError:
                pass
        if level is None:
            return
        text = ''
        for attr in ('/ActualText', '/T', '/Alt'):
            if attr in elem:
                text = str(elem[attr]).strip()
                if text:
                    break
        if not text:
            page = _get_page_num(pdf, elem)
            text = f'Heading level {level} on page {page + 1}'
        headings.append({'level': level, 'title': text, 'page': _get_page_num(pdf, elem)})

    _walk_tree(pdf, collect)

    # If no heading tags found, fall back to one bookmark per page
    if not headings:
        print('[INFO] Bookmarks: no H tags found, creating page-based bookmarks')
        for i, page in enumerate(pdf.pages):
            headings.append({'level': 1, 'title': f'Page {i + 1}', 'page': i})

    outline_root = pdf.make_indirect(Dictionary(
        Type=Name('/Outlines'), Count=len(headings)
    ))
    pdf.Root.Outlines = outline_root

    item_refs = []
    for h in headings:
        page = pdf.pages[h['page']]
        dest = Array([page.obj, Name('/XYZ'), None, None, None])
        item_refs.append(pdf.make_indirect(Dictionary(
            Title=String(h['title']), Dest=dest, Parent=outline_root
        )))

    for i, ref in enumerate(item_refs):
        item = pdf.get_object(ref.objgen)
        if i > 0:
            item[Name('/Prev')] = item_refs[i - 1]
        if i < len(item_refs) - 1:
            item[Name('/Next')] = item_refs[i + 1]

    outline_root[Name('/First')] = item_refs[0]
    outline_root[Name('/Last')] = item_refs[-1]
    print(f'[OK] Bookmarks: created {len(item_refs)} entries')


def patch_fix_figure_alt_text(pdf, use_ai=False, pdf_path=None, document_title=None):
    """Add /Alt to Figure elements — restructures Figure-inside-Link to Link-inside-Figure."""
    figure_count = [0]
    fixed = [0]
    restructured = [0]
    skipped_no_mcr = [0]
    ai_alts = {}

    if use_ai and pdf_path:
        try:
            import anthropic, fitz
            doc = fitz.open(pdf_path)
            images = []
            for pn, pg in enumerate(doc):
                for img in pg.get_images(full=True):
                    images.append({'page': pn + 1, 'index': len(images) + 1})
            doc.close()
            if images:
                api_key = os.getenv('ANTHROPIC_API_KEY')
                if api_key:
                    client = anthropic.Anthropic(api_key=api_key)
                    msg = client.messages.create(
                        model='claude-sonnet-4-20250514', max_tokens=1000,
                        messages=[{'role': 'user', 'content':
                            f'PDF "{document_title or "Document"}" has {len(images)} figures.\n'
                            f'Images: {json.dumps(images)}\n'
                            'Return JSON mapping figure number (1-based) to concise alt text under 125 chars.\n'
                            'Example: {"1": "Decorative illustration", "2": "Bar chart"}\n'
                            'JSON only, no markdown.'}]
                    )
                    text = msg.content[0].text.strip()
                    if text.startswith('```'):
                        text = text.split('```')[1]
                        if text.startswith('json'):
                            text = text[4:]
                    ai_alts = json.loads(text.strip())
        except Exception as e:
            print(f'  [WARN] AI alt text failed: {e}')

    def _get_struct_children(elem):
        """Return list of (ref, obj) for structural children (not MCR/OBJR/int)."""
        result = []
        if '/K' not in elem:
            return result
        kids = elem['/K']
        if not isinstance(kids, Array):
            kids = Array([kids])
        for kid in kids:
            if isinstance(kid, int):
                continue
            try:
                ko = pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else kid
                if isinstance(ko, Dictionary):
                    t = str(ko.get('/Type', '')).lstrip('/')
                    if t not in ('MCR', 'OBJR'):
                        result.append((kid, ko))
            except Exception:
                pass
        return result

    def _has_mcr(elem):
        """Return True if element has any direct MCR/OBJR/int content reference."""
        if '/K' not in elem:
            return False
        kids = elem['/K']
        if not isinstance(kids, Array):
            kids = Array([kids])
        for kid in kids:
            if isinstance(kid, int):
                return True
            try:
                ko = pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else kid
                if isinstance(ko, Dictionary):
                    t = str(ko.get('/Type', '')).lstrip('/')
                    if t in ('MCR', 'OBJR'):
                        return True
            except Exception:
                pass
        return False

    def fix_figure(elem):
        s = str(elem.get('/S', '')).lstrip('/')
        if s != 'Figure':
            return
        figure_count[0] += 1

        struct_children = _get_struct_children(elem)

        # Case 1: Figure has structural children (e.g. Link inside Figure)
        # Correct PDF/UA structure is Link > Figure, not Figure > Link
        # Fix: move Figure inside each Link child, give Figure the alt text and MCR
        if struct_children:
            alt_text = str(elem.get('/Alt', '')).strip()
            if not alt_text:
                alt_text = ai_alts.get(str(figure_count[0]), '')
            if not alt_text:
                page_n = _get_page_num(pdf, elem)
                alt_text = f'Figure {figure_count[0]} on page {page_n + 1}'

            for kid_ref, child in struct_children:
                child_s = str(child.get('/S', '')).lstrip('/')
                if child_s == 'Link':
                    try:
                        # Get the Link's current kids (MCR/content refs)
                        link_kids = child.get('/K', Array([]))
                        if not isinstance(link_kids, Array):
                            link_kids = Array([link_kids])

                        # Create a new Figure element as a child of the Link
                        # This is the correct PDF/UA structure
                        new_fig = pdf.make_indirect(Dictionary(
                            Type=Name('/StructElem'),
                            S=Name('/Figure'),
                            P=kid_ref,
                            Alt=String(alt_text),
                            K=link_kids
                        ))

                        # Update parent references on moved kids
                        for lk in link_kids:
                            if isinstance(lk, int):
                                continue
                            try:
                                lko = pdf.get_object(lk.objgen) if hasattr(lk, 'objgen') else lk
                                if isinstance(lko, Dictionary):
                                    lko[Name('/P')] = new_fig
                            except Exception:
                                pass

                        # Link now wraps the new Figure
                        child[Name('/K')] = Array([new_fig])
                        print(f'  [RESTRUCTURE] Figure {figure_count[0]}: '
                              f'created Figure inside Link with alt="{alt_text[:50]}"')
                    except Exception as e:
                        print(f'  [WARN] Restructure failed for Figure {figure_count[0]}: {e}')

            # Remove /Alt from the original outer Figure — it's now on the inner Figure
            if '/Alt' in elem:
                del elem[Name('/Alt')]

            restructured[0] += 1
            return

        # Case 2: Figure has no content reference — remove any floating alt text
        if not _has_mcr(elem):
            skipped_no_mcr[0] += 1
            if '/Alt' in elem:
                del elem[Name('/Alt')]
                print(f'  [REMOVED] Figure {figure_count[0]}: /Alt removed (no content reference)')
            return

        # Case 3: Normal leaf figure — add /Alt if missing
        if '/Alt' in elem and str(elem['/Alt']).strip():
            return  # Already has good alt text
        alt = ai_alts.get(str(figure_count[0]))
        if not alt:
            page = _get_page_num(pdf, elem)
            alt = f'Figure {figure_count[0]} on page {page + 1}'
        elem[Name('/Alt')] = String(alt)
        fixed[0] += 1
        print(f'  [OK] Figure {figure_count[0]} alt text: {alt[:60]}')

    _walk_tree(pdf, fix_figure)
    print(f'[OK] Figures: {figure_count[0]} found, {fixed[0]} alt texts added, '
          f'{restructured[0]} restructured (Figure moved inside Link), '
          f'{skipped_no_mcr[0]} skipped (no content)')


def _convert_row_to_th(pdf, tr_elem, cells_counter):
    """Convert all cells in a TR to TH with Column scope."""
    if '/K' not in tr_elem:
        return
    row_kids = tr_elem['/K']
    if not isinstance(row_kids, Array):
        row_kids = Array([row_kids])
    for ck in row_kids:
        try:
            cell = ck if isinstance(ck, Dictionary) else (
                pdf.get_object(ck.objgen) if hasattr(ck, 'objgen') else None)
            if cell and isinstance(cell, Dictionary):
                current = str(cell.get('/S', '')).lstrip('/')
                if current != 'TH':
                    cell[Name('/S')] = Name('/TH')
                    cell[Name('/Scope')] = Name('/Column')
                    cells_counter[0] += 1
        except Exception:
            pass


def patch_fix_table_headers(pdf):
    """Convert first-row cells to TH in each Table — handles THead and TBody wrappers."""
    tables = [0]
    cells = [0]

    def fix_table(elem):
        s = str(elem.get('/S', '')).lstrip('/')
        if s != 'Table' or '/K' not in elem:
            return
        tables[0] += 1
        kids = elem['/K']
        if not isinstance(kids, Array):
            kids = Array([kids])

        first_tr_done = False
        for kid in kids:
            if first_tr_done:
                break
            try:
                tr = kid if isinstance(kid, Dictionary) else (
                    pdf.get_object(kid.objgen) if hasattr(kid, 'objgen') else None)
                if tr is None or not isinstance(tr, Dictionary):
                    continue
                tr_s = str(tr.get('/S', '')).lstrip('/')

                # Descend into THead or TBody to find first TR
                if tr_s in ('THead', 'TBody') and not first_tr_done:
                    if '/K' in tr:
                        wrapper_kids = tr['/K']
                        if not isinstance(wrapper_kids, Array):
                            wrapper_kids = Array([wrapper_kids])
                        for wk in wrapper_kids:
                            try:
                                inner = wk if isinstance(wk, Dictionary) else (
                                    pdf.get_object(wk.objgen) if hasattr(wk, 'objgen') else None)
                                if inner and str(inner.get('/S', '')).lstrip('/') == 'TR':
                                    _convert_row_to_th(pdf, inner, cells)
                                    first_tr_done = True
                                    break
                            except Exception:
                                pass
                    continue

                if tr_s == 'TR' and not first_tr_done:
                    first_tr_done = True
                    _convert_row_to_th(pdf, tr, cells)

            except Exception:
                pass

    _walk_tree(pdf, fix_table)
    print(f'[OK] Tables: {tables[0]} tables processed, {cells[0]} cells converted to TH')


def patch_fix_document_wrapper(pdf):
    """Ensure StructTreeRoot's first child is /Document, not /Part or other."""
    if '/StructTreeRoot' not in pdf.Root:
        print('[SKIP] Document wrapper: no StructTreeRoot')
        return
    sr = pdf.Root.StructTreeRoot
    if hasattr(sr, 'objgen'):
        sr = pdf.get_object(sr.objgen)
    if '/K' not in sr:
        print('[SKIP] Document wrapper: StructTreeRoot has no K')
        return
    kids = sr['/K']
    if not isinstance(kids, Array):
        kids = Array([kids])
    try:
        first = kids[0]
        elem = pdf.get_object(first.objgen) if hasattr(first, 'objgen') else first
        if not isinstance(elem, Dictionary):
            return
        s = str(elem.get('/S', '')).lstrip('/')
        if s in ('Document', 'document'):
            print('[OK] Document wrapper: already /Document')
            return
        # Rename /Part (or whatever) -> /Document
        elem[Name('/S')] = Name('/Document')
        print(f'[OK] Document wrapper: renamed /{s} -> /Document')
    except Exception as e:
        print(f'[WARN] Document wrapper fix failed: {e}')


# ===========================================================================
# REBUILD MODE CLASSES + FUNCTIONS  (for untagged PDFs)
# ===========================================================================

class StructureTreeBuilder:
    def __init__(self, pdf):
        self.pdf = pdf
        self.mcid_counter = 0
        self.struct_elements = []

    def create_root(self):
        struct_root = Dictionary(Type=Name.StructTreeRoot, K=Array([]))
        self.struct_root_ref = self.pdf.make_indirect(struct_root)
        self.pdf.Root.StructTreeRoot = self.struct_root_ref
        self.doc_elem = Dictionary(Type=Name.StructElem, S=Name.Document,
                                   P=self.struct_root_ref, K=Array([]))
        self.doc_elem_ref = self.pdf.make_indirect(self.doc_elem)
        struct_root.K = Array([self.doc_elem_ref])
        print('[OK] Created StructTreeRoot -> Document hierarchy')

    def create_element(self, tag, page_num, mcid=None, text=None, alt=None):
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
        mcr = Dictionary(Type=Name.MCR, Pg=page.obj, MCID=mcid)  # Native int for MCID
        elem.K = Array([self.pdf.make_indirect(mcr)])
        elem_ref = self.pdf.make_indirect(elem)
        self.struct_elements.append(elem_ref)
        return elem_ref, mcid

    def create_table(self, page_num, table_data, mcid_start=None):
        page = self.pdf.pages[page_num]
        if mcid_start is None:
            mcid_start = self.mcid_counter
        table_elem = Dictionary(Type=Name.StructElem, S=Name.Table,
                                P=self.doc_elem_ref, K=Array([]))
        if 'summary' in table_data:
            table_elem.Summary = String(table_data['summary'])
        table_ref = self.pdf.make_indirect(table_elem)
        rows = table_data.get('rows', [])
        if not isinstance(rows, list):
            rows = []
        has_headers = table_data.get('hasHeaders', False)
        row_refs = []
        mcid = mcid_start
        for row_idx, row in enumerate(rows):
            tr_elem = Dictionary(Type=Name.StructElem, S=Name.TR,
                                 P=table_ref, K=Array([]))
            tr_ref = self.pdf.make_indirect(tr_elem)
            cells = row if isinstance(row, list) else row.get('cells', [])
            cell_refs = []
            for cell_idx, cell in enumerate(cells):
                cell_tag = Name.TH if (has_headers and row_idx == 0) else Name.TD
                cell_elem = Dictionary(Type=Name.StructElem, S=cell_tag,
                                       P=tr_ref, K=Array([]))
                if has_headers and row_idx == 0:
                    cell_elem[Name('/Scope')] = Name('/Column')
                mcr = Dictionary(Type=Name.MCR, Pg=page.obj, MCID=mcid)  # Native int
                cell_elem.K = Array([self.pdf.make_indirect(mcr)])
                cell_refs.append(self.pdf.make_indirect(cell_elem))
                mcid += 1
            tr_elem.K = Array(cell_refs)
            row_refs.append(tr_ref)
        table_elem.K = Array(row_refs)
        self.struct_elements.append(table_ref)
        self.mcid_counter = mcid
        return table_ref, (mcid - mcid_start)

    def create_list(self, page_num, list_data, mcid_start=None):
        page = self.pdf.pages[page_num]
        if mcid_start is None:
            mcid_start = self.mcid_counter
        list_elem = Dictionary(Type=Name.StructElem, S=Name.L,
                               P=self.doc_elem_ref, K=Array([]))
        list_ref = self.pdf.make_indirect(list_elem)
        items = list_data.get('items', [])
        item_refs = []
        mcid = mcid_start
        for item in items:
            li_elem = Dictionary(Type=Name.StructElem, S=Name.LI,
                                 P=list_ref, K=Array([]))
            li_ref = self.pdf.make_indirect(li_elem)
            lbl_elem = Dictionary(Type=Name.StructElem, S=Name.Lbl, P=li_ref, K=Array([]))
            lbl_elem.K = Array([self.pdf.make_indirect(
                Dictionary(Type=Name.MCR, Pg=page.obj, MCID=mcid))])  # Native int
            mcid += 1
            lbody_elem = Dictionary(Type=Name.StructElem, S=Name.LBody, P=li_ref, K=Array([]))
            lbody_elem.K = Array([self.pdf.make_indirect(
                Dictionary(Type=Name.MCR, Pg=page.obj, MCID=mcid))])  # Native int
            mcid += 1
            li_elem.K = Array([self.pdf.make_indirect(lbl_elem),
                                self.pdf.make_indirect(lbody_elem)])
            item_refs.append(li_ref)
        list_elem.K = Array(item_refs)
        self.struct_elements.append(list_ref)
        self.mcid_counter = mcid
        return list_ref, (mcid - mcid_start)

    def finalize(self):
        self.doc_elem.K = Array(self.struct_elements)
        print(f'[OK] Added {len(self.struct_elements)} structure elements to Document')
        return len(self.struct_elements)


def add_mcid_to_page(pdf, page_num, mcid, tag='/P'):
    try:
        page = pdf.pages[page_num]
        if '/Contents' not in page:
            return False
        contents = page.Contents
        stream = contents[0] if isinstance(contents, Array) else contents
        raw = stream.read_bytes()
        bdc = f'{tag} <</MCID {mcid}>> BDC\n'.encode('latin-1')
        page.Contents = pdf.make_stream(bdc + raw + b'\nEMC')
        return True
    except Exception as e:
        print(f'  [ERROR] MCID on page {page_num + 1}: {e}')
        return False


def get_image_alt_text_from_claude(pdf_path, document_title=None):
    try:
        import anthropic
        images = []
        with pikepdf.Pdf.open(pdf_path) as pdf:
            for pn, page in enumerate(pdf.pages):
                if '/Resources' not in page or '/XObject' not in page.Resources:
                    continue
                for name, xobj in page.Resources.XObject.items():
                    try:
                        if xobj.get('/Subtype') == Name('/Image'):
                            images.append({'page': pn + 1, 'name': str(name),
                                           'width': int(xobj.get('/Width', 0)),
                                           'height': int(xobj.get('/Height', 0))})
                    except Exception:
                        pass
        if not images:
            return {}
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return {}
        client = anthropic.Anthropic(api_key=api_key)
        prompt = (f'PDF "{document_title or "Document"}" has {len(images)} images.\n'
                  f'{json.dumps(images, indent=2)}\n'
                  'Return JSON with keys as image index (1-based) and values as alt text under 125 chars.\n'
                  'JSON only.')
        msg = client.messages.create(model='claude-sonnet-4-20250514', max_tokens=1500,
                                     messages=[{'role': 'user', 'content': prompt}])
        text = msg.content[0].text
        if '```' in text:
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        print(f'[WARN] AI alt text: {e}')
        return {}


def tag_page_content(pdf, builder, page_num, fixes_for_page=None,
                     image_alt_texts=None, image_counter=None):
    page = pdf.pages[page_num]
    page.StructParents = page_num
    elements_created = []

    if fixes_for_page:
        for fix in fixes_for_page:
            fix_type = fix.get('type')
            fix_text = fix.get('text', '')
            fix_level = fix.get('level', 1)

            if fix_type == 'heading':
                tag = f'/H{min(max(fix_level, 1), 6)}'
                ref, mcid = builder.create_element(tag, page_num, text=fix_text or f'Heading {fix_level}')
                elements_created.append((ref, mcid))
                print(f'  [OK] {tag}: {fix_text[:50]}')

            elif fix_type == 'table':
                table_data = fix.get('tableData', {})
                ref, _ = builder.create_table(page_num, table_data)
                elements_created.append((ref, None))

            elif fix_type == 'list':
                list_data = fix.get('listData', {})
                ref, _ = builder.create_list(page_num, list_data)
                elements_created.append((ref, None))

            elif fix_type in ('altText', 'imageOfText'):
                alt = fix.get('altText', fix.get('extractedText', f'Image on page {page_num + 1}'))
                ref, mcid = builder.create_element('/Figure', page_num, alt=alt)
                elements_created.append((ref, mcid))

    # Auto-tag images not already handled
    if '/Resources' in page and '/XObject' in page.Resources:
        image_count = 0
        for name, xobj in page.Resources.XObject.items():
            try:
                if xobj.get('/Subtype') == Name('/Image'):
                    image_count += 1
                    if image_counter is not None:
                        image_counter[0] += 1
                        idx = image_counter[0]
                    else:
                        idx = image_count
                    already = fixes_for_page and any(
                        f.get('type') in ('altText', 'imageOfText') for f in fixes_for_page)
                    if not already:
                        alt = (image_alt_texts or {}).get(str(idx),
                                                          f'Image {image_count} on page {page_num + 1}')
                        ref, mcid = builder.create_element('/Figure', page_num, alt=alt)
                        elements_created.append((ref, mcid))
                        print(f'  [OK] Figure on page {page_num + 1}: {alt[:50]}')
            except Exception:
                pass

    if not elements_created:
        ref, mcid = builder.create_element('/P', page_num,
                                           text=f'Content on page {page_num + 1}')
        elements_created.append((ref, mcid))

    for ref, mcid in elements_created:
        if mcid is not None:
            add_mcid_to_page(pdf, page_num, mcid, tag='/P')
            break

    return len(elements_created)


def audit_color_contrast(pdf_path):
    try:
        import fitz
        doc = fitz.open(pdf_path)
        issues = []
        for pn in range(min(len(doc), 50)):
            for block in doc[pn].get_text('dict')['blocks']:
                if 'lines' not in block:
                    continue
                for line in block['lines']:
                    for span in line['spans']:
                        color = span.get('color', 0)
                        r, g, b = (color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF
                        text = span.get('text', '')[:50].strip()
                        if not text or (r > 240 and g > 240 and b > 240):
                            continue

                        def lum(r, g, b):
                            def a(c):
                                c /= 255
                                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
                            return 0.2126 * a(r) + 0.7152 * a(g) + 0.0722 * a(b)

                        contrast = (max(lum(r, g, b), lum(255, 255, 255)) + 0.05) / \
                                   (min(lum(r, g, b), lum(255, 255, 255)) + 0.05)
                        req = 3.0 if span.get('size', 12) >= 18 else 4.5
                        if contrast < req:
                            issues.append({
                                'page': pn + 1, 'contrast_ratio': round(contrast, 2),
                                'required_ratio': req, 'text_sample': text,
                                'text_color': f'rgb({r},{g},{b})'
                            })
        doc.close()
        return issues
    except Exception as e:
        print(f'[WARN] Contrast audit: {e}')
        return []


def audit_reading_order(pdf_path):
    try:
        issues = []
        with pikepdf.Pdf.open(pdf_path) as pdf:
            headings = []
            def collect_headings(elem):
                s = str(elem.get('/S', '')).lstrip('/')
                if s.startswith('H') and len(s) >= 2:
                    try:
                        headings.append(int(s[1:]))
                    except ValueError:
                        pass
            _walk_tree(pdf, collect_headings)
            for i in range(len(headings) - 1):
                if headings[i + 1] > headings[i] + 1:
                    issues.append({'type': 'heading_skip',
                                   'description': f'H{headings[i]} -> H{headings[i+1]}'})
            if headings and headings[0] != 1:
                issues.append({'type': 'h1_missing',
                               'description': f'First heading is H{headings[0]}, not H1'})
        return issues
    except Exception as e:
        print(f'[WARN] Reading order audit: {e}')
        return []


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(
        description='PDF Accessibility Fixer — auto-detects patch vs rebuild mode')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--fixes', help='JSON fixes file (rebuild mode only)')
    parser.add_argument('--title')
    parser.add_argument('--lang', default='en')
    parser.add_argument('--use-ai', action='store_true')
    parser.add_argument('--audit', action='store_true')
    parser.add_argument('--force-rebuild', action='store_true',
                        help='Force rebuild mode even if structure tree exists')
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f'ERROR: {input_path} not found', file=sys.stderr)
        sys.exit(1)
    output_path = Path(args.output)
    title = args.title or input_path.stem

    # Language detection
    lang_code = args.lang.lower().strip() if args.lang else 'en'
    if not lang_code or lang_code == 'en':
        print('[INFO] Detecting language...')
        lang_code = detect_language_with_ai(str(input_path), title)
        print(f'[INFO] Language: {lang_code}')
    base = lang_code.split('-')[0].split('_')[0]
    lang_name = LANG_NAME_MAP.get(lang_code) or LANG_NAME_MAP.get(base, 'English')

    print(f'\n[INFO] Input:  {input_path}')
    print(f'[INFO] Output: {output_path}')
    print(f'[INFO] Title:  {title}')
    print(f'[INFO] Lang:   {lang_code} ({lang_name})')

    with pikepdf.Pdf.open(str(input_path)) as pdf:

        has_structure = (
            '/StructTreeRoot' in pdf.Root and
            pdf.Root.StructTreeRoot is not None and
            not args.force_rebuild
        )

        print(f'\n[INFO] Mode: {"PATCH" if has_structure else "REBUILD"}')

        # Always set metadata
        set_metadata(pdf, title, lang_code, lang_name)

        # ---------------------------------------------------------------
        if has_structure:
            print('\n[PATCH] Fixing document wrapper...')
            patch_fix_document_wrapper(pdf)

            print('\n[PATCH] Fixing bookmarks from existing headings...')
            patch_fix_bookmarks(pdf)

            print('\n[PATCH] Adding alt text to Figure elements...')
            patch_fix_figure_alt_text(
                pdf,
                use_ai=args.use_ai,
                pdf_path=str(input_path),
                document_title=title
            )

            print('\n[PATCH] Converting table first-row cells → TH...')
            patch_fix_table_headers(pdf)

            print('\n[PATCH] Tagging annotations...')
            fix_annotation_tagging(pdf)

        # ---------------------------------------------------------------
        else:
            # Load fixes JSON
            fixes = []
            if args.fixes:
                try:
                    with open(args.fixes, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    fixes = data if isinstance(data, list) else data.get('fixes', [])
                    print(f'[INFO] Loaded {len(fixes)} fixes')
                except Exception as e:
                    print(f'[WARN] Could not load fixes: {e}')

            fixes_by_page = {}
            for fix in fixes:
                p = fix.get('page', 1) - 1
                fixes_by_page.setdefault(p, []).append(fix)

            builder = StructureTreeBuilder(pdf)
            builder.create_root()

            image_alt_texts = {}
            if args.use_ai:
                print('\n[INFO] Getting AI alt text for images...')
                image_alt_texts = get_image_alt_text_from_claude(str(input_path), title)

            image_counter = [0]
            total = 0
            for pn in range(len(pdf.pages)):
                total += tag_page_content(pdf, builder, pn,
                                          fixes_by_page.get(pn, []),
                                          image_alt_texts, image_counter)
            builder.finalize()

            print('\n[REBUILD] Tagging annotations...')
            fix_annotation_tagging(pdf)

            # Empty outlines (rebuild mode has no heading text to extract)
            pdf.Root.Outlines = pdf.make_indirect(Dictionary(
                Type=Name('/Outlines'), Count=0  # Native int
            ))

        # ---------------------------------------------------------------
        print(f'\n[INFO] Saving: {output_path}')
        pdf.save(str(output_path))
        print(f'[OK] Done — {len(pdf.pages)} pages')

    if args.audit:
        print('\n[INFO] Running audits...')
        results = {
            'color_contrast': {'issues': audit_color_contrast(str(output_path))},
            'reading_order': {'issues': audit_reading_order(str(output_path))}
        }
        audit_out = output_path.parent / f'{output_path.stem}_audit.json'
        with open(audit_out, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        print(f'[OK] Audit saved: {audit_out}')
        print(f'  Contrast issues: {len(results["color_contrast"]["issues"])}')
        print(f'  Reading order issues: {len(results["reading_order"]["issues"])}')


if __name__ == '__main__':
    main()
