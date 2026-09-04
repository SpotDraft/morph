#!/usr/bin/env python3
"""Write a small OOXML contract used by morph tests and the SDK spike."""
from __future__ import annotations

import zipfile
from pathlib import Path

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>
"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>
"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>
"""

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Morph torture contract</dc:title>
  <dc:creator>Morph</dc:creator>
</cp:coreProperties>
"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>
"""

NUMBERING = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>
"""


def p(text: str, style: str = "Normal", para_id: str | None = None, num_id: str | None = None, level: str | None = None) -> str:
    pid = f' w14:paraId="{para_id}"' if para_id else ""
    num = ""
    if num_id is not None:
        num = f'<w:numPr><w:ilvl w:val="{level or "0"}"/><w:numId w:val="{num_id}"/></w:numPr>'
    return (
        f'<w:p{pid} xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">'
        f"<w:pPr><w:pStyle w:val=\"{style}\"/>{num}</w:pPr>"
        f"<w:r><w:t xml:space=\"preserve\">{text}</w:t></w:r></w:p>"
    )


def table() -> str:
    return """
<w:tbl>
  <w:tblPr><w:tblW w:w="5000" w:type="dxa"/></w:tblPr>
  <w:tblGrid><w:gridCol w:w="2500"/><w:gridCol w:w="2500"/></w:tblGrid>
  <w:tr>
    <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Payment</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Net 30</w:t></w:r></w:p></w:tc>
  </w:tr>
</w:tbl>
"""


DOCUMENT = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:body>
    {p("Definitions", "Heading1", "A1B2C3D4")}
    {p('"Supplier" means the party identified as such.', "Normal", "B2C3D4E5")}
    {p("The Term shall be one (1) year.", "Normal", "C3D4E5F6")}
    {p("Confidentiality", "Heading1", "D4E5F607")}
    {p("Confidential Information must not be disclosed.", "Normal", "E5F60718")}
    {table()}
    {p("Termination", "Heading1", "F6071829")}
    {p("Either party may terminate for breach.", "ListParagraph", "0718293A", "1", "1")}
    {p("Termination is governed by Section 6.3.", "Normal", "18293A4B")}
    {p("Preferred Supplier Program is not a defined term hit.", "Normal", "293A4B5C")}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>
"""


def write(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", RELS)
        zf.writestr("word/_rels/document.xml.rels", DOC_RELS)
        zf.writestr("word/document.xml", DOCUMENT)
        zf.writestr("word/styles.xml", STYLES)
        zf.writestr("word/numbering.xml", NUMBERING)
        zf.writestr("docProps/core.xml", CORE)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "fixtures" / "contract.docx"
    write(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")
