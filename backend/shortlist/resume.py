"""Turn an uploaded resume into plain text. PDF, DOCX and plain text only."""

import io
import re
import zipfile
from xml.etree import ElementTree

MAX_BYTES = 5 * 1024 * 1024
# Guards against a zip bomb posing as a .docx.
MAX_DOCX_XML_BYTES = 20 * 1024 * 1024


class ResumeError(ValueError):
    pass


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("This PDF is password protected. Save a copy without a password and upload that.")
        return "\n".join((page.extract_text() or "") for page in reader.pages[:15])
    except ResumeError:
        raise
    except Exception as e:
        raise ResumeError("This PDF couldn't be read. Try exporting it again, or upload a DOCX.") from e


_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _docx(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            info = z.getinfo("word/document.xml")
            if info.file_size > MAX_DOCX_XML_BYTES:
                raise ResumeError("This document is too large to read.")
            root = ElementTree.fromstring(z.read(info))
    except ResumeError:
        raise
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError) as e:
        raise ResumeError("This DOCX couldn't be read. Try saving it again, or upload a PDF.") from e
    paragraphs = []
    for p in root.iter(f"{_W}p"):
        parts = []
        for node in p.iter():
            if node.tag == f"{_W}t" and node.text:
                parts.append(node.text)
            elif node.tag in (f"{_W}tab", f"{_W}br"):
                parts.append(" ")
        paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def extract_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise ResumeError("That file is over 5 MB. Upload a smaller copy.")
    name = (filename or "").lower()
    if name.endswith(".pdf") or data[:5] == b"%PDF-":
        text = _pdf(data)
    elif name.endswith(".docx"):
        text = _docx(data)
    elif name.endswith((".txt", ".md")):
        text = data.decode("utf-8", errors="replace")
    else:
        raise ResumeError("Upload a PDF, DOCX or TXT file.")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 200:
        raise ResumeError("Very little text came out of this file. If it's a scanned image, "
                          "upload a text-based PDF or DOCX instead.")
    return text
