# Word Document Auto-Fix Implementation Plan

## ✅ Currently Fixed (5)
1. **Document Title** - Sets title in metadata
2. **Image Alt Text** - Adds alt text via XML
3. **Table Summaries** - Adds AI-generated summaries
4. **Document Language** - Sets document-level language
5. **Foreign Language Tags** - Sets language on specific text runs

## ❌ Currently NOT Fixed (But CAN Be)
1. **Heading Structure** - CAN FIX with AI detection
2. **Table Headers** - CAN FIX by marking first row as header
3. **Link Text** - PARTIALLY - Can improve but requires content analysis

## 🚀 Implementation Plan

### Priority 1: Heading Structure (HIGH IMPACT)
**Status**: Infrastructure exists, needs integration
- ✅ AI heading detection already exists (`identifyHeadings` in ClaudeAPI)
- ✅ Python script accepts heading fixes
- ❌ Not connected in word-auto-fix-service

**Solution**: 
- Use AI to identify headings from document text
- Pass heading fixes to Python script
- Apply Heading 1-6 styles to identified paragraphs

### Priority 2: Table Headers (MEDIUM IMPACT)
**Status**: Can detect, can fix
- ✅ Can detect tables without headers
- ✅ python-docx can mark first row as header
- ❌ Not implemented

**Solution**:
- Detect tables missing headers
- Mark first row as header row in Word
- Set table header style

### Priority 3: Link Text Improvements (LOW IMPACT)
**Status**: Complex, requires content analysis
- ✅ Can detect non-descriptive links
- ❌ Requires AI to generate better link text
- ⚠️ May change document content

**Solution** (Future):
- Use AI to generate descriptive link text
- Replace "click here" with meaningful text


