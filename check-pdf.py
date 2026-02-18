import pikepdf

pdf = pikepdf.Pdf.open('C:/Users/kirby/Downloads/Introduction-to-Research_auto-fixed (35).pdf')

print('=== STRUCTURE TREE ANALYSIS ===\n')

elem_count = [0]
missing_alt_count = [0]

def check_structure_element(elem, depth=0):
    """Recursively check structure elements"""
    if not isinstance(elem, pikepdf.Dictionary):
        return
    
    elem_count[0] += 1
    elem_num = elem_count[0]
    
    tag = str(elem.get('/S', 'Unknown')).replace('/', '')
    
    # Check for alt text
    has_alt = '/Alt' in elem
    alt_value = str(elem.get('/Alt', ''))[:50] if has_alt else None
    
    # Flag potential issues
    issues = []
    
    # If it's a Figure/Form/Formula type element without alt text - ADOBE REQUIREMENT
    if tag in ['Figure', 'Form', 'Formula'] and not has_alt:
        issues.append('⚠️ MISSING /Alt (Adobe requires this)')
        missing_alt_count[0] += 1
    
    indent = '  ' * depth
    
    # Only print elements with issues OR Figure/Form/Formula elements
    if issues or tag in ['Figure', 'Form', 'Formula']:
        print(f'{indent}Element {elem_num}: <{tag}>')
        if has_alt:
            print(f'{indent}  ✅ Alt text: "{alt_value}"')
        if issues:
            print(f'{indent}  🔴 {", ".join(issues)}')
    
    # Recurse into children
    k_value = elem.get('/K')
    if k_value and isinstance(k_value, pikepdf.Array):
        for child in k_value:
            if isinstance(child, pikepdf.Dictionary):
                check_structure_element(child, depth + 1)
            else:
                # Try to dereference indirect objects
                try:
                    child_obj = pdf.get_object(child.objgen) if hasattr(child, 'objgen') else child
                    if isinstance(child_obj, pikepdf.Dictionary):
                        check_structure_element(child_obj, depth + 1)
                except:
                    pass

# Start from StructTreeRoot
if '/StructTreeRoot' in pdf.Root:
    struct_root = pdf.Root.StructTreeRoot
    print('Found StructTreeRoot\n')
    
    k_array = struct_root.get('/K')
    if k_array:
        if isinstance(k_array, pikepdf.Array):
            for child in k_array:
                if isinstance(child, pikepdf.Dictionary):
                    check_structure_element(child)
                else:
                    try:
                        child_obj = pdf.get_object(child.objgen) if hasattr(child, 'objgen') else child
                        if isinstance(child_obj, pikepdf.Dictionary):
                            check_structure_element(child_obj)
                    except:
                        pass
else:
    print('No StructTreeRoot found!')

print(f'\n=== SUMMARY ===')
print(f'Total elements: {elem_count[0]}')
print(f'Elements missing /Alt: {missing_alt_count[0]}')
print('\nDone!')