#!/usr/bin/env python3
"""
ISO 14289-1 Compliance Report Generator
Generates before/after comparison reports showing ISO compliance status
"""

import sys
import json
from pathlib import Path
import os

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigorous_pdf_ua_validator import RigorousPDFUAValidator

def generate_compliance_report(before_pdf: str, after_pdf: str, output_path: str = None):
    """
    Generate a before/after ISO 14289-1 compliance report
    
    Args:
        before_pdf: Path to original PDF
        after_pdf: Path to fixed PDF
        output_path: Optional path to save JSON report
    """
    
    # Validate PDFs exist
    if not Path(before_pdf).exists():
        raise FileNotFoundError(f"Before PDF not found: {before_pdf}")
    if not Path(after_pdf).exists():
        raise FileNotFoundError(f"After PDF not found: {after_pdf}")
    
    # Validate both PDFs
    print(f"Validating original PDF: {before_pdf}...")
    before_validator = RigorousPDFUAValidator(before_pdf)
    before_results = before_validator.validate()
    
    print(f"Validating fixed PDF: {after_pdf}...")
    after_validator = RigorousPDFUAValidator(after_pdf)
    after_results = after_validator.validate()
    
    # ISO 14289-1 check names and requirements
    iso_requirements = {
        "Tagged PDF": {
            "requirement": "UA1_Tpdf-ua-0052",
            "description": "Document must have a structure tree (StructTreeRoot) with Document wrapper"
        },
        "Primary Language": {
            "requirement": "UA1_Tpdf-ua-0031",
            "description": "Document language must be specified in catalog /Lang key"
        },
        "Title": {
            "requirement": "UA1_Tpdf-ua-0032",
            "description": "Document title must be specified in Info dictionary and XMP metadata"
        },
        "Tagged Content": {
            "requirement": "UA1_Tpdf-ua-0053",
            "description": "All content must be tagged with MCID linking (100% coverage required)"
        },
        "Tab Order": {
            "requirement": "UA1_Tpdf-ua-0054",
            "description": "Logical reading order must match visual order"
        },
        "Other Elements Alternate Text": {
            "requirement": "UA1_Tpdf-ua-0033",
            "description": "All non-text content must have alternate text"
        },
        "Appropriate Nesting": {
            "requirement": "UA1_Tpdf-ua-0055",
            "description": "Headings must follow proper hierarchy (H1 → H2 → H3, no skipping)"
        },
        "Structure Tree Integrity": {
            "requirement": "UA1_Tpdf-ua-0052",
            "description": "Structure tree must be properly formed and accessible"
        },
        "MarkInfo/Marked": {
            "requirement": "UA1_Tpdf-ua-0051",
            "description": "MarkInfo/Marked flag must be set to /true"
        },
        "Document Wrapper": {
            "requirement": "UA1_Tpdf-ua-0052",
            "description": "Document wrapper must exist as first child of StructTreeRoot"
        }
    }
    
    # Build comparison report
    report = {
        "report_type": "ISO 14289-1 Compliance Report",
        "standard": "ISO 14289-1 (PDF/UA)",
        "before_pdf": before_pdf,
        "after_pdf": after_pdf,
        "summary": {
            "before": {
                "compliant": before_results['compliant'],
                "passed": len(before_results['passed']),
                "failed": len(before_results['failures']),
                "total_checks": len(before_results['checks'])
            },
            "after": {
                "compliant": after_results['compliant'],
                "passed": len(after_results['passed']),
                "failed": len(after_results['failures']),
                "total_checks": len(after_results['checks'])
            },
            "improvement": {
                "checks_fixed": len(before_results['failures']) - len(after_results['failures']),
                "compliance_achieved": after_results['compliant'],
                "compliance_rate_before": f"{(len(before_results['passed']) / len(before_results['checks']) * 100):.1f}%",
                "compliance_rate_after": f"{(len(after_results['passed']) / len(after_results['checks']) * 100):.1f}%"
            }
        },
        "checks": []
    }
    
    # Compare each check
    all_check_names = set(list(before_results['checks'].keys()) + list(after_results['checks'].keys()))
    
    for check_name in sorted(all_check_names):
        before_check = before_results['checks'].get(check_name, {'passed': False, 'failures': ['Check not performed']})
        after_check = after_results['checks'].get(check_name, {'passed': False, 'failures': ['Check not performed']})
        
        iso_info = iso_requirements.get(check_name, {
            "requirement": "N/A",
            "description": "Check not in ISO requirements list"
        })
        
        check_report = {
            "check_name": check_name,
            "iso_requirement": iso_info["requirement"],
            "iso_description": iso_info["description"],
            "before": {
                "status": "PASS" if before_check['passed'] else "FAIL",
                "passed": before_check['passed'],
                "failures": before_check.get('failures', []),
                "details": before_check.get('details', {})
            },
            "after": {
                "status": "PASS" if after_check['passed'] else "FAIL",
                "passed": after_check['passed'],
                "failures": after_check.get('failures', []),
                "details": after_check.get('details', {})
            },
            "improvement": {
                "fixed": not before_check['passed'] and after_check['passed'],
                "status_change": "FIXED" if (not before_check['passed'] and after_check['passed']) else ("REGRESSED" if (before_check['passed'] and not after_check['passed']) else "UNCHANGED")
            }
        }
        
        report["checks"].append(check_report)
    
    # Save report if output path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nReport saved to: {output_path}")
    
    return report


