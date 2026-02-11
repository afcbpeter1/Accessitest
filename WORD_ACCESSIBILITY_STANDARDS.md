# Word Document Accessibility Standards

## ISO Standards Comparison: Word vs PDF

### PDF Documents
- **ISO 14289-1 (PDF/UA)** - Universal Accessibility standard for PDFs
  - Specific ISO standard for PDF accessibility
  - Defines structure tree, tagging, reading order, etc.
  - This is what we're implementing for PDF compliance

### Word Documents (.docx)
- **ISO/IEC 29500** - Office Open XML (OOXML) standard
  - This is the **file format specification**, not an accessibility standard
  - Defines the XML structure of .docx files
  - Similar to how ISO 32000 defines PDF structure

- **NO specific ISO accessibility standard** for Word documents
  - Unlike PDFs, there's no "Word/UA" equivalent
  - Word accessibility follows general digital accessibility standards

## Word Document Accessibility Standards

Word documents follow these accessibility standards (not ISO-specific):

### 1. **WCAG 2.1 Level AA** (Web Content Accessibility Guidelines)
- Applies to all digital content, including Word documents
- Same principles as web content:
  - 1.1.1 Non-text Content (alt text for images)
  - 1.3.1 Info and Relationships (heading structure, lists, tables)
  - 1.4.1 Use of Color (color contrast)
  - 2.4.2 Page Titled (document title)
  - 3.1.1 Language of Page (document language)
  - And all other WCAG 2.1 criteria

### 2. **Section 508** (36 CFR § 1194.22)
- US federal accessibility requirements
- Applies to electronic documents including Word
- Requirements:
  - (a) Text alternatives for images
  - (b) Document structure (headings, lists)
  - (c) Color contrast
  - (d) Document language
  - (e) Reading order
  - (f) Tables with headers
  - (g) Form labels
  - (h) Link text
  - And other subsections

### 3. **EN 301 549** (European Accessibility Standard)
- European standard for ICT accessibility
- Based on WCAG 2.1
- Applies to Word documents in EU

### 4. **Microsoft Accessibility Guidelines**
- Built-in Word accessibility features:
  - Heading styles (Heading 1-9)
  - Alt text for images
  - Table headers
  - Document properties (title, language)
  - Reading order
  - Color contrast
  - Link text

## What We Check for Word Documents

Our scanner checks Word documents against:

1. **WCAG 2.1 AA** - All criteria applicable to documents
2. **Section 508** - All 16 subsections (1194.22 a-p)
3. **EN 301 549** - European standard compliance

### Key Differences from PDF:

| Aspect | PDF (ISO 14289-1) | Word (WCAG 2.1/Section 508) |
|--------|-------------------|------------------------------|
| **Standard** | ISO 14289-1 (PDF/UA) | WCAG 2.1 + Section 508 |
| **Structure** | Structure tree (StructTreeRoot) | Built-in styles (Heading 1-9) |
| **Tagging** | PDF tags (H1, P, Figure, etc.) | Word styles (Heading 1, Normal, etc.) |
| **Alt Text** | `/Alt` in structure tree | Image alt text property |
| **Language** | `/Lang` in catalog | Document language property |
| **Title** | `/Title` in Info + XMP | Document properties → Title |
| **Reading Order** | MCID linking | Natural document flow |
| **Validation** | Adobe Accessibility Checker | Microsoft Accessibility Checker |

## Implementation in Our System

### Word Document Scanning
- ✅ Checks WCAG 2.1 AA criteria
- ✅ Checks Section 508 requirements
- ✅ Validates heading structure
- ✅ Validates alt text for images
- ✅ Validates table headers
- ✅ Validates document language
- ✅ Validates document title
- ✅ Validates color contrast
- ✅ Validates link text

### Word Document Repair
- ✅ Applies heading styles
- ✅ Adds alt text to images
- ✅ Fixes table headers
- ✅ Sets document language
- ✅ Sets document title
- ✅ Improves color contrast
- ✅ Fixes link text

## Summary

**Word documents do NOT have a specific ISO accessibility standard like PDF/UA (ISO 14289-1).**

Instead, they follow:
- **WCAG 2.1 Level AA** (general digital accessibility)
- **Section 508** (US federal requirements)
- **EN 301 549** (European standard)

Our system checks Word documents against all these standards, which is the correct approach since there's no Word-specific ISO accessibility standard.

