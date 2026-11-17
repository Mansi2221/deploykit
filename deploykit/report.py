"""Report generation: terminal (rich), JSON, and HTML output."""

import json
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from deploykit.models import Report, Severity

SEVERITY_ICONS = {
    Severity.PASS: "[green]PASS[/green]",
    Severity.WARN: "[yellow]WARN[/yellow]",
    Severity.FAIL: "[red]FAIL[/red]",
}

SEVERITY_COLORS = {
    Severity.PASS: "green",
    Severity.WARN: "yellow",
    Severity.FAIL: "red",
}

CATEGORY_LABELS = {
    "security": "Security",
    "llm_config": "LLM Configuration",
    "api_health": "API Health",
    "infra": "Infrastructure",
    "cost": "Cost",
    "reliability": "Reliability",
}


def render_terminal(report: Report, console: Console | None = None) -> None:
    """Render the report to the terminal using rich."""
    if console is None:
        console = Console()

    # Header
    project_name = Path(report.project_path).name
    score_color = "green" if report.score >= 80 else "yellow" if report.score >= 50 else "red"

    header = Text()
    header.append("deploykit ", style="bold cyan")
    header.append("Production Readiness Report\n\n", style="bold")
    header.append(f"Project: ", style="dim")
    header.append(f"{project_name}\n", style="bold")
    header.append(f"Path:    ", style="dim")
    header.append(f"{report.project_path}\n", style="")
    header.append(f"Score:   ", style="dim")
    header.append(f"{report.score}/100", style=f"bold {score_color}")

    console.print(Panel(header, border_style="cyan", padding=(1, 2)))
    console.print()

    # Group checks by category
    categories: dict[str, list] = {}
    for check in report.checks:
        categories.setdefault(check.category, []).append(check)

    category_order = ["security", "llm_config", "api_health", "infra", "cost", "reliability"]

    for cat in category_order:
        checks = categories.get(cat, [])
        if not checks:
            continue

        label = CATEGORY_LABELS.get(cat, cat)
        cat_pass = sum(1 for c in checks if c.severity == Severity.PASS)
        cat_total = len(checks)

        table = Table(
            title=f"{label} ({cat_pass}/{cat_total} passed)",
            title_style="bold",
            show_header=True,
            header_style="bold dim",
            border_style="dim",
            pad_edge=False,
            expand=True,
        )
        table.add_column("Status", width=6, justify="center")
        table.add_column("Check", ratio=2)
        table.add_column("Details", ratio=3)
        table.add_column("File", ratio=2, style="dim")

        for check in checks:
            icon = SEVERITY_ICONS[check.severity]
            file_info = ""
            if check.file:
                file_info = check.file
                if check.line:
                    file_info += f":{check.line}"

            table.add_row(icon, check.name, check.message, file_info)

        console.print(table)
        console.print()

    # Cost estimate section
    if report.cost_estimate and report.cost_estimate.get("models"):
        cost_table = Table(
            title="Cost Estimate",
            title_style="bold",
            show_header=True,
            header_style="bold dim",
            border_style="dim",
            expand=True,
        )
        cost_table.add_column("Model", ratio=2)
        cost_table.add_column("Tier", width=6, justify="center")
        cost_table.add_column("Monthly (Low)", ratio=1, justify="right")
        cost_table.add_column("Monthly (High)", ratio=1, justify="right")

        for model, info in report.cost_estimate["models"].items():
            tier_color = {"low": "green", "mid": "yellow", "high": "red"}.get(info["tier"], "white")
            cost_table.add_row(
                model,
                f"[{tier_color}]{info['tier']}[/{tier_color}]",
                f"${info['monthly_low']:.2f}",
                f"${info['monthly_high']:.2f}",
            )

        total_low = report.cost_estimate["total_monthly_low"]
        total_high = report.cost_estimate["total_monthly_high"]
        cost_table.add_row("", "", "--------", "--------", style="dim")
        cost_table.add_row("Total", "", f"${total_low:.2f}", f"${total_high:.2f}", style="bold")

        console.print(cost_table)
        console.print(f"  [dim]{report.cost_estimate['assumptions']}[/dim]")
        console.print()

    # Summary
    summary = Table(show_header=False, border_style="dim", expand=True, padding=(0, 2))
    summary.add_column("Label", style="dim")
    summary.add_column("Value", justify="right")

    summary.add_row("Total checks", str(report.total_checks))
    summary.add_row("Passed", f"[green]{report.passed}[/green]")
    summary.add_row("Warnings", f"[yellow]{report.warnings}[/yellow]")
    summary.add_row("Failures", f"[red]{report.failures}[/red]")

    console.print(Panel(summary, title="Summary", border_style="cyan"))
    console.print()

    # Top recommendations
    issues = [c for c in report.checks if c.severity in (Severity.FAIL, Severity.WARN) and c.suggestion]
    # Sort: failures first, then warnings
    issues.sort(key=lambda c: (0 if c.severity == Severity.FAIL else 1))

    if issues:
        console.print("[bold]Top Recommendations:[/bold]")
        for i, issue in enumerate(issues[:5], 1):
            icon = "[red]![/red]" if issue.severity == Severity.FAIL else "[yellow]*[/yellow]"
            console.print(f"  {icon} {issue.suggestion}")
        console.print()


def render_json(report: Report) -> str:
    """Render the report as a JSON string."""
    return report.model_dump_json(indent=2)


