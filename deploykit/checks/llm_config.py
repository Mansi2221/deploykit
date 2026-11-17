"""LLM configuration checks: timeouts, retries, model hardcoding, streaming."""

import os
import re
from pathlib import Path

from deploykit.models import CheckResult, Severity

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build", ".eggs"}
CODE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx"}

# Patterns that indicate LLM client usage
LLM_CLIENT_PATTERNS = [
    r'openai\.ChatCompletion',
    r'OpenAI\s*\(',
    r'Anthropic\s*\(',
    r'ChatOpenAI\s*\(',
    r'ChatAnthropic\s*\(',
    r'client\.chat\.completions',
    r'client\.messages\.create',
    r'client\.completions\.create',
    r'anthropic\.Anthropic',
    r'from\s+openai\s+import',
    r'from\s+anthropic\s+import',
    r'import\s+openai',
    r'import\s+anthropic',
    r'cohere\.Client',
    r'genai\.GenerativeModel',
    r'google\.generativeai',
]

LLM_CALL_PATTERNS = [
    r'\.chat\.completions\.create\s*\(',
    r'\.messages\.create\s*\(',
    r'\.completions\.create\s*\(',
    r'\.generate_content\s*\(',
    r'ChatCompletion\.create\s*\(',
]

HARDCODED_MODEL_PATTERNS = [
    r'''model\s*=\s*["'](gpt-4[^"']*|gpt-3\.5[^"']*|claude[^"']*|gemini[^"']*)["']''',
]

RETRY_PATTERNS = [
    r'retry', r'tenacity', r'backoff', r'max_retries', r'num_retries',
    r'@retry', r'Retry\(', r'retry_count', r'with_retries',
]

TIMEOUT_PATTERNS = [
    r'timeout\s*=', r'request_timeout', r'timeout_ms',
]

STREAMING_PATTERNS = [
    r'stream\s*=\s*True', r'stream:\s*true', r'\.stream\s*\(',
]

FALLBACK_PATTERNS = [
    r'fallback', r'backup_model', r'secondary_model', r'with_fallback',
]


def _iter_code_files(project_path: Path) -> list[Path]:
    """Iterate over code files."""
    files = []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix in CODE_EXTENSIONS:
                files.append(fpath)
    return files


def _has_llm_usage(project_path: Path) -> list[tuple[Path, str]]:
    """Find files that use LLM clients."""
    llm_files = []
    for fpath in _iter_code_files(project_path):
        try:
            content = fpath.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        for pattern in LLM_CLIENT_PATTERNS:
            if re.search(pattern, content):
                llm_files.append((fpath, content))
                break
    return llm_files


def _check_timeout(project_path: Path, llm_files: list[tuple[Path, str]]) -> list[CheckResult]:
    """Check if LLM clients are initialized with timeout."""
    if not llm_files:
        return []

    results = []
    any_timeout = False

    for fpath, content in llm_files:
        has_timeout = any(re.search(p, content) for p in TIMEOUT_PATTERNS)
        if has_timeout:
            any_timeout = True
        else:
            has_client_init = any(
                re.search(p, content)
                for p in [r'OpenAI\s*\(', r'Anthropic\s*\(', r'Client\s*\(']
            )
            if has_client_init:
                rel = str(fpath.relative_to(project_path))
                results.append(CheckResult(
                    name="llm_timeout",
                    category="llm_config",
                    severity=Severity.WARN,
                    message="LLM client initialized without explicit timeout",
                    file=rel,
                    suggestion="Set a timeout parameter (e.g., timeout=30) to prevent hanging requests.",
                ))

    if not results and any_timeout:
        results.append(CheckResult(
            name="llm_timeout",
            category="llm_config",
            severity=Severity.PASS,
            message="LLM clients have timeout configuration",
        ))

    return results


