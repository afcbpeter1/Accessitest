# ISO 14289-1 Compliance Reporting

## Before/After Compliance Report

We now generate comprehensive before/after ISO 14289-1 compliance reports showing:
- What failed in the original PDF
- What passes after our fixes
- Comparison against ISO 14289-1 standards

## Usage

### Generate Compliance Report

```bash
python scripts/iso-compliance-report.py <before_pdf> <after_pdf> [output_json]
```

**Example:**
```bash
python scripts/iso-compliance-report.py original.pdf fixed.pdf report.json
```

### Report Format

The report includes:

1. **Summary**
   - Before: X/Y checks passed (Z%)
   - After: X/Y checks passed (Z%)
   - Improvement: N checks fixed
   - Compliant: Yes/No

2. **Detailed Check Results**
   - Each ISO 14289-1 requirement
   - Before status (PASS/FAIL)
   - After status (PASS/FAIL)
   - Status change (FIXED/REGRESSED/UNCHANGED)
   - Specific failures for each check

3. **ISO Requirements**
   - Requirement code (e.g., UA1_Tpdf-ua-0052)
   - Description of requirement
   - Compliance status

## ISO 14289-1 Checks Validated

1. **Tagged PDF** (UA1_Tpdf-ua-0052)
   - Structure tree exists
   - Document wrapper present
   - Structure tree integrity

2. **Primary Language** (UA1_Tpdf-ua-0031)
   - Language specified in catalog
   - Correct format (PDF name object)

3. **Title** (UA1_Tpdf-ua-0032)
   - Title in Info dictionary
   - Title in XMP metadata

4. **Tagged Content** (UA1_Tpdf-ua-0053)
   - 100% content coverage
   - All content has MCID linking

5. **Tab Order** (UA1_Tpdf-ua-0054)
   - Reading order matches visual order
   - Structure order is correct

6. **Other Elements Alternate Text** (UA1_Tpdf-ua-0033)
   - All figures have alt text
   - Form fields have labels

7. **Appropriate Nesting** (UA1_Tpdf-ua-0055)
   - Headings follow proper hierarchy
   - No level skipping

8. **Structure Tree Integrity** (UA1_Tpdf-ua-0052)
   - No corruption
   - Valid references

9. **MarkInfo/Marked** (UA1_Tpdf-ua-0051)
   - Marked flag set to /true

10. **Document Wrapper** (UA1_Tpdf-ua-0052)
    - Document element exists
    - Proper hierarchy

## Integration

The compliance report can be:
- Generated automatically after PDF repair
- Saved as JSON for programmatic access
- Displayed in UI for user review
- Used for compliance auditing

## Output Example

```
================================================================================
ISO 14289-1 (PDF/UA) COMPLIANCE REPORT
================================================================================
Standard: ISO 14289-1 (PDF/UA)
Before PDF: original.pdf
After PDF: fixed.pdf

SUMMARY
--------------------------------------------------------------------------------
Before: 3/10 checks passed (30.0%)
After:  10/10 checks passed (100.0%)
Improvement: 7 checks fixed
Compliant: ✅ YES

DETAILED CHECK RESULTS
--------------------------------------------------------------------------------

Tagged PDF (UA1_Tpdf-ua-0052)
  ISO Requirement: Document must have a structure tree (StructTreeRoot) with Document wrapper
  Before: ❌ FAIL
    - StructTreeRoot missing from PDF root
  After:  ✅ PASS 🔧 FIXED

Primary Language (UA1_Tpdf-ua-0031)
  ISO Requirement: Document language must be specified in catalog /Lang key
  Before: ❌ FAIL
    - Language not set in catalog /Lang key
  After:  ✅ PASS 🔧 FIXED

...

================================================================================
Final Status: ✅ ISO 14289-1 COMPLIANT
================================================================================
```

