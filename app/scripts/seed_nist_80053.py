"""CLI to seed NIST SP 800-53 Rev 5 controls from OSCAL catalog.

Run from project root:
  python -m app.scripts.seed_nist_80053
  python -m app.scripts.seed_nist_80053 --replace  # Replace existing NIST framework
  python -m app.scripts.seed_nist_80053 --url /path/to/catalog.json
"""

import argparse
import asyncio
import sys


async def main() -> int:
    """Run NIST seed and print result."""
    parser = argparse.ArgumentParser(description="Seed NIST SP 800-53 from OSCAL catalog")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing NIST framework if it exists",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=None,
        help="URL or path to OSCAL catalog JSON (default: fetch from NIST GitHub)",
    )
    args = parser.parse_args()

    from app.core.database import async_session_factory
    from app.services.nist_seed_service import seed_nist_80053

    async with async_session_factory() as session:
        try:
            result = await seed_nist_80053(
                db=session,
                catalog_url=args.url,
                replace_existing=args.replace,
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
        f"NIST SP 800-53 seeded: framework_id={result['framework_id']}, "
        f"controls_created={result['controls_created']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