def render_html(report: Report) -> str:
    """Render the report as a standalone HTML file."""
    project_name = Path(report.project_path).name
    score_color = "#22c55e" if report.score >= 80 else "#eab308" if report.score >= 50 else "#ef4444"

    severity_colors = {
        "pass": "#22c55e",
        "warn": "#eab308",
        "fail": "#ef4444",
    }

    # Build category sections
    categories: dict[str, list] = {}
    for check in report.checks:
        categories.setdefault(check.category, []).append(check)

    category_html = ""
    for cat in ["security", "llm_config", "api_health", "infra", "cost", "reliability"]:
        checks = categories.get(cat, [])
        if not checks:
            continue

        label = CATEGORY_LABELS.get(cat, cat)
        rows = ""
        for check in checks:
            color = severity_colors[check.severity.value]
            file_info = ""
            if check.file:
                file_info = check.file
                if check.line:
                    file_info += f":{check.line}"
            suggestion = f'<div class="suggestion">{check.suggestion}</div>' if check.suggestion else ""

            rows += f"""
            <tr>
                <td><span class="badge" style="background:{color}">{check.severity.value.upper()}</span></td>
                <td class="check-name">{check.name}</td>
                <td>{check.message}{suggestion}</td>
                <td class="file-info">{file_info}</td>
            </tr>"""

        category_html += f"""
        <div class="category">
            <h2>{label}</h2>
            <table>
                <thead>
                    <tr><th>Status</th><th>Check</th><th>Details</th><th>File</th></tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>"""

    # Cost estimate section
    cost_html = ""
    if report.cost_estimate and report.cost_estimate.get("models"):
        cost_rows = ""
        for model, info in report.cost_estimate["models"].items():
            tier_color = {"low": "#22c55e", "mid": "#eab308", "high": "#ef4444"}.get(info["tier"], "#888")
            cost_rows += f"""
            <tr>
                <td>{model}</td>
                <td><span class="badge" style="background:{tier_color}">{info['tier']}</span></td>
                <td>${info['monthly_low']:.2f}</td>
                <td>${info['monthly_high']:.2f}</td>
            </tr>"""

        total_low = report.cost_estimate["total_monthly_low"]
        total_high = report.cost_estimate["total_monthly_high"]
        cost_html = f"""
        <div class="category">
            <h2>Cost Estimate</h2>
            <table>
                <thead><tr><th>Model</th><th>Tier</th><th>Monthly (Low)</th><th>Monthly (High)</th></tr></thead>
                <tbody>
                    {cost_rows}
                    <tr class="total-row"><td><strong>Total</strong></td><td></td><td><strong>${total_low:.2f}</strong></td><td><strong>${total_high:.2f}</strong></td></tr>
                </tbody>
            </table>
            <p class="assumptions">{report.cost_estimate['assumptions']}</p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>deploykit Report - {project_name}</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; line-height: 1.6; }}
    .container {{ max-width: 960px; margin: 0 auto; }}
    .header {{ background: #1e293b; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; border: 1px solid #334155; }}
    .header h1 {{ font-size: 1.5rem; color: #38bdf8; margin-bottom: 0.5rem; }}
    .header .meta {{ color: #94a3b8; font-size: 0.9rem; }}
    .score {{ font-size: 3rem; font-weight: 800; color: {score_color}; float: right; margin-top: -3rem; }}
    .score span {{ font-size: 1.2rem; color: #64748b; font-weight: 400; }}
    .summary-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }}
    .summary-card {{ background: #1e293b; border-radius: 8px; padding: 1rem; text-align: center; border: 1px solid #334155; }}
    .summary-card .number {{ font-size: 2rem; font-weight: 700; }}
    .summary-card .label {{ color: #94a3b8; font-size: 0.85rem; }}
    .category {{ background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }}
    .category h2 {{ font-size: 1.1rem; margin-bottom: 1rem; color: #f1f5f9; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.9rem; }}
    thead th {{ text-align: left; padding: 0.5rem; border-bottom: 1px solid #334155; color: #94a3b8; font-weight: 500; }}
    tbody td {{ padding: 0.5rem; border-bottom: 1px solid #1e293b; vertical-align: top; }}
    tbody tr:hover {{ background: #334155; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: #0f172a; text-transform: uppercase; }}
    .check-name {{ font-weight: 500; color: #cbd5e1; white-space: nowrap; }}
    .file-info {{ color: #64748b; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }}
    .suggestion {{ color: #94a3b8; font-size: 0.8rem; margin-top: 0.25rem; font-style: italic; }}
    .assumptions {{ color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; }}
    .total-row td {{ border-top: 2px solid #475569; }}
    .footer {{ text-align: center; color: #475569; font-size: 0.8rem; margin-top: 2rem; }}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>deploykit</h1>
        <div class="meta">Production Readiness Report</div>
        <div class="meta">Project: <strong>{project_name}</strong></div>
        <div class="meta">{report.project_path}</div>
        <div class="score">{report.score}<span>/100</span></div>
    </div>

    <div class="summary-grid">
        <div class="summary-card"><div class="number">{report.total_checks}</div><div class="label">Total Checks</div></div>
        <div class="summary-card"><div class="number" style="color:#22c55e">{report.passed}</div><div class="label">Passed</div></div>
        <div class="summary-card"><div class="number" style="color:#eab308">{report.warnings}</div><div class="label">Warnings</div></div>
        <div class="summary-card"><div class="number" style="color:#ef4444">{report.failures}</div><div class="label">Failures</div></div>
    </div>

    {category_html}
    {cost_html}

    <div class="footer">Generated by deploykit v0.1.0</div>
</div>
</body>
</html>"""
