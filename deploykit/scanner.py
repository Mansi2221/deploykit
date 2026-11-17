"""Main scanner orchestrator for deploykit."""

from pathlib import Path

from deploykit.checks import ALL_CHECKS
from deploykit.checks.cost import run_cost_checks
from deploykit.models import CheckResult, Report, Severity


def scan(project_path: str | Path) -> Report:
    """Scan a project directory and generate a production readiness report.

    Args:
        project_path: Path to the project directory to scan.

    Returns:
        A Report containing all check results and an overall score.

    Raises:
        FileNotFoundError: If the project path does not exist.
        NotADirectoryError: If the project path is not a directory.
    """
    path = Path(project_path).resolve()

    if not path.exists():
        raise FileNotFoundError(f"Project path does not exist: {path}")
    if not path.is_dir():
        raise NotADirectoryError(f"Project path is not a directory: {path}")

    all_results: list[CheckResult] = []

    for check_fn in ALL_CHECKS:
        results = check_fn(path)
        all_results.extend(results)

    passed = sum(1 for r in all_results if r.severity == Severity.PASS)
    warnings = sum(1 for r in all_results if r.severity == Severity.WARN)
    failures = sum(1 for r in all_results if r.severity == Severity.FAIL)
    total = len(all_results)

    # Score: pass=100%, warn=50%, fail=0% — weighted average
    if total > 0:
        score = round((passed * 100 + warnings * 50) / total, 1)
    else:
        score = 100.0

    # Retrieve cost estimate if available
    cost_estimate = getattr(run_cost_checks, "_last_estimate", None)

    return Report(
        project_path=str(path),
        total_checks=total,
        passed=passed,
        warnings=warnings,
        failures=failures,
        score=score,
        checks=all_results,
        cost_estimate=cost_estimate,
    )