def print_compliance_report(report: dict):
    """Print a formatted compliance report"""
    
    print("\n" + "="*80)
    print("ISO 14289-1 (PDF/UA) COMPLIANCE REPORT")
    print("="*80)
    print(f"Standard: {report['standard']}")
    print(f"Before PDF: {Path(report['before_pdf']).name}")
    print(f"After PDF: {Path(report['after_pdf']).name}")
    print()
    
    # Summary
    summary = report['summary']
    print("SUMMARY")
    print("-"*80)
    print(f"Before: {summary['before']['passed']}/{summary['before']['total_checks']} checks passed ({summary['improvement']['compliance_rate_before']})")
    print(f"After:  {summary['after']['passed']}/{summary['after']['total_checks']} checks passed ({summary['improvement']['compliance_rate_after']})")
    print(f"Improvement: {summary['improvement']['checks_fixed']} checks fixed")
    print(f"Compliant: {'✅ YES' if summary['after']['compliant'] else '❌ NO'}")
    print()
    
    # Detailed checks
    print("DETAILED CHECK RESULTS")
    print("-"*80)
    
    for check in report['checks']:
        before_status = "✅ PASS" if check['before']['passed'] else "❌ FAIL"
        after_status = "✅ PASS" if check['after']['passed'] else "❌ FAIL"
        
        status_change = check['improvement']['status_change']
        change_icon = "🔧" if status_change == "FIXED" else ("⚠️" if status_change == "REGRESSED" else "➡️")
        
        print(f"\n{check['check_name']} ({check['iso_requirement']})")
        print(f"  ISO Requirement: {check['iso_description']}")
        print(f"  Before: {before_status}")
        if check['before']['failures']:
            for failure in check['before']['failures'][:3]:
                print(f"    - {failure}")
        print(f"  After:  {after_status} {change_icon} {status_change}")
        if check['after']['failures']:
            for failure in check['after']['failures'][:3]:
                print(f"    - {failure}")
    
    print("\n" + "="*80)
    print(f"Final Status: {'✅ ISO 14289-1 COMPLIANT' if summary['after']['compliant'] else '❌ NOT COMPLIANT'}")
    print("="*80 + "\n")


def main():
    if len(sys.argv) < 3:
        print("Usage: python iso-compliance-report.py <before_pdf> <after_pdf> [output_json]")
        print("\nExample:")
        print("  python iso-compliance-report.py original.pdf fixed.pdf report.json")
        sys.exit(1)
    
    before_pdf = sys.argv[1]
    after_pdf = sys.argv[2]
    output_json = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        report = generate_compliance_report(before_pdf, after_pdf, output_json)
        print_compliance_report(report)
        
        # Exit code based on compliance
        sys.exit(0 if report['summary']['after']['compliant'] else 1)
        
    except Exception as e:
        print(f"Error generating report: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

