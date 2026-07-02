"""
conftest.py — shared pytest fixtures for the RAG production-hardening test suite.
"""

import os
import struct
import tempfile
import pytest

from langchain_core.documents import Document


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def tmp_chroma_path(tmp_path):
    """Return a temporary directory path suitable for a ChromaDB PersistentClient."""
    chroma_dir = tmp_path / "chroma_db"
    chroma_dir.mkdir()
    return str(chroma_dir)


@pytest.fixture()
def sample_chunks():
    """
    Return a list of LangChain Document objects that can be indexed into a
    vector store.  Each document has realistic page_content and metadata with
    at least 'page' and 'source_file' keys.
    """
    raw = [
        (
            "Machine learning is a subset of artificial intelligence that enables "
            "computers to learn from data without being explicitly programmed.",
            {"page": 0, "source_file": "ml_intro.pdf"},
        ),
        (
            "Neural networks are computing systems inspired by the biological "
            "neural networks that constitute animal brains.",
            {"page": 0, "source_file": "ml_intro.pdf"},
        ),
        (
            "Deep learning uses neural networks with many layers to model complex "
            "patterns in data, achieving state-of-the-art results on image and "
            "language tasks.",
            {"page": 1, "source_file": "ml_intro.pdf"},
        ),
        (
            "Natural language processing allows machines to read, understand, and "
            "derive meaning from human languages in a smart and useful way.",
            {"page": 2, "source_file": "ml_intro.pdf"},
        ),
        (
            "Retrieval-augmented generation combines a retrieval component that "
            "fetches relevant documents with a generative model that synthesises "
            "a coherent answer from those documents.",
            {"page": 3, "source_file": "rag_paper.pdf"},
        ),
        (
            "Vector databases store high-dimensional embeddings and support "
            "efficient approximate nearest-neighbour search.",
            {"page": 4, "source_file": "rag_paper.pdf"},
        ),
        (
            "ChromaDB is an open-source embedding database designed for use with "
            "large language models.",
            {"page": 5, "source_file": "rag_paper.pdf"},
        ),
        (
            "Transformers use a self-attention mechanism that relates different "
            "positions of a single sequence to compute a representation of the "
            "sequence.",
            {"page": 6, "source_file": "transformers.pdf"},
        ),
    ]
    return [Document(page_content=text, metadata=meta) for text, meta in raw]


@pytest.fixture()
def sample_pdf_path(tmp_path):
    """
    Return the path to a minimal, valid single-page PDF file created in a
    temporary directory.  The PDF contains a single text object so that
    PyPDFLoader can extract at least one page of content.
    """
    pdf_path = tmp_path / "sample.pdf"
    _write_minimal_pdf(str(pdf_path))
    return str(pdf_path)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _write_minimal_pdf(path: str) -> None:
    """
    Write the smallest possible valid PDF that contains extractable text.

    The structure follows the PDF 1.4 spec:
      - 1-page document
      - Single content stream with a BT/ET text block
      - Cross-reference table + trailer
    """
    # Content stream: draw text "Sample PDF for testing."
    stream_content = (
        b"BT\n"
        b"/F1 12 Tf\n"
        b"72 720 Td\n"
        b"(Sample PDF for testing RAG pipeline.) Tj\n"
        b"ET\n"
    )
    stream_len = len(stream_content)

    # Build objects ── offsets tracked for xref table
    objects: list[bytes] = []
    offsets: list[int] = []

    def add_obj(content: bytes) -> int:
        """Add a PDF object, returning its 1-based object number."""
        obj_num = len(objects) + 1
        objects.append(content)
        return obj_num

    # Object 1 — Catalog
    add_obj(b"<< /Type /Catalog /Pages 2 0 R >>")
    # Object 2 — Pages
    add_obj(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    # Object 3 — Page
    add_obj(
        b"<< /Type /Page /Parent 2 0 R "
        b"/MediaBox [0 0 612 792] "
        b"/Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>"
    )
    # Object 4 — Content stream
    add_obj(
        b"<< /Length " + str(stream_len).encode() + b" >>\n"
        b"stream\n" + stream_content + b"\nendstream"
    )
    # Object 5 — Font
    add_obj(
        b"<< /Type /Font /Subtype /Type1 "
        b"/BaseFont /Helvetica "
        b"/Encoding /WinAnsiEncoding >>"
    )

    # Assemble the file
    lines: list[bytes] = [b"%PDF-1.4\n"]
    for idx, obj_body in enumerate(objects):
        offsets.append(sum(len(l) for l in lines))
        obj_num = idx + 1
        lines.append(
            b"%d 0 obj\n" % obj_num
            + obj_body
            + b"\nendobj\n"
        )

    xref_offset = sum(len(l) for l in lines)
    xref_count = len(objects) + 1  # +1 for the free entry

    xref_lines: list[bytes] = [
        b"xref\n",
        b"0 %d\n" % xref_count,
        b"0000000000 65535 f \n",  # free entry
    ]
    for off in offsets:
        xref_lines.append(b"%010d 00000 n \n" % off)

    trailer = (
        b"trailer\n"
        b"<< /Size %d /Root 1 0 R >>\n" % xref_count
        + b"startxref\n"
        + str(xref_offset).encode()
        + b"\n%%EOF\n"
    )

    with open(path, "wb") as fh:
        for chunk in lines:
            fh.write(chunk)
        for chunk in xref_lines:
            fh.write(chunk)
        fh.write(trailer)
