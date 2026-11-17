"""Tests for the main scanner orchestrator."""

from pathlib import Path

import pytest

from deploykit.models import Severity
from deploykit.scanner import scan


@pytest.fixture
def clean_project(tmp_path: Path) -> Path:
    """Create a well-configured project."""
    proj = tmp_path / "myproject"
    proj.mkdir()

    (proj / ".gitignore").write_text("node_modules/\n.env\n__pycache__/\n.venv/\n")
    (proj / "README.md").write_text("# My Project\n")
    (proj / "pyproject.toml").write_text("[project]\nname = 'myproject'\n")
    (proj / "Dockerfile").write_text("FROM python:3.11\n")

    workflows = proj / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "ci.yml").write_text("name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n")

    (proj / "app.py").write_text(
        "import os\n"
        "import logging\n"
        "logger = logging.getLogger(__name__)\n"
        "API_KEY = os.environ['API_KEY']\n"
    )

    return proj


@pytest.fixture
def bad_project(tmp_path: Path) -> Path:
    """Create a project with many issues."""
    proj = tmp_path / "badproject"
    proj.mkdir()

    (proj / "app.py").write_text(
        'from openai import OpenAI\n'
        'client = OpenAI(api_key="sk-abc123def456ghi789jkl012mno345pqr678stu901vwx")\n'
        'response = client.chat.completions.create(model="gpt-4")\n'
        'print(response)\n'
    )

    (proj / ".env").write_text("SECRET_KEY=mysecretkey123\nDEBUG=True\n")
    (proj / "settings.py").write_text("DEBUG = True\n")

    return proj


def test_scan_nonexistent_path() -> None:
    """Should raise FileNotFoundError for missing path."""
    with pytest.raises(FileNotFoundError):
        scan("/nonexistent/path/xyz")


def test_scan_file_not_dir(tmp_path: Path) -> None:
    """Should raise NotADirectoryError when given a file."""
    f = tmp_path / "file.txt"
    f.write_text("hello")
    with pytest.raises(NotADirectoryError):
        scan(f)


def test_scan_clean_project(clean_project: Path) -> None:
    """Clean project should have a high score."""
    report = scan(clean_project)

    assert report.total_checks > 0
    assert report.score >= 60
    assert report.failures == 0
    assert report.project_path == str(clean_project)


def test_scan_bad_project(bad_project: Path) -> None:
    """Bad project should have failures and low score."""
    report = scan(bad_project)

    assert report.total_checks > 0
    assert report.failures > 0
    assert report.score < 80

    # Should detect the hardcoded API key
    secret_checks = [c for c in report.checks if c.name == "hardcoded_secret" and c.severity == Severity.FAIL]
    assert len(secret_checks) >= 1

    # Should detect missing .gitignore
    gitignore_checks = [c for c in report.checks if c.name == "gitignore" and c.severity == Severity.FAIL]
    assert len(gitignore_checks) >= 1


def test_scan_empty_project(tmp_path: Path) -> None:
    """Empty project should still produce a report."""
    proj = tmp_path / "empty"
    proj.mkdir()

    report = scan(proj)
    assert report.total_checks > 0
    assert isinstance(report.score, float)


def test_report_score_calculation(clean_project: Path) -> None:
    """Score should be between 0 and 100."""
    report = scan(clean_project)
    assert 0 <= report.score <= 100


def test_report_categories(bad_project: Path) -> None:
    """Report should contain checks from multiple categories."""
    report = scan(bad_project)

    categories = {c.category for c in report.checks}
    assert "security" in categories
    assert "infra" in categories


def test_report_json_serialization(clean_project: Path) -> None:
    """Report should be JSON-serializable."""
    report = scan(clean_project)
    json_str = report.model_dump_json()
    assert len(json_str) > 0
    assert "score" in json_str
