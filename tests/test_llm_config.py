"""Tests for LLM configuration checks."""

from pathlib import Path

import pytest

from deploykit.checks.llm_config import run_llm_config_checks
from deploykit.models import Severity


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    return tmp_path


def test_no_llm_usage(project_dir: Path) -> None:
    """Should pass when no LLM usage detected."""
    (project_dir / "app.py").write_text("print('hello world')\n")

    results = run_llm_config_checks(project_dir)
    assert len(results) == 1
    assert results[0].severity == Severity.PASS
    assert "skipped" in results[0].message.lower()


def test_missing_timeout(project_dir: Path) -> None:
    """Should warn when LLM client has no timeout."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI()\n"
        "response = client.chat.completions.create(model='gpt-4')\n"
    )

    results = run_llm_config_checks(project_dir)
    warns = [r for r in results if r.name == "llm_timeout" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_has_timeout(project_dir: Path) -> None:
    """Should pass when timeout is configured."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
    )

    results = run_llm_config_checks(project_dir)
    passes = [r for r in results if r.name == "llm_timeout" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_hardcoded_model_name(project_dir: Path) -> None:
    """Should warn on hardcoded model names."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
        "response = client.chat.completions.create(model=\"gpt-4-turbo\")\n"
    )

    results = run_llm_config_checks(project_dir)
    warns = [r for r in results if r.name == "hardcoded_model_name" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_model_from_env_var(project_dir: Path) -> None:
    """Should pass when model comes from env var."""
    (project_dir / "app.py").write_text(
        "import os\n"
        "from openai import OpenAI\n"
        "model = os.environ.get('MODEL', 'gpt-4')\n"
        "client = OpenAI(timeout=30)\n"
        "response = client.chat.completions.create(model=model)\n"
    )

    results = run_llm_config_checks(project_dir)
    passes = [r for r in results if r.name == "hardcoded_model_name" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_no_streaming(project_dir: Path) -> None:
    """Should warn when no streaming is detected."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
        "response = client.chat.completions.create(model='gpt-4')\n"
    )

    results = run_llm_config_checks(project_dir)
    warns = [r for r in results if r.name == "llm_streaming" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_has_streaming(project_dir: Path) -> None:
    """Should pass when streaming is configured."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
        "response = client.chat.completions.create(model='gpt-4', stream=True)\n"
    )

    results = run_llm_config_checks(project_dir)
    passes = [r for r in results if r.name == "llm_streaming" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_no_retry_logic(project_dir: Path) -> None:
    """Should warn when LLM calls have no retry logic."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
        "response = client.chat.completions.create(model='gpt-4')\n"
    )

    results = run_llm_config_checks(project_dir)
    warns = [r for r in results if r.name == "llm_retry_logic" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_has_retry_logic(project_dir: Path) -> None:
    """Should pass when retry logic is present."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "from tenacity import retry, stop_after_attempt\n"
        "client = OpenAI(timeout=30)\n"
        "@retry(stop=stop_after_attempt(3))\n"
        "def call_llm():\n"
        "    return client.chat.completions.create(model='gpt-4')\n"
    )

    results = run_llm_config_checks(project_dir)
    passes = [r for r in results if r.name == "llm_retry_logic" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_no_fallback(project_dir: Path) -> None:
    """Should warn when no fallback model is configured."""
    (project_dir / "app.py").write_text(
        "from openai import OpenAI\n"
        "client = OpenAI(timeout=30)\n"
    )

    results = run_llm_config_checks(project_dir)
    warns = [r for r in results if r.name == "llm_fallback" and r.severity == Severity.WARN]
    assert len(warns) >= 1
