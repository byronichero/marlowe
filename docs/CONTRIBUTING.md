# Contributing to Marlowe

Thank you for your interest in contributing to Marlowe, the AI governance application.

## Dependencies and installs

**All package installs run inside Docker containers only—not on localhost.** Add Python dependencies to `pyproject.toml` and npm dependencies to `package.json`; they are installed when you run `docker compose build`. Do not run `pip install`, `uv pip install`, or `npm install` on the host.

## Licensed Documents

Licensed or copyrighted documents (e.g. ISO standards, paid frameworks) **must not** be committed to the repository. This includes PDFs, DOCX files, and other proprietary content.

### For local testing

1. **Create** a `docs/licensed/` folder in the project root (this folder is gitignored).
2. **Place** your licensed documents (e.g. ISO/IEC 42001:2023) in `docs/licensed/`.
3. **Ingest** documents into Qdrant via the API or CLI. The default `docs` path includes `docs/licensed/` when it exists.
   - API: `POST /api/v1/documents/ingest`
   - CLI: `python -m app.scripts.ingest_docs`
4. **Do not** commit anything in `docs/licensed/`—the entire folder is ignored by git.

### Public repository

- Only open-access, Creative Commons, or sample documents in `docs/` (outside `licensed/`) may be committed.
- Before pushing, ensure no licensed content is staged: `git status` and review `docs/`.

### Clearing Qdrant before sharing

If you have ingested licensed content into Qdrant and plan to share a backup or deployment, clear the vector store first. See the [README](../README.md#licensed-documents-and-qdrant) for instructions.