def _check_retry_logic(project_path: Path, llm_files: list[tuple[Path, str]]) -> list[CheckResult]:
    """Check if LLM calls have retry/error handling."""
    if not llm_files:
        return []

    results = []
    any_retry = False

    for fpath, content in llm_files:
        has_retry = any(re.search(p, content, re.IGNORECASE) for p in RETRY_PATTERNS)
        has_try_except = "try:" in content and "except" in content

        if has_retry:
            any_retry = True
        elif not has_try_except:
            has_calls = any(re.search(p, content) for p in LLM_CALL_PATTERNS)
            if has_calls:
                rel = str(fpath.relative_to(project_path))
                results.append(CheckResult(
                    name="llm_retry_logic",
                    category="llm_config",
                    severity=Severity.WARN,
                    message="LLM API calls without retry logic or error handling",
                    file=rel,
                    suggestion="Add retry logic with exponential backoff using tenacity or a similar library.",
                ))

    if not results:
        if any_retry:
            results.append(CheckResult(
                name="llm_retry_logic",
                category="llm_config",
                severity=Severity.PASS,
                message="LLM calls have retry/error handling logic",
            ))

    return results


def _check_hardcoded_models(project_path: Path, llm_files: list[tuple[Path, str]]) -> list[CheckResult]:
    """Check if model names are hardcoded vs env vars."""
    if not llm_files:
        return []

    results = []
    found_hardcoded = False

    for fpath, content in llm_files:
        for line_num, line in enumerate(content.splitlines(), start=1):
            for pattern in HARDCODED_MODEL_PATTERNS:
                match = re.search(pattern, line)
                if match:
                    # Check if it's near an env var lookup
                    context_start = max(0, line_num - 5)
                    context_lines = content.splitlines()[context_start:line_num + 2]
                    context = "\n".join(context_lines)
                    if "os.environ" in context or "os.getenv" in context or "environ" in context:
                        continue
                    found_hardcoded = True
                    rel = str(fpath.relative_to(project_path))
                    results.append(CheckResult(
                        name="hardcoded_model_name",
                        category="llm_config",
                        severity=Severity.WARN,
                        message=f"Hardcoded model name: {match.group(0)}",
                        file=rel,
                        line=line_num,
                        suggestion="Use an environment variable for model names to enable easy switching.",
                    ))

    if not found_hardcoded:
        results.append(CheckResult(
            name="hardcoded_model_name",
            category="llm_config",
            severity=Severity.PASS,
            message="No hardcoded model names detected",
        ))

    return results


def _check_streaming(project_path: Path, llm_files: list[tuple[Path, str]]) -> list[CheckResult]:
    """Check if streaming is used for LLM calls."""
    if not llm_files:
        return []

    has_streaming = any(
        any(re.search(p, content) for p in STREAMING_PATTERNS)
        for _, content in llm_files
    )

    if has_streaming:
        return [CheckResult(
            name="llm_streaming",
            category="llm_config",
            severity=Severity.PASS,
            message="Streaming is configured for LLM calls",
        )]

    return [CheckResult(
        name="llm_streaming",
        category="llm_config",
        severity=Severity.WARN,
        message="No streaming detected for LLM calls",
        suggestion="Use streaming for better user experience and to handle long responses.",
    )]


def _check_fallback_model(project_path: Path, llm_files: list[tuple[Path, str]]) -> list[CheckResult]:
    """Check if a fallback model is configured."""
    if not llm_files:
        return []

    has_fallback = any(
        any(re.search(p, content, re.IGNORECASE) for p in FALLBACK_PATTERNS)
        for _, content in llm_files
    )

    if has_fallback:
        return [CheckResult(
            name="llm_fallback",
            category="llm_config",
            severity=Severity.PASS,
            message="Fallback model configuration detected",
        )]

    return [CheckResult(
        name="llm_fallback",
        category="llm_config",
        severity=Severity.WARN,
        message="No fallback model configuration detected",
        suggestion="Configure a fallback model in case the primary model is unavailable or rate-limited.",
    )]


def run_llm_config_checks(project_path: Path) -> list[CheckResult]:
    """Run all LLM configuration checks."""
    llm_files = _has_llm_usage(project_path)

    if not llm_files:
        return [CheckResult(
            name="llm_usage",
            category="llm_config",
            severity=Severity.PASS,
            message="No LLM client usage detected (checks skipped)",
        )]

    results = []
    results.extend(_check_timeout(project_path, llm_files))
    results.extend(_check_retry_logic(project_path, llm_files))
    results.extend(_check_hardcoded_models(project_path, llm_files))
    results.extend(_check_streaming(project_path, llm_files))
    results.extend(_check_fallback_model(project_path, llm_files))
    return results
