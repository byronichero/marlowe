"""CLI to seed NIST AI RMF Trustworthiness Taxonomy from markdown."""

from __future__ import annotations

import argparse
import asyncio
import sys


async def main() -> int:
    """Run taxonomy seed and print result."""
    parser = argparse.ArgumentParser(
        description="Seed NIST AI RMF Trustworthiness Taxonomy from markdown"
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing taxonomy framework if it exists",
    )
    parser.add_argument(
        "--mvp-only",
        action="store_true",
        help="Seed only Plan and Design + Collect and Process Data stages",
    )
    args = parser.parse_args()

    from app.core.database import async_session_factory
    from app.services.nist_ai_rmf_taxonomy_service import seed_nist_ai_rmf_taxonomy

    async with async_session_factory() as session:
        try:
            result = await seed_nist_ai_rmf_taxonomy(
                db=session,
                replace_existing=args.replace,
                mvp_only=args.mvp_only,
            )
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Seed failed: {e}", file=sys.stderr)
            return 1

    if not result.get("ok"):
        print("Seed failed:", result.get("error", "unknown"), file=sys.stderr)
        return 1
    print(
        "NIST AI RMF Trustworthiness Taxonomy seeded: "
        f"framework_id={result['framework_id']}, "
        f"properties_created={result['properties_created']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
