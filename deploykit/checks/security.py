"""Security checks: API key detection, secrets scanning, debug mode."""

import os
import re
from pathlib import Path

from deploykit.models import CheckResult, Severity

# Patterns that indicate hardcoded secrets
SECRET_PATTERNS = [
    (r'sk-[a-zA-Z0-9]{20,}', "OpenAI API key"),
    (r'sk-ant-[a-zA-Z0-9\-]{20,}', "Anthropic API key"),
    (r'AKIA[0-9A-Z]{16}', "AWS Access Key ID"),
    (r'ghp_[a-zA-Z0-9]{36}', "GitHub Personal Access Token"),
    (r'gho_[a-zA-Z0-9]{36}', "GitHub OAuth Token"),
    (r'glpat-[a-zA-Z0-9\-]{20,}', "GitLab Personal Access Token"),
    (r'xoxb-[0-9]{10,}-[a-zA-Z0-9]+', "Slack Bot Token"),
    (r'xoxp-[0-9]{10,}-[a-zA-Z0-9]+', "Slack User Token"),
    (r'SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}', "SendGrid API Key"),
    (r'AIza[0-9A-Za-z\-_]{35}', "Google API Key"),
]

# Patterns for assignment of secrets to variables
ASSIGNMENT_PATTERNS = [
    (r'''(?:api_key|apikey|api_secret|secret_key|access_token|auth_token|password)\s*=\s*["'][^"']{8,}["']''',
     "Hardcoded secret in variable assignment"),
    (r'''(?:API_KEY|APIKEY|API_SECRET|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD)\s*=\s*["'][^"']{8,}["']''',
     "Hardcoded secret in constant assignment"),
]

SCAN_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".env", ".yaml", ".yml", ".toml", ".json", ".cfg", ".ini"}

# Files/dirs to skip
SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build", ".eggs"}


def _iter_files(project_path: Path) -> list[Path]:
    """Iterate over scannable files in the project."""
    files = []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix in SCAN_EXTENSIONS or fpath.name.startswith(".env"):
                files.append(fpath)
    return files


def _check_hardcoded_secrets(project_path: Path) -> list[CheckResult]:
    """Scan source files for hardcoded API keys and secrets."""
    results = []
    files = _iter_files(project_path)
    found_any = False

    for fpath in files:
        # Skip .env files for this check (handled separately)
        if fpath.name.startswith(".env"):
            continue
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue

        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("//"):
                continue

            for pattern, label in SECRET_PATTERNS:
                if re.search(pattern, line):
                    found_any = True
                    rel = str(fpath.relative_to(project_path))
                    results.append(CheckResult(
                        name="hardcoded_secret",
                        category="security",
                        severity=Severity.FAIL,
                        message=f"Possible {label} found in source code",
                        file=rel,
                        line=line_num,
                        suggestion="Move secrets to environment variables and use a secrets manager.",
                    ))

            for pattern, label in ASSIGNMENT_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    found_any = True
                    rel = str(fpath.relative_to(project_path))
                    results.append(CheckResult(
                        name="hardcoded_secret_assignment",
                        category="security",
                        severity=Severity.FAIL,
                        message=f"{label}",
                        file=rel,
                        line=line_num,
                        suggestion="Use os.environ or a config management library instead of hardcoding secrets.",
                    ))

    if not found_any:
        results.append(CheckResult(
            name="hardcoded_secret",
            category="security",
            severity=Severity.PASS,
            message="No hardcoded secrets detected in source files",
        ))

    return results


