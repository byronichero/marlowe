"""CLI to ingest docs folder into Qdrant. Run from project root: python -m app.scripts.ingest_docs [path]."""

import asyncio
import sys


async def main() -> int:
    """Run ingestion and print result."""
    from app.services.ingest_service import ingest_docs

    path_override = sys.argv[1] if len(sys.argv) > 1 else None
    result = await ingest_docs(path_override=path_override)
    if not result.get("ok"):
        print("Ingest failed:", result.get("error", "unknown"), file=sys.stderr)
        for e in result.get("errors", [])[:10]:
            print("  -", e, file=sys.stderr)
        return 1
    print(f"Files processed: {result['files_processed']}, chunks ingested: {result['chunks_ingested']}")
    for e in result.get("errors", []):
        print("  warning:", e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
