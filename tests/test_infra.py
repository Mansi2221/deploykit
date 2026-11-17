"""Tests for infrastructure checks."""

from pathlib import Path

import pytest

from deploykit.checks.infra import run_infra_checks
from deploykit.models import Severity


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    return tmp_path


def test_missing_everything(project_dir: Path) -> None:
    """Should produce warnings/failures for empty project."""
    results = run_infra_checks(project_dir)
    non_pass = [r for r in results if r.severity != Severity.PASS]
    assert len(non_pass) >= 3  # At least gitignore, CI/CD, deps, readme


def test_has_dockerfile(project_dir: Path) -> None:
    """Should pass when Dockerfile exists."""
    (project_dir / "Dockerfile").write_text("FROM python:3.11\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "dockerfile" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_has_docker_compose(project_dir: Path) -> None:
    """Should pass when docker-compose exists."""
    (project_dir / "docker-compose.yml").write_text("version: '3'\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "dockerfile" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_has_fly_toml(project_dir: Path) -> None:
    """Should pass when fly.toml exists."""
    (project_dir / "fly.toml").write_text("[build]\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "dockerfile" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_no_dockerfile(project_dir: Path) -> None:
    """Should warn when no deployment config exists."""
    results = run_infra_checks(project_dir)
    warns = [r for r in results if r.name == "dockerfile" and r.severity == Severity.WARN]
    assert len(warns) == 1


def test_gitignore_complete(project_dir: Path) -> None:
    """Should pass with comprehensive .gitignore."""
    (project_dir / ".gitignore").write_text(
        "node_modules/\n.env\n__pycache__/\n.venv/\n"
    )

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "gitignore" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_gitignore_missing_patterns(project_dir: Path) -> None:
    """Should warn when .gitignore is incomplete."""
    (project_dir / ".gitignore").write_text("*.pyc\n")

    results = run_infra_checks(project_dir)
    warns = [r for r in results if r.name == "gitignore" and r.severity == Severity.WARN]
    assert len(warns) == 1
    assert "missing" in warns[0].message.lower()


def test_no_gitignore(project_dir: Path) -> None:
    """Should fail when no .gitignore."""
    results = run_infra_checks(project_dir)
    fails = [r for r in results if r.name == "gitignore" and r.severity == Severity.FAIL]
    assert len(fails) == 1


def test_has_github_actions(project_dir: Path) -> None:
    """Should pass when GitHub Actions workflow exists."""
    workflows = project_dir / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "ci.yml").write_text("name: CI\non: push\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "cicd" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_no_cicd(project_dir: Path) -> None:
    """Should warn when no CI/CD config found."""
    results = run_infra_checks(project_dir)
    warns = [r for r in results if r.name == "cicd" and r.severity == Severity.WARN]
    assert len(warns) == 1


def test_has_pyproject(project_dir: Path) -> None:
    """Should pass when pyproject.toml exists."""
    (project_dir / "pyproject.toml").write_text("[project]\nname = 'test'\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "dependency_management" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_has_package_json(project_dir: Path) -> None:
    """Should pass when package.json exists."""
    (project_dir / "package.json").write_text('{"name": "test"}\n')

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "dependency_management" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_has_readme(project_dir: Path) -> None:
    """Should pass when README exists."""
    (project_dir / "README.md").write_text("# My Project\n")

    results = run_infra_checks(project_dir)
    passes = [r for r in results if r.name == "readme" and r.severity == Severity.PASS]
    assert len(passes) == 1


def test_no_readme(project_dir: Path) -> None:
    """Should warn when no README exists."""
    results = run_infra_checks(project_dir)
    warns = [r for r in results if r.name == "readme" and r.severity == Severity.WARN]
    assert len(warns) == 1
