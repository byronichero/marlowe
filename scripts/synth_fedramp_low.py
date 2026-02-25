"""
Generate synthetic FedRAMP Low audit data for gap analysis simulation.

Outputs Markdown files that can be uploaded as evidence via the Marlowe UI
(Upload Evidence) or Knowledge Base. Run gap analysis after uploading.

Usage:
    python scripts/synth_fedramp_low.py
    # Output in ./fedramp_low_demo/ (system_inventory, risk_assessment, etc.)
    # Upload synthetic_evidence.md as evidence for your NIST framework, then run gap analysis.
"""

import csv
import os
import random
import string
from datetime import datetime, timedelta
from pathlib import Path

# ---------- CONFIG ----------
SEED = 42
OUTPUT_DIR = "fedramp_low_demo"
random.seed(SEED)


# ---------- HELPERS ----------
def rand_id(prefix: str = "R", length: int = 4) -> str:
    """Generate a random ID with prefix."""
    return f"{prefix}{''.join(random.choices(string.digits, k=length))}"


def rand_date(start_year: int = 2023, end_year: int = 2024) -> str:
    """Random ISO timestamp in range."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    rand_seconds = random.randint(0, int(delta.total_seconds()))
    return (start + timedelta(seconds=rand_seconds)).isoformat() + "Z"


def _csv_to_markdown(rows: list[list[str]]) -> str:
    """Convert list of rows to Markdown table."""
    if not rows:
        return ""
    lines = ["| " + " | ".join(str(c) for c in rows[0]) + " |"]
    lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")
    for row in rows[1:]:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines)


# ---------- 1. Scope ----------
def generate_scope(out_dir: Path) -> list[str]:
    """Generate scope document and return lines for combined evidence."""
    lines = [
        "# FedRAMP Low Audit Scope (Synthetic)",
        "",
        "The scope of the FedRAMP Low system covers:",
        "",
        "- **Business Units**: Ops Team, DB Team, API Team, Cloud Ops, Backup Team",
        "- **Critical Assets**: VM-APP-01, DB-PAYMENT, API-GATEWAY, LB-WEB, S3-BACKUP",
        "- **Geographical Location**: US-East-1",
        "- **FedRAMP Level**: Low",
        "",
        "The system applies to all information assets and processes within these boundaries.",
    ]
    (out_dir / "scope.md").write_text("\n".join(lines), encoding="utf-8")
    print("Generated scope.md")
    return lines


# ---------- 2. System Inventory ----------
def generate_system_inventory(out_dir: Path) -> list[list[str]]:
    """Generate system inventory and return rows for combined evidence."""
    headers = ["AssetID", "AssetName", "AssetType", "Owner", "Location", "Classification", "FedRAMPLevel"]
    data = [
        ["A001", "VM-APP-01", "Server", "Ops Team", "US-East-1", "Sensitive", "Low"],
        ["A002", "DB-PAYMENT", "Database", "DB Team", "US-East-1", "Sensitive", "Low"],
        ["A003", "API-GATEWAY", "Service", "API Team", "US-East-1", "Public", "Low"],
        ["A004", "LB-WEB", "Load Balancer", "Cloud Ops", "US-East-1", "Public", "Low"],
        ["A005", "S3-BACKUP", "Storage", "Backup Team", "US-East-1", "Sensitive", "Low"],
    ]
    rows = [headers] + data
    with open(out_dir / "system_inventory.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "system_inventory.md").write_text(
        "# System Inventory\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated system_inventory.csv, system_inventory.md")
    return rows


# ---------- 3. Risk Assessment ----------
def generate_risk_assessment(out_dir: Path) -> list[list[str]]:
    """Generate risk assessment and return rows for combined evidence."""
    headers = ["RiskID", "Threat", "Likelihood", "Impact", "Control", "ResidualRisk", "Owner", "Status"]
    data = [
        ["R001", "Unauthorized data access", "Medium", "High", "A.9.2 – MFA", "Medium", "Ops Team", "Mitigated"],
        ["R002", "DDoS on public endpoint", "Low", "Medium", "A.13.1 – DDoS protection", "Low", "Cloud Ops", "Mitigated"],
        ["R003", "Data loss during outage", "High", "High", "A.17.1 – Backup & DR", "Low", "Backup Team", "Mitigated"],
    ]
    rows = [headers] + data
    with open(out_dir / "risk_assessment.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "risk_assessment.md").write_text(
        "# Risk Assessment\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated risk_assessment.csv, risk_assessment.md")
    return rows


# ---------- 4. Controls Implemented ----------
def generate_controls_implemented(out_dir: Path) -> list[list[str]]:
    """Generate controls implemented and return rows for combined evidence."""
    headers = ["ControlID", "Control", "FedRAMPControl", "ImplementationStatus", "EvidenceRef", "TargetDate"]
    data = [
        ["C001", "A.5.1 – Information Security Policy", "FedRAMP – 3.1 – Security Policy", "Implemented", "policy_low.pdf", "2024-12-31"],
        ["C002", "A.9.2 – User Access Management", "FedRAMP – 3.5 – Access Management", "Implemented", "acl_report.pdf", "2024-12-31"],
        ["C003", "A.12.1 – System Operations", "FedRAMP – 5.1 – Logging & Monitoring", "Implemented", "audit_log.csv", "2024-12-31"],
        ["C004", "A.13.1 – Communications Security", "FedRAMP – 6.1 – TLS/SSL", "Implemented", "tls_report.pdf", "2024-12-31"],
        ["C005", "A.18.1 – Compliance", "FedRAMP – 7.2 – FedRAMP Compliance", "Implemented", "SoA_fedramp_low.pdf", "2024-12-31"],
    ]
    rows = [headers] + data
    with open(out_dir / "controls_implemented.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "controls_implemented.md").write_text(
        "# Controls Implemented\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated controls_implemented.csv, controls_implemented.md")
    return rows


# ---------- 5. Access Control List ----------
def generate_access_control_list(out_dir: Path) -> list[list[str]]:
    """Generate access control list and return rows for combined evidence."""
    headers = ["UserID", "UserName", "Role", "AssetID", "Permissions", "MFAEnabled"]
    data = [
        ["U001", "alice@csp.com", "Admin", "A001", "Read,Write,Delete", "Yes"],
        ["U002", "bob@csp.com", "Developer", "A002", "Read,Write", "Yes"],
        ["U003", "charlie@csp.com", "Viewer", "A003", "Read", "Yes"],
        ["U004", "dana@csp.com", "Backup", "A005", "Read,Write", "No"],
    ]
    rows = [headers] + data
    with open(out_dir / "access_control_list.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "access_control_list.md").write_text(
        "# Access Control List\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated access_control_list.csv, access_control_list.md")
    return rows


# ---------- 6. Audit Log ----------
def generate_audit_log(out_dir: Path) -> list[list[str]]:
    """Generate audit log and return rows for combined evidence."""
    ips = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4"]
    headers = ["EventID", "Timestamp", "UserID", "Action", "AssetID", "Success", "SourceIP", "Description"]
    data = [
        ["L001", rand_date(), "U001", "Login", "", "True", ips[0], "Successful MFA login"],
        ["L002", rand_date(), "U002", "Query", "A002", "True", ips[1], "SELECT * FROM orders"],
        ["L003", rand_date(), "U003", "Write", "A003", "False", ips[2], "Unauthorized write attempt"],
        ["L004", rand_date(), "U004", "Backup", "A005", "True", ips[3], "Full daily backup completed"],
    ]
    rows = [headers] + data
    with open(out_dir / "audit_log.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "audit_log.md").write_text(
        "# Audit Log\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated audit_log.csv, audit_log.md")
    return rows


# ---------- 7. Backup Recovery Plan ----------
def generate_backup_recovery_plan(out_dir: Path) -> list[list[str]]:
    """Generate backup recovery plan and return rows for combined evidence."""
    headers = ["BackupID", "AssetID", "Frequency", "RetentionPeriod", "RTO", "RPO"]
    data = [
        ["B001", "A001", "Daily", "30 days", "4 hrs", "4 hrs"],
        ["B002", "A002", "Daily", "30 days", "8 hrs", "4 hrs"],
        ["B003", "A005", "Weekly", "90 days", "24 hrs", "8 hrs"],
    ]
    rows = [headers] + data
    with open(out_dir / "backup_recovery_plan.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    (out_dir / "backup_recovery_plan.md").write_text(
        "# Backup Recovery Plan\n\n" + _csv_to_markdown(rows), encoding="utf-8"
    )
    print("Generated backup_recovery_plan.csv, backup_recovery_plan.md")
    return rows


# ---------- 8. Combined Evidence (single uploadable file) ----------
def generate_combined_evidence(
    out_dir: Path,
    scope_lines: list[str],
    inventory_rows: list[list[str]],
    risk_rows: list[list[str]],
    control_rows: list[list[str]],
    acl_rows: list[list[str]],
    audit_rows: list[list[str]],
    backup_rows: list[list[str]],
) -> None:
    """Generate one combined Markdown file for easy upload as evidence."""
    sections = [
        "# Synthetic FedRAMP Low Evidence (Gap Analysis Simulation)",
        "",
        "This document combines scope, system inventory, risk assessment, controls, ACL, audit log, and backup plan.",
        "",
        "---",
        "",
        "\n".join(scope_lines),
        "",
        "---",
        "",
        "## System Inventory",
        "",
        _csv_to_markdown(inventory_rows),
        "",
        "---",
        "",
        "## Risk Assessment",
        "",
        _csv_to_markdown(risk_rows),
        "",
        "---",
        "",
        "## Controls Implemented",
        "",
        _csv_to_markdown(control_rows),
        "",
        "---",
        "",
        "## Access Control List",
        "",
        _csv_to_markdown(acl_rows),
        "",
        "---",
        "",
        "## Audit Log",
        "",
        _csv_to_markdown(audit_rows),
        "",
        "---",
        "",
        "## Backup Recovery Plan",
        "",
        _csv_to_markdown(backup_rows),
    ]
    (out_dir / "synthetic_evidence.md").write_text("\n".join(sections), encoding="utf-8")
    print("Generated synthetic_evidence.md (upload this as evidence for gap analysis)")


# ---------- MAIN ----------
def main() -> None:
    """Generate all synthetic data files."""
    out_dir = Path(OUTPUT_DIR)
    out_dir.mkdir(exist_ok=True)
    orig_cwd = os.getcwd()
    try:
        os.chdir(Path(__file__).resolve().parent.parent)
        out_dir = Path(OUTPUT_DIR)
        out_dir.mkdir(exist_ok=True)

        scope_lines = generate_scope(out_dir)
        inventory_rows = generate_system_inventory(out_dir)
        risk_rows = generate_risk_assessment(out_dir)
        control_rows = generate_controls_implemented(out_dir)
        acl_rows = generate_access_control_list(out_dir)
        audit_rows = generate_audit_log(out_dir)
        backup_rows = generate_backup_recovery_plan(out_dir)

        generate_combined_evidence(
            out_dir,
            scope_lines,
            inventory_rows,
            risk_rows,
            control_rows,
            acl_rows,
            audit_rows,
            backup_rows,
        )

        print("")
        print("Done. Next steps:")
        print("  1. Go to Marlowe → Compliance & Gap Analysis")
        print("  2. Load NIST 800-53 (or add a NIST framework)")
        print("  3. Upload synthetic_evidence.md as evidence (Upload Evidence button)")
        print("  4. Extract requirements (if needed) or add requirements manually")
        print("  5. Run Gap Analysis")
    finally:
        os.chdir(orig_cwd)


if __name__ == "__main__":
    main()
