"""Data models for deploykit scan results."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class Severity(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


class CheckResult(BaseModel):
    name: str
    category: str
    severity: Severity
    message: str
    file: Optional[str] = None
    line: Optional[int] = None
    suggestion: Optional[str] = None


class Report(BaseModel):
    project_path: str
    total_checks: int
    passed: int
    warnings: int
    failures: int
    score: float  # 0-100
    checks: list[CheckResult]
    cost_estimate: Optional[dict] = None