def _check_env_in_gitignore(project_path: Path) -> list[CheckResult]:
    """Check if .env is listed in .gitignore."""
    gitignore = project_path / ".gitignore"
    env_files = list(project_path.glob(".env*"))

    if not env_files:
        return [CheckResult(
            name="env_in_gitignore",
            category="security",
            severity=Severity.PASS,
            message="No .env files found in project root",
        )]

    if not gitignore.exists():
        return [CheckResult(
            name="env_in_gitignore",
            category="security",
            severity=Severity.FAIL,
            message=".env files exist but no .gitignore found",
            suggestion="Create a .gitignore file and add .env to it.",
        )]

    content = gitignore.read_text(errors="ignore")
    lines = [l.strip() for l in content.splitlines()]

    if ".env" in lines or ".env*" in lines or ".env.*" in lines:
        return [CheckResult(
            name="env_in_gitignore",
            category="security",
            severity=Severity.PASS,
            message=".env is properly listed in .gitignore",
        )]

    return [CheckResult(
        name="env_in_gitignore",
        category="security",
        severity=Severity.FAIL,
        message=".env files exist but .env is not in .gitignore",
        suggestion="Add '.env' to your .gitignore to prevent committing secrets.",
    )]


def _check_env_has_values(project_path: Path) -> list[CheckResult]:
    """Check if .env files contain real values (not just placeholders)."""
    results = []
    env_files = list(project_path.glob(".env*"))

    for env_file in env_files:
        if env_file.name == ".env.example" or env_file.name == ".env.template":
            continue
        try:
            content = env_file.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue

        for line_num, line in enumerate(content.splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" in stripped:
                key, _, value = stripped.partition("=")
                value = value.strip().strip("\"'")
                if value and value not in {"", "your-key-here", "changeme", "xxx", "TODO"}:
                    # Check if it looks like a real secret
                    for pattern, label in SECRET_PATTERNS:
                        if re.search(pattern, value):
                            rel = str(env_file.relative_to(project_path))
                            results.append(CheckResult(
                                name="env_has_real_secrets",
                                category="security",
                                severity=Severity.WARN,
                                message=f".env file contains what appears to be a real {label}",
                                file=rel,
                                line=line_num,
                                suggestion="Ensure .env files are never committed. Use .env.example with placeholder values.",
                            ))

    if not results:
        results.append(CheckResult(
            name="env_has_real_secrets",
            category="security",
            severity=Severity.PASS,
            message="No real secrets detected in .env files",
        ))

    return results


def _check_debug_mode(project_path: Path) -> list[CheckResult]:
    """Check for debug mode enabled in settings."""
    results = []
    files = _iter_files(project_path)
    found_debug = False

    debug_patterns = [
        (r'\bDEBUG\s*=\s*True\b', "DEBUG=True found"),
        (r'\bdebug\s*=\s*True\b', "debug=True found"),
        (r'\bDEBUG\s*=\s*true\b', "DEBUG=true found"),
        (r'\bdebug\s*:\s*true\b', "debug: true found"),
        (r'\bNODE_ENV\s*=\s*["\']?development["\']?', "NODE_ENV set to development"),
    ]

    for fpath in files:
        # Only check config-like files
        is_env_file = fpath.name.startswith(".env")
        if not is_env_file and fpath.suffix not in {".py", ".yaml", ".yml", ".toml", ".json", ".cfg", ".ini"}:
            continue
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue

        for line_num, line in enumerate(content.splitlines(), start=1):
            for pattern, label in debug_patterns:
                if re.search(pattern, line):
                    found_debug = True
                    rel = str(fpath.relative_to(project_path))
                    results.append(CheckResult(
                        name="debug_mode_enabled",
                        category="security",
                        severity=Severity.WARN,
                        message=f"{label} - ensure debug mode is off in production",
                        file=rel,
                        line=line_num,
                        suggestion="Use environment-specific configuration to disable debug mode in production.",
                    ))

    if not found_debug:
        results.append(CheckResult(
            name="debug_mode_enabled",
            category="security",
            severity=Severity.PASS,
            message="No debug mode flags detected in configuration files",
        ))

    return results


def run_security_checks(project_path: Path) -> list[CheckResult]:
    """Run all security checks on the project."""
    results = []
    results.extend(_check_hardcoded_secrets(project_path))
    results.extend(_check_env_in_gitignore(project_path))
    results.extend(_check_env_has_values(project_path))
    results.extend(_check_debug_mode(project_path))
    return results
