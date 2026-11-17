"""Reliability checks: logging, monitoring, graceful shutdown."""

import os
import re
from pathlib import Path

from deploykit.models import CheckResult, Severity

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build", ".eggs"}
CODE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx"}

# Logging patterns
PYTHON_LOGGING_PATTERNS = [
    r'import\s+logging', r'from\s+logging\s+import',
    r'logging\.getLogger', r'logger\s*=\s*logging',
    r'from\s+loguru\s+import', r'import\s+loguru',
    r'structlog', r'import\s+structlog',
]

JS_LOGGING_PATTERNS = [
    r'require\s*\(\s*["\']winston["\']\s*\)', r'from\s+["\']winston["\']',
    r'require\s*\(\s*["\']pino["\']\s*\)', r'from\s+["\']pino["\']',
    r'require\s*\(\s*["\']bunyan["\']\s*\)', r'from\s+["\']bunyan["\']',
    r'require\s*\(\s*["\']log4js["\']\s*\)', r'from\s+["\']log4js["\']',
]

# Structured logging patterns
STRUCTURED_LOG_PATTERNS = [
    r'structlog', r'json[-_]?log', r'JsonFormatter',
    r'pino', r'bunyan',
    r'logging\.config\.dictConfig',
    r'format.*json', r'json.*format',
    r'log_format.*json',
]

# Monitoring / observability patterns
MONITORING_PATTERNS = [
    r'opentelemetry', r'otel', r'OpenTelemetry',
    r'sentry[-_]?sdk', r'sentry_sdk', r'Sentry\.init', r'@sentry',
    r'datadog', r'ddtrace', r'Datadog',
    r'newrelic', r'new[-_]relic', r'NewRelic',
    r'prometheus', r'prometheus_client',
    r'grafana',
    r'honeycomb',
    r'bugsnag', r'Bugsnag',
    r'rollbar', r'Rollbar',
    r'axiom',
    r'langsmith', r'langfuse', r'helicone',  # LLM-specific observability
]

# Graceful shutdown patterns
SHUTDOWN_PATTERNS_PY = [
    r'signal\.signal\s*\(\s*signal\.SIGTERM',
    r'signal\.signal\s*\(\s*signal\.SIGINT',
    r'atexit\.register',
    r'app\.on_event\s*\(\s*["\']shutdown["\']',
    r'@app\.on_event\s*\(\s*["\']shutdown["\']',
    r'lifespan',  # FastAPI lifespan
    r'shutdown_event',
]

SHUTDOWN_PATTERNS_JS = [
    r'process\.on\s*\(\s*["\']SIGTERM',
    r'process\.on\s*\(\s*["\']SIGINT',
    r'server\.close\s*\(',
    r'graceful[-_]?shutdown',
    r'beforeExit',
]


def _iter_code_files(project_path: Path) -> list[Path]:
    files = []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix in CODE_EXTENSIONS:
                files.append(fpath)
    return files


def _read_all_content(project_path: Path, files: list[Path]) -> str:
    """Read all file contents into one string for pattern matching."""
    parts = []
    for fpath in files:
        try:
            parts.append(fpath.read_text(errors="ignore"))
        except (OSError, UnicodeDecodeError):
            continue

    # Also include dependency files
    for pkg_file in ["package.json", "requirements.txt", "pyproject.toml", "Pipfile"]:
        pkg_path = project_path / pkg_file
        if pkg_path.exists():
            try:
                parts.append(pkg_path.read_text(errors="ignore"))
            except (OSError, UnicodeDecodeError):
                pass

    return "\n".join(parts)


def _check_logging(all_content: str) -> list[CheckResult]:
    """Check for logging setup."""
    all_patterns = PYTHON_LOGGING_PATTERNS + JS_LOGGING_PATTERNS
    has_logging = any(re.search(p, all_content) for p in all_patterns)

    # Also count bare print/console.log usage
    print_count = len(re.findall(r'\bprint\s*\(', all_content))
    console_count = len(re.findall(r'console\.log\s*\(', all_content))

    results = []

    if has_logging:
        results.append(CheckResult(
            name="logging_setup",
            category="reliability",
            severity=Severity.PASS,
            message="Logging library detected",
        ))
    else:
        results.append(CheckResult(
            name="logging_setup",
            category="reliability",
            severity=Severity.WARN,
            message="No logging library detected",
            suggestion="Set up structured logging with Python's logging module, loguru, winston, or pino.",
        ))

    if print_count + console_count > 10 and not has_logging:
        results.append(CheckResult(
            name="print_debugging",
            category="reliability",
            severity=Severity.WARN,
            message=f"Found {print_count + console_count} print/console.log statements without a logging library",
            suggestion="Replace print statements with proper logging for better production observability.",
        ))

    return results


def _check_structured_logging(all_content: str) -> list[CheckResult]:
    """Check for structured (JSON) logging."""
    has_structured = any(re.search(p, all_content, re.IGNORECASE) for p in STRUCTURED_LOG_PATTERNS)

    if has_structured:
        return [CheckResult(
            name="structured_logging",
            category="reliability",
            severity=Severity.PASS,
            message="Structured logging detected",
        )]

    return [CheckResult(
        name="structured_logging",
        category="reliability",
        severity=Severity.WARN,
        message="No structured logging detected",
        suggestion="Use structured (JSON) logging for better log aggregation and searching.",
    )]


def _check_monitoring(all_content: str) -> list[CheckResult]:
    """Check for monitoring/observability setup."""
    has_monitoring = any(re.search(p, all_content, re.IGNORECASE) for p in MONITORING_PATTERNS)

    if has_monitoring:
        return [CheckResult(
            name="monitoring",
            category="reliability",
            severity=Severity.PASS,
            message="Monitoring/observability tooling detected",
        )]

    return [CheckResult(
        name="monitoring",
        category="reliability",
        severity=Severity.WARN,
        message="No monitoring or observability tooling detected",
        suggestion="Add Sentry, OpenTelemetry, or Datadog for error tracking and performance monitoring.",
    )]


def _check_graceful_shutdown(all_content: str) -> list[CheckResult]:
    """Check for graceful shutdown handlers."""
    all_patterns = SHUTDOWN_PATTERNS_PY + SHUTDOWN_PATTERNS_JS
    has_shutdown = any(re.search(p, all_content) for p in all_patterns)

    if has_shutdown:
        return [CheckResult(
            name="graceful_shutdown",
            category="reliability",
            severity=Severity.PASS,
            message="Graceful shutdown handling detected",
        )]

    return [CheckResult(
        name="graceful_shutdown",
        category="reliability",
        severity=Severity.WARN,
        message="No graceful shutdown handling detected",
        suggestion="Handle SIGTERM/SIGINT signals to cleanly shut down connections and in-flight requests.",
    )]


def run_reliability_checks(project_path: Path) -> list[CheckResult]:
    """Run all reliability checks."""
    files = _iter_code_files(project_path)
    all_content = _read_all_content(project_path, files)

    if not all_content.strip():
        return [CheckResult(
            name="reliability",
            category="reliability",
            severity=Severity.PASS,
            message="No source files found (reliability checks skipped)",
        )]

    results = []
    results.extend(_check_logging(all_content))
    results.extend(_check_structured_logging(all_content))
    results.extend(_check_monitoring(all_content))
    results.extend(_check_graceful_shutdown(all_content))
    return results
