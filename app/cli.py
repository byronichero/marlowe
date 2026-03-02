"""Marlowe CLI – health checks, version, and admin tasks."""

from __future__ import annotations

import argparse
import json
import sys
from typing import NoReturn


def _get_version() -> str:
    """Return package version."""
    try:
        from importlib.metadata import version

        return version("marlowe")
    except Exception:
        return "1.0.0"


def _parse_base_url(base_url: str) -> str:
    """Ensure base URL has no trailing slash."""
    return base_url.rstrip("/")


def _fetch_json(url: str) -> dict:
    """Fetch JSON from URL."""
    import urllib.request

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)


def cmd_version(_args: argparse.Namespace) -> int:
    """Print version."""
    print(_get_version())
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    """Check service health via API or local checks."""
    base = _parse_base_url(args.base_url)
    url = f"{base}/api/v1/admin/services"
    data = _fetch_json(url)
    if args.json:
        print(json.dumps(data, indent=2))
        return 0
    services = data.get("services", {})
    all_ok = True
    for name, info in services.items():
        status = info.get("status", "unknown")
        msg = info.get("message", "")
        symbol = "✓" if status == "healthy" else "✗"
        if status != "healthy":
            all_ok = False
        print(f"  {symbol} {name}: {status}")
        if msg and msg not in ("OK", "Connected"):
            print(f"      {msg}")
    return 0 if all_ok else 1


def main() -> NoReturn:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="marlowe",
        description="Marlowe CLI – health checks and admin tasks for the AI governance platform.",
    )
    parser.add_argument(
        "--version",
        action="store_true",
        help="Print version and exit",
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # version
    subparsers.add_parser("version", help="Print version")

    # health
    health_parser = subparsers.add_parser("health", help="Check service health")
    health_parser.add_argument(
        "--base-url",
        default="http://localhost:5010",
        help="API base URL (default: http://localhost:5010)",
    )
    health_parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON",
    )

    parsed = parser.parse_args()

    if parsed.version:
        sys.exit(cmd_version(parsed))
    if parsed.command == "version":
        sys.exit(cmd_version(parsed))
    if parsed.command == "health":
        sys.exit(cmd_health(parsed))

    parser.print_help()
    sys.exit(1)
