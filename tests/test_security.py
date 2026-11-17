"""Tests for security checks."""

from pathlib import Path

import pytest

from deploykit.checks.security import run_security_checks
from deploykit.models import Severity


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    """Create a minimal project directory."""
    return tmp_path


def test_no_issues(project_dir: Path) -> None:
    """Clean project should pass all security checks."""
    (project_dir / ".gitignore").write_text(".env\nnode_modules/\n__pycache__/\n")
    (project_dir / "app.py").write_text("import os\napi_key = os.environ['API_KEY']\n")

    results = run_security_checks(project_dir)
    failures = [r for r in results if r.severity == Severity.FAIL]
    assert len(failures) == 0


def test_hardcoded_openai_key(project_dir: Path) -> None:
    """Should detect hardcoded OpenAI API key."""
    (project_dir / "app.py").write_text('client = OpenAI(api_key="sk-abc123def456ghi789jkl012mno345pqr678stu901vwx")\n')

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "hardcoded_secret"]
    assert len(fails) >= 1
    assert fails[0].file == "app.py"


def test_hardcoded_aws_key(project_dir: Path) -> None:
    """Should detect hardcoded AWS access key."""
    (project_dir / "config.py").write_text('AWS_KEY = "AKIAIOSFODNN7EXAMPLE"\n')

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "hardcoded_secret"]
    assert len(fails) >= 1


def test_hardcoded_github_token(project_dir: Path) -> None:
    """Should detect hardcoded GitHub token."""
    (project_dir / "deploy.py").write_text('token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"\n')

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "hardcoded_secret"]
    assert len(fails) >= 1


def test_secret_in_variable_assignment(project_dir: Path) -> None:
    """Should detect secrets assigned to variables."""
    (project_dir / "config.py").write_text('api_key = "super_secret_key_12345678"\n')

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and "secret" in r.name]
    assert len(fails) >= 1


def test_env_not_in_gitignore(project_dir: Path) -> None:
    """Should fail when .env exists but is not in .gitignore."""
    (project_dir / ".env").write_text("API_KEY=test\n")
    (project_dir / ".gitignore").write_text("node_modules/\n")

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "env_in_gitignore"]
    assert len(fails) == 1


def test_env_in_gitignore(project_dir: Path) -> None:
    """Should pass when .env is in .gitignore."""
    (project_dir / ".env").write_text("API_KEY=test\n")
    (project_dir / ".gitignore").write_text(".env\nnode_modules/\n")

    results = run_security_checks(project_dir)
    passes = [r for r in results if r.severity == Severity.PASS and r.name == "env_in_gitignore"]
    assert len(passes) == 1


def test_no_gitignore_with_env(project_dir: Path) -> None:
    """Should fail when .env exists but no .gitignore."""
    (project_dir / ".env").write_text("SECRET=value\n")

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "env_in_gitignore"]
    assert len(fails) == 1


def test_debug_mode_python(project_dir: Path) -> None:
    """Should warn on DEBUG=True in Python files."""
    (project_dir / "settings.py").write_text("DEBUG = True\n")

    results = run_security_checks(project_dir)
    warns = [r for r in results if r.severity == Severity.WARN and r.name == "debug_mode_enabled"]
    assert len(warns) >= 1


def test_debug_mode_env(project_dir: Path) -> None:
    """Should warn on debug mode in .env files."""
    (project_dir / ".env").write_text("DEBUG=True\n")
    (project_dir / ".gitignore").write_text(".env\n")

    results = run_security_checks(project_dir)
    warns = [r for r in results if r.severity == Severity.WARN and r.name == "debug_mode_enabled"]
    assert len(warns) >= 1


def test_comments_ignored(project_dir: Path) -> None:
    """Should not flag secrets in comments."""
    (project_dir / "app.py").write_text('# sk-abc123def456ghi789jkl012mno345pqr678stu901vwx\n')

    results = run_security_checks(project_dir)
    fails = [r for r in results if r.severity == Severity.FAIL and r.name == "hardcoded_secret"]
    assert len(fails) == 0
