"""Infrastructure checks: Dockerfile, CI/CD, gitignore, dependency management."""

from pathlib import Path

from deploykit.models import CheckResult, Severity


def _check_dockerfile(project_path: Path) -> list[CheckResult]:
    """Check for Dockerfile or container configuration."""
    dockerfile_names = ["Dockerfile", "dockerfile", "docker-compose.yml", "docker-compose.yaml",
                        "compose.yml", "compose.yaml", "Containerfile"]

    for name in dockerfile_names:
        if (project_path / name).exists():
            return [CheckResult(
                name="dockerfile",
                category="infra",
                severity=Severity.PASS,
                message=f"Container configuration found: {name}",
            )]

    # Check for other deployment configs
    deploy_configs = [
        "fly.toml", "railway.json", "render.yaml", "vercel.json",
        "netlify.toml", "app.yaml", "Procfile", "serverless.yml",
    ]
    for name in deploy_configs:
        if (project_path / name).exists():
            return [CheckResult(
                name="dockerfile",
                category="infra",
                severity=Severity.PASS,
                message=f"Deployment configuration found: {name}",
            )]

    return [CheckResult(
        name="dockerfile",
        category="infra",
        severity=Severity.WARN,
        message="No Dockerfile or deployment configuration found",
        suggestion="Add a Dockerfile or platform deployment config (fly.toml, railway.json, etc.).",
    )]


def _check_gitignore(project_path: Path) -> list[CheckResult]:
    """Check for .gitignore with common patterns."""
    gitignore = project_path / ".gitignore"

    if not gitignore.exists():
        return [CheckResult(
            name="gitignore",
            category="infra",
            severity=Severity.FAIL,
            message="No .gitignore file found",
            suggestion="Create a .gitignore to prevent committing build artifacts, secrets, and dependencies.",
        )]

    content = gitignore.read_text(errors="ignore")
    lines = {l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("#")}

    essential_patterns = {
        "node_modules": ["node_modules", "node_modules/"],
        ".env": [".env", ".env*", ".env.*", ".env.local"],
        "__pycache__": ["__pycache__", "__pycache__/", "*.pyc"],
        ".venv": [".venv", "venv", ".venv/", "venv/"],
    }

    missing = []
    for category, patterns in essential_patterns.items():
        if not any(p in lines for p in patterns):
            missing.append(category)

    if not missing:
        return [CheckResult(
            name="gitignore",
            category="infra",
            severity=Severity.PASS,
            message=".gitignore covers common patterns",
        )]

    return [CheckResult(
        name="gitignore",
        category="infra",
        severity=Severity.WARN,
        message=f".gitignore is missing patterns for: {', '.join(missing)}",
        suggestion=f"Add entries for {', '.join(missing)} to your .gitignore.",
    )]


def _check_cicd(project_path: Path) -> list[CheckResult]:
    """Check for CI/CD configuration."""
    ci_paths = [
        ".github/workflows",
        ".gitlab-ci.yml",
        ".circleci",
        "Jenkinsfile",
        ".travis.yml",
        "bitbucket-pipelines.yml",
        "azure-pipelines.yml",
        ".buildkite",
    ]

    for ci_path in ci_paths:
        full_path = project_path / ci_path
        if full_path.exists():
            if full_path.is_dir():
                # Check if directory has any files
                if any(full_path.iterdir()):
                    return [CheckResult(
                        name="cicd",
                        category="infra",
                        severity=Severity.PASS,
                        message=f"CI/CD configuration found: {ci_path}",
                    )]
            else:
                return [CheckResult(
                    name="cicd",
                    category="infra",
                    severity=Severity.PASS,
                    message=f"CI/CD configuration found: {ci_path}",
                )]

    return [CheckResult(
        name="cicd",
        category="infra",
        severity=Severity.WARN,
        message="No CI/CD configuration found",
        suggestion="Set up CI/CD (GitHub Actions, GitLab CI, etc.) for automated testing and deployment.",
    )]


def _check_dependency_management(project_path: Path) -> list[CheckResult]:
    """Check for dependency management files."""
    dep_files = [
        ("pyproject.toml", "Python (pyproject.toml)"),
        ("requirements.txt", "Python (requirements.txt)"),
        ("Pipfile", "Python (Pipfile)"),
        ("setup.py", "Python (setup.py)"),
        ("poetry.lock", "Python (Poetry)"),
        ("package.json", "Node.js (package.json)"),
        ("Cargo.toml", "Rust (Cargo.toml)"),
        ("go.mod", "Go (go.mod)"),
        ("Gemfile", "Ruby (Gemfile)"),
    ]

    for filename, label in dep_files:
        if (project_path / filename).exists():
            # Check for lock files
            lock_files = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml",
                          "poetry.lock", "Pipfile.lock", "Cargo.lock", "Gemfile.lock"]
            has_lock = any((project_path / lf).exists() for lf in lock_files)

            results = [CheckResult(
                name="dependency_management",
                category="infra",
                severity=Severity.PASS,
                message=f"Dependency management found: {label}",
            )]

            if not has_lock:
                results.append(CheckResult(
                    name="lock_file",
                    category="infra",
                    severity=Severity.WARN,
                    message="No dependency lock file found",
                    suggestion="Commit a lock file for reproducible builds.",
                ))

            return results

    return [CheckResult(
        name="dependency_management",
        category="infra",
        severity=Severity.WARN,
        message="No dependency management file found",
        suggestion="Add a pyproject.toml, requirements.txt, or package.json.",
    )]


def _check_readme(project_path: Path) -> list[CheckResult]:
    """Check for README."""
    readme_names = ["README.md", "README.rst", "README.txt", "README", "readme.md"]

    for name in readme_names:
        if (project_path / name).exists():
            return [CheckResult(
                name="readme",
                category="infra",
                severity=Severity.PASS,
                message="README found",
            )]

    return [CheckResult(
        name="readme",
        category="infra",
        severity=Severity.WARN,
        message="No README file found",
        suggestion="Add a README.md with project description, setup instructions, and usage examples.",
    )]


def run_infra_checks(project_path: Path) -> list[CheckResult]:
    """Run all infrastructure checks."""
    results = []
    results.extend(_check_dockerfile(project_path))
    results.extend(_check_gitignore(project_path))
    results.extend(_check_cicd(project_path))
    results.extend(_check_dependency_management(project_path))
    results.extend(_check_readme(project_path))
    return results
