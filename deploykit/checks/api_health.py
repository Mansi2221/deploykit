"""API health checks: health endpoints, CORS, rate limiting, error handlers."""

import os
import re
from pathlib import Path

from deploykit.models import CheckResult, Severity

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build", ".eggs"}
CODE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx"}

# Framework detection patterns
FASTAPI_PATTERNS = [r'from\s+fastapi\s+import', r'import\s+fastapi', r'FastAPI\s*\(']
EXPRESS_PATTERNS = [r'require\s*\(\s*["\']express["\']\s*\)', r'from\s+["\']express["\']', r'express\s*\(\s*\)']
NEXTJS_PATTERNS = [r'from\s+["\']next', r'next\.config', r'getServerSideProps', r'getStaticProps']
FLASK_PATTERNS = [r'from\s+flask\s+import', r'import\s+flask', r'Flask\s*\(']
DJANGO_PATTERNS = [r'from\s+django', r'import\s+django', r'DJANGO_SETTINGS_MODULE']

# Health endpoint patterns
HEALTH_PATTERNS = [
    r'''['"]/health['"]''',
    r'''['"]/healthz['"]''',
    r'''['"]/health[_-]?check['"]''',
    r'''['"]/ready['"]''',
    r'''['"]/readiness['"]''',
    r'''['"]/liveness['"]''',
    r'''['"]/ping['"]''',
    r'''['"]/status['"]''',
    r'''['"]/_health['"]''',
    r'''health[-_]?check''',
]

# CORS patterns
CORS_PATTERNS = [
    r'CORSMiddleware', r'cors\s*\(', r'cors\s*=', r'CORS\s*\(',
    r'Access-Control-Allow-Origin', r'cors:', r'allowedOrigins',
    r'require\s*\(\s*["\']cors["\']\s*\)', r'from\s+["\']cors["\']',
    r'helmet', r'@cross_origin',
]

# Rate limiting patterns
RATE_LIMIT_PATTERNS = [
    r'rate[-_]?limit', r'RateLimit', r'rateLimit',
    r'SlowAPI', r'slowapi', r'Limiter\s*\(',
    r'express-rate-limit', r'ratelimit',
    r'throttle', r'Throttle',
    r'token[-_]?bucket', r'leaky[-_]?bucket',
]

# Error handler patterns
ERROR_HANDLER_PATTERNS = [
    r'@app\.exception_handler', r'@app\.errorhandler',
    r'app\.use\s*\(\s*(?:function\s*\()?err',
    r'exception_handler', r'error_handler',
    r'HTTPException', r'app\.use\s*\(\s*\(err',
    r'process\.on\s*\(\s*["\']uncaughtException',
    r'process\.on\s*\(\s*["\']unhandledRejection',
    r'ErrorBoundary',
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


def _detect_framework(project_path: Path, files: list[Path]) -> str | None:
    """Detect which web framework is being used."""
    all_content = ""
    for fpath in files[:50]:  # Sample first 50 files
        try:
            all_content += fpath.read_text(errors="ignore") + "\n"
        except (OSError, UnicodeDecodeError):
            continue

    # Also check package files
    for pkg_file in ["package.json", "requirements.txt", "pyproject.toml", "Pipfile"]:
        pkg_path = project_path / pkg_file
        if pkg_path.exists():
            try:
                all_content += pkg_path.read_text(errors="ignore") + "\n"
            except (OSError, UnicodeDecodeError):
                pass

    if any(re.search(p, all_content) for p in FASTAPI_PATTERNS):
        return "fastapi"
    if any(re.search(p, all_content) for p in FLASK_PATTERNS):
        return "flask"
    if any(re.search(p, all_content) for p in DJANGO_PATTERNS):
        return "django"
    if any(re.search(p, all_content) for p in EXPRESS_PATTERNS):
        return "express"
    if any(re.search(p, all_content) for p in NEXTJS_PATTERNS):
        return "nextjs"

    return None


def _check_health_endpoint(project_path: Path, files: list[Path], framework: str | None) -> list[CheckResult]:
    """Check for health check endpoint."""
    if framework is None:
        return [CheckResult(
            name="health_endpoint",
            category="api_health",
            severity=Severity.PASS,
            message="No web framework detected (health endpoint check skipped)",
        )]

    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if any(re.search(p, content, re.IGNORECASE) for p in HEALTH_PATTERNS):
            return [CheckResult(
                name="health_endpoint",
                category="api_health",
                severity=Severity.PASS,
                message="Health check endpoint detected",
            )]

    return [CheckResult(
        name="health_endpoint",
        category="api_health",
        severity=Severity.WARN,
        message=f"No health check endpoint found ({framework} app detected)",
        suggestion="Add a /health endpoint for load balancer and monitoring integration.",
    )]


def _check_cors(project_path: Path, files: list[Path], framework: str | None) -> list[CheckResult]:
    """Check for CORS configuration."""
    if framework is None:
        return []

    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if any(re.search(p, content, re.IGNORECASE) for p in CORS_PATTERNS):
            return [CheckResult(
                name="cors_config",
                category="api_health",
                severity=Severity.PASS,
                message="CORS configuration detected",
            )]

    return [CheckResult(
        name="cors_config",
        category="api_health",
        severity=Severity.WARN,
        message="No CORS configuration detected",
        suggestion="Configure CORS to control which domains can access your API.",
    )]


def _check_rate_limiting(project_path: Path, files: list[Path], framework: str | None) -> list[CheckResult]:
    """Check for rate limiting."""
    if framework is None:
        return []

    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if any(re.search(p, content, re.IGNORECASE) for p in RATE_LIMIT_PATTERNS):
            return [CheckResult(
                name="rate_limiting",
                category="api_health",
                severity=Severity.PASS,
                message="Rate limiting detected",
            )]

    # Also check package files
    for pkg_file in ["package.json", "requirements.txt", "pyproject.toml"]:
        pkg_path = project_path / pkg_file
        if pkg_path.exists():
            try:
                content = pkg_path.read_text(errors="ignore")
                if any(re.search(p, content, re.IGNORECASE) for p in RATE_LIMIT_PATTERNS):
                    return [CheckResult(
                        name="rate_limiting",
                        category="api_health",
                        severity=Severity.PASS,
                        message="Rate limiting dependency detected",
                    )]
            except (OSError, UnicodeDecodeError):
                pass

    return [CheckResult(
        name="rate_limiting",
        category="api_health",
        severity=Severity.WARN,
        message="No rate limiting detected",
        suggestion="Add rate limiting to protect your API from abuse and control costs.",
    )]


def _check_error_handlers(project_path: Path, files: list[Path], framework: str | None) -> list[CheckResult]:
    """Check for global error handlers."""
    if framework is None:
        return []

    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if any(re.search(p, content) for p in ERROR_HANDLER_PATTERNS):
            return [CheckResult(
                name="error_handlers",
                category="api_health",
                severity=Severity.PASS,
                message="Global error handling detected",
            )]

    return [CheckResult(
        name="error_handlers",
        category="api_health",
        severity=Severity.WARN,
        message="No global error handler detected",
        suggestion="Add global exception handlers to return proper error responses and avoid leaking stack traces.",
    )]


def run_api_health_checks(project_path: Path) -> list[CheckResult]:
    """Run all API health checks."""
    files = _iter_code_files(project_path)
    framework = _detect_framework(project_path, files)

    results = []
    results.extend(_check_health_endpoint(project_path, files, framework))
    results.extend(_check_cors(project_path, files, framework))
    results.extend(_check_rate_limiting(project_path, files, framework))
    results.extend(_check_error_handlers(project_path, files, framework))
    return results
