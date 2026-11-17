"""Tests for API health checks."""

from pathlib import Path

import pytest

from deploykit.checks.api_health import run_api_health_checks
from deploykit.models import Severity


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    return tmp_path


def test_no_framework(project_dir: Path) -> None:
    """Should skip checks when no web framework detected."""
    (project_dir / "script.py").write_text("print('hello')\n")

    results = run_api_health_checks(project_dir)
    # Should have a pass for health endpoint (skipped)
    passes = [r for r in results if r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_fastapi_no_health(project_dir: Path) -> None:
    """Should warn when FastAPI app has no health endpoint."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n"
        "@app.get('/items')\n"
        "def get_items(): return []\n"
    )

    results = run_api_health_checks(project_dir)
    warns = [r for r in results if r.name == "health_endpoint" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_fastapi_with_health(project_dir: Path) -> None:
    """Should pass when FastAPI app has health endpoint."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n"
        "@app.get('/health')\n"
        "def health(): return {'status': 'ok'}\n"
    )

    results = run_api_health_checks(project_dir)
    passes = [r for r in results if r.name == "health_endpoint" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_no_cors(project_dir: Path) -> None:
    """Should warn when no CORS configuration found."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n"
    )

    results = run_api_health_checks(project_dir)
    warns = [r for r in results if r.name == "cors_config" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_has_cors(project_dir: Path) -> None:
    """Should pass when CORS middleware is configured."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "from fastapi.middleware.cors import CORSMiddleware\n"
        "app = FastAPI()\n"
        "app.add_middleware(CORSMiddleware, allow_origins=['*'])\n"
    )

    results = run_api_health_checks(project_dir)
    passes = [r for r in results if r.name == "cors_config" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_no_rate_limiting(project_dir: Path) -> None:
    """Should warn when no rate limiting is configured."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n"
    )

    results = run_api_health_checks(project_dir)
    warns = [r for r in results if r.name == "rate_limiting" and r.severity == Severity.WARN]
    assert len(warns) >= 1


def test_has_rate_limiting(project_dir: Path) -> None:
    """Should pass when rate limiting is detected."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "from slowapi import Limiter\n"
        "limiter = Limiter(key_func=get_remote_address)\n"
        "app = FastAPI()\n"
    )

    results = run_api_health_checks(project_dir)
    passes = [r for r in results if r.name == "rate_limiting" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_has_error_handler(project_dir: Path) -> None:
    """Should pass when global error handler is detected."""
    (project_dir / "main.py").write_text(
        "from fastapi import FastAPI\n"
        "from fastapi.responses import JSONResponse\n"
        "app = FastAPI()\n"
        "@app.exception_handler(Exception)\n"
        "def handle_error(request, exc):\n"
        "    return JSONResponse(status_code=500, content={'error': 'Internal'})\n"
    )

    results = run_api_health_checks(project_dir)
    passes = [r for r in results if r.name == "error_handlers" and r.severity == Severity.PASS]
    assert len(passes) >= 1


def test_express_detection(project_dir: Path) -> None:
    """Should detect Express.js framework."""
    (project_dir / "app.js").write_text(
        "const express = require('express');\n"
        "const app = express();\n"
        "app.get('/items', (req, res) => res.json([]));\n"
    )

    results = run_api_health_checks(project_dir)
    # Should have warnings about missing health/cors/etc
    warns = [r for r in results if r.severity == Severity.WARN]
    assert len(warns) >= 1
