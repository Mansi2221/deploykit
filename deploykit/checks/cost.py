"""Cost estimation checks: detect models, estimate usage costs, caching detection."""

import os
import re
from pathlib import Path

from deploykit.models import CheckResult, Severity

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build", ".eggs"}
CODE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx"}

# Model pricing per 1K input tokens / 1K output tokens (approximate USD)
MODEL_PRICING = {
    "gpt-4o": {"input": 0.0025, "output": 0.01, "tier": "mid"},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006, "tier": "low"},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03, "tier": "high"},
    "gpt-4": {"input": 0.03, "output": 0.06, "tier": "high"},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015, "tier": "low"},
    "claude-3-5-sonnet": {"input": 0.003, "output": 0.015, "tier": "mid"},
    "claude-3-opus": {"input": 0.015, "output": 0.075, "tier": "high"},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015, "tier": "mid"},
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125, "tier": "low"},
    "claude-sonnet-4": {"input": 0.003, "output": 0.015, "tier": "mid"},
    "claude-opus-4": {"input": 0.015, "output": 0.075, "tier": "high"},
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005, "tier": "mid"},
    "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003, "tier": "low"},
    "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004, "tier": "low"},
}

# Patterns that indicate caching
CACHE_PATTERNS = [
    r'cache', r'redis', r'memcache', r'lru_cache', r'functools\.cache',
    r'@cache', r'cached', r'ttl', r'prompt.cache', r'cache_control',
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


def _detect_models(project_path: Path) -> dict[str, list[str]]:
    """Detect which LLM models are referenced in code. Returns {model: [files]}."""
    detected = {}
    files = _iter_code_files(project_path)

    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue

        for model_name in MODEL_PRICING:
            if model_name in content:
                rel = str(fpath.relative_to(project_path))
                detected.setdefault(model_name, []).append(rel)

    return detected


def _detect_caching(project_path: Path) -> bool:
    """Check if any caching mechanism is in use."""
    files = _iter_code_files(project_path)
    for fpath in files:
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if any(re.search(p, content, re.IGNORECASE) for p in CACHE_PATTERNS):
            return True

    # Check dependency files
    for pkg_file in ["package.json", "requirements.txt", "pyproject.toml"]:
        pkg_path = project_path / pkg_file
        if pkg_path.exists():
            try:
                content = pkg_path.read_text(errors="ignore")
                if re.search(r'redis|memcache|cache', content, re.IGNORECASE):
                    return True
            except (OSError, UnicodeDecodeError):
                pass

    return False


def _estimate_monthly_cost(detected_models: dict[str, list[str]]) -> dict:
    """Estimate monthly cost based on detected models.

    Assumes 1K requests/day with average 500 input tokens and 500 output tokens per request.
    """
    estimates = {}
    total_low = 0.0
    total_high = 0.0

    for model_name in detected_models:
        if model_name in MODEL_PRICING:
            pricing = MODEL_PRICING[model_name]
            # Low estimate: 100 req/day, avg 500 tokens each
            daily_low = 100 * (0.5 * pricing["input"] + 0.5 * pricing["output"])
            # High estimate: 10K req/day, avg 1K tokens each
            daily_high = 10000 * (1.0 * pricing["input"] + 1.0 * pricing["output"])

            monthly_low = round(daily_low * 30, 2)
            monthly_high = round(daily_high * 30, 2)

            estimates[model_name] = {
                "monthly_low": monthly_low,
                "monthly_high": monthly_high,
                "tier": pricing["tier"],
            }
            total_low += monthly_low
            total_high += monthly_high

    return {
        "models": estimates,
        "total_monthly_low": round(total_low, 2),
        "total_monthly_high": round(total_high, 2),
        "assumptions": "Low: 100 req/day, 500 tokens avg. High: 10K req/day, 1K tokens avg.",
    }


def run_cost_checks(project_path: Path) -> list[CheckResult]:
    """Run cost estimation checks."""
    results = []
    detected_models = _detect_models(project_path)

    if not detected_models:
        return [CheckResult(
            name="cost_estimation",
            category="cost",
            severity=Severity.PASS,
            message="No LLM models detected for cost estimation",
        )]

    cost_estimate = _estimate_monthly_cost(detected_models)
    has_caching = _detect_caching(project_path)

    # Report detected models
    model_list = ", ".join(detected_models.keys())
    results.append(CheckResult(
        name="detected_models",
        category="cost",
        severity=Severity.PASS,
        message=f"Detected LLM models: {model_list}",
    ))

    # Flag expensive models
    for model_name, files in detected_models.items():
        if model_name in MODEL_PRICING and MODEL_PRICING[model_name]["tier"] == "high":
            results.append(CheckResult(
                name="expensive_model",
                category="cost",
                severity=Severity.WARN,
                message=f"Expensive model detected: {model_name} (est. ${cost_estimate['models'][model_name]['monthly_low']}-${cost_estimate['models'][model_name]['monthly_high']}/mo)",
                file=files[0],
                suggestion=f"Consider using a cheaper model for non-critical tasks, or add caching to reduce API calls.",
            ))

    # Check for caching
    if not has_caching and detected_models:
        results.append(CheckResult(
            name="llm_caching",
            category="cost",
            severity=Severity.WARN,
            message="No response caching detected for LLM calls",
            suggestion="Add caching (Redis, in-memory) for repeated queries to reduce API costs.",
        ))
    elif has_caching:
        results.append(CheckResult(
            name="llm_caching",
            category="cost",
            severity=Severity.PASS,
            message="Caching mechanism detected for LLM responses",
        ))

    # Total cost summary
    total_low = cost_estimate["total_monthly_low"]
    total_high = cost_estimate["total_monthly_high"]
    if total_high > 1000:
        severity = Severity.WARN
    else:
        severity = Severity.PASS

    results.append(CheckResult(
        name="cost_estimate",
        category="cost",
        severity=severity,
        message=f"Estimated monthly LLM cost: ${total_low} - ${total_high}",
        suggestion="Monitor actual usage and set billing alerts." if total_high > 500 else None,
    ))

    # Attach cost estimate data to the last result for the report
    # (the scanner will extract this)
    results[-1].model_extra  # triggers validation
    # Store estimate in a way the scanner can retrieve it
    # We use a convention: the scanner checks for cost_estimate in the module
    run_cost_checks._last_estimate = cost_estimate  # type: ignore[attr-defined]

    return results


# Module-level storage for cost estimate data
run_cost_checks._last_estimate = None  # type: ignore[attr-defined]
