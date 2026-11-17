"""Click CLI entrypoint for deploykit."""

import sys
from pathlib import Path

import click
from rich.console import Console

from deploykit import __version__
from deploykit.report import render_html, render_json, render_terminal
from deploykit.scanner import scan


@click.group()
@click.version_option(version=__version__, prog_name="deploykit")
def main() -> None:
    """deploykit - Production readiness scanner for AI applications."""


@main.command()
@click.argument("path", type=click.Path(exists=True, file_okay=False, resolve_path=True))
@click.option(
    "--format", "-f",
    "output_format",
    type=click.Choice(["terminal", "json", "html"]),
    default="terminal",
    help="Output format for the report.",
)
@click.option(
    "--output", "-o",
    "output_file",
    type=click.Path(),
    default=None,
    help="Write report to file (required for HTML, optional for JSON).",
)
@click.option(
    "--fail-under",
    type=float,
    default=None,
    help="Exit with code 1 if score is below this threshold.",
)
def scan_cmd(path: str, output_format: str, output_file: str | None, fail_under: float | None) -> None:
    """Scan a project directory for production readiness."""
    console = Console(stderr=True)

    try:
        report = scan(path)
    except (FileNotFoundError, NotADirectoryError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    if output_format == "terminal":
        render_terminal(report, Console())
    elif output_format == "json":
        output = render_json(report)
        if output_file:
            Path(output_file).write_text(output)
            console.print(f"[green]Report written to {output_file}[/green]")
        else:
            click.echo(output)
    elif output_format == "html":
        output = render_html(report)
        if output_file:
            Path(output_file).write_text(output)
            console.print(f"[green]HTML report written to {output_file}[/green]")
        else:
            default_name = f"deploykit-report.html"
            Path(default_name).write_text(output)
            console.print(f"[green]HTML report written to {default_name}[/green]")

    if fail_under is not None and report.score < fail_under:
        console.print(f"[red]Score {report.score} is below threshold {fail_under}[/red]")
        sys.exit(1)
