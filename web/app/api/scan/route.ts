import { NextRequest, NextResponse } from "next/server"
import { CheckResult, ScanReport, CostModel, Severity, ProjectType, ProjectProfile } from "@/app/types"

// ── GitHub helpers ────────────────────────────────────────────────────────────

function parseGitHubURL(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== "github.com") return null
    const parts = u.pathname.replace(/^\//, "").replace(/\/$/, "").split("/")
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") }
  } catch {
    return null
  }
}

interface TreeItem { path: string; type: string; url: string; size?: number }

const RELEVANT_EXTENSIONS = new Set([
  ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".rb", ".java",
  ".json", ".yml", ".yaml", ".toml", ".cfg", ".ini", ".lock",
  ".env", ".env.example", ".env.sample", ".sql", ".prisma", ".graphql",
  ".sh", ".bash", ".md", ".mdx", ".ipynb",
])
const RELEVANT_FILENAMES = new Set([
  "Dockerfile", "dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml",
  ".gitignore", ".dockerignore", ".eslintrc", ".prettierrc",
  "README.md", "README", "README.rst", "CONTRIBUTING.md",
  "requirements.txt", "pyproject.toml", "package.json", "Cargo.toml", "go.mod", "Gemfile",
  "Makefile", "Procfile", "vercel.json", "netlify.toml", "fly.toml", "railway.json",
  "setup.py", "setup.cfg", "tox.ini", "pytest.ini", ".flake8",
  "tsconfig.json", "tailwind.config.js", "tailwind.config.ts",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "jest.config.js", "jest.config.ts", "vitest.config.ts",
  ".env.example", "alembic.ini", "knexfile.js",
])

function isRelevant(path: string): boolean {
  if (path.includes("node_modules/") || path.includes("__pycache__/") || path.includes(".next/") || path.includes("dist/") || path.includes("build/") || path.includes("venv/")) return false
  const filename = path.split("/").pop() ?? ""
  if (RELEVANT_FILENAMES.has(filename)) return true
  const dot = filename.lastIndexOf(".")
  if (dot !== -1 && RELEVANT_EXTENSIONS.has(filename.slice(dot))) return true
  return false
}

async function fetchTree(owner: string, repo: string): Promise<{ items: TreeItem[]; branch: string }> {
  for (const branch of ["main", "master"]) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, next: { revalidate: 0 } }
    )
    if (res.ok) {
      const data = await res.json()
      return { items: (data.tree ?? []).filter((i: TreeItem) => i.type === "blob"), branch }
    }
    if (res.status === 404) continue
    if (res.status === 403) throw new Error("RATE_LIMITED")
  }
  throw new Error("REPO_NOT_FOUND")
}

async function fetchFileContent(owner: string, repo: string, path: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, next: { revalidate: 0 } }
  )
  if (!res.ok) return ""
  const data = await res.json()
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
  }
  return ""
}

type FileMap = Map<string, string>

// ── Project Detection ─────────────────────────────────────────────────────────

function detectProjectProfile(files: FileMap, allPaths: string[]): ProjectProfile {
  const types: Set<ProjectType> = new Set()
  const languages: Set<string> = new Set()
  const frameworks: Set<string> = new Set()
  let hasLLM = false, hasDatabase = false, hasDocker = false, hasTests = false, hasFrontend = false, hasBackend = false

  const allContent = [...files.values()].join("\n")
  const allPathStr = allPaths.join("\n")

  // Languages
  if (allPaths.some(p => p.endsWith(".py") || p.endsWith(".ipynb"))) languages.add("Python")
  if (allPaths.some(p => p.endsWith(".ts") || p.endsWith(".tsx"))) languages.add("TypeScript")
  if (allPaths.some(p => p.endsWith(".js") || p.endsWith(".jsx"))) languages.add("JavaScript")
  if (allPaths.some(p => p.endsWith(".go"))) languages.add("Go")
  if (allPaths.some(p => p.endsWith(".rs"))) languages.add("Rust")
  if (allPaths.some(p => p.endsWith(".rb"))) languages.add("Ruby")
  if (allPaths.some(p => p.endsWith(".java"))) languages.add("Java")
  if (allPaths.some(p => p.endsWith(".sql") || p.endsWith(".prisma"))) languages.add("SQL")

  // Frameworks
  if (/from fastapi|import fastapi/i.test(allContent)) { frameworks.add("FastAPI"); hasBackend = true; types.add("api") }
  if (/from flask|import flask/i.test(allContent)) { frameworks.add("Flask"); hasBackend = true; types.add("api") }
  if (/from django|import django/i.test(allContent)) { frameworks.add("Django"); hasBackend = true; types.add("api") }
  if (/express\(\)|require\(['"]express['"]\)/i.test(allContent)) { frameworks.add("Express"); hasBackend = true; types.add("api") }
  if (allContent.includes('"next"') || allPathStr.includes("next.config")) { frameworks.add("Next.js"); hasFrontend = true; types.add("web-app") }
  if (/from react|import react|"react"/i.test(allContent)) { frameworks.add("React"); hasFrontend = true }
  if (/from vue|import vue|"vue"/i.test(allContent)) { frameworks.add("Vue"); hasFrontend = true; types.add("web-app") }
  if (/from svelte|"svelte"/i.test(allContent)) { frameworks.add("Svelte"); hasFrontend = true; types.add("web-app") }
  if (/import streamlit|from streamlit/i.test(allContent)) { frameworks.add("Streamlit"); hasFrontend = true; types.add("web-app") }
  if (/import gradio|from gradio/i.test(allContent)) { frameworks.add("Gradio"); hasFrontend = true; types.add("web-app") }

  // AI/Agent frameworks
  if (/langchain|langgraph|from langchain/i.test(allContent)) { frameworks.add("LangChain"); types.add("agent") }
  if (/crewai|from crewai/i.test(allContent)) { frameworks.add("CrewAI"); types.add("agent") }
  if (/autogen|from autogen/i.test(allContent)) { frameworks.add("AutoGen"); types.add("agent") }
  if (/llamaindex|llama_index|from llama_index/i.test(allContent)) { frameworks.add("LlamaIndex"); types.add("agent") }
  if (/anthropic|openai|from openai|from anthropic/i.test(allContent)) hasLLM = true
  if (/groq|together|replicate|huggingface_hub/i.test(allContent)) hasLLM = true
  if (/vercel.*ai.*sdk|@ai-sdk|ai\/core/i.test(allContent)) { frameworks.add("Vercel AI SDK"); hasLLM = true }

  // ML/Training
  if (/import torch|from torch|import tensorflow|from tensorflow|import sklearn|from sklearn/i.test(allContent)) { frameworks.add("PyTorch/TF/Sklearn"); types.add("ml-pipeline") }
  if (/import transformers|from transformers|AutoModel|AutoTokenizer/i.test(allContent)) { frameworks.add("HuggingFace Transformers"); types.add("ml-pipeline") }
  if (allPaths.some(p => p.endsWith(".ipynb"))) types.add("ml-pipeline")

  // Database
  if (/sqlalchemy|prisma|mongoose|sequelize|knex|supabase|from supabase|psycopg|pg\.|mongodb|redis|drizzle/i.test(allContent)) hasDatabase = true
  if (allPaths.some(p => p.endsWith(".sql") || p.endsWith(".prisma"))) hasDatabase = true
  if (/alembic|migration|migrate/i.test(allPathStr)) hasDatabase = true

  // Docker
  if (allPaths.some(p => p === "Dockerfile" || p === "docker-compose.yml" || p === "docker-compose.yaml" || p === "compose.yml")) hasDocker = true

  // Tests
  if (allPaths.some(p => p.includes("test") || p.includes("spec") || p.includes("__tests__"))) hasTests = true
  if (/pytest|jest|vitest|mocha|unittest|cargo test/i.test(allContent)) hasTests = true

  // CLI
  if (/click|argparse|typer|commander|yargs|\[project\.scripts\]/i.test(allContent)) types.add("cli")
  if (allPathStr.includes("cli.py") || allPathStr.includes("__main__.py")) types.add("cli")

  // Library detection (has setup.py/pyproject.toml with package config but no server)
  if ((files.has("setup.py") || (files.get("pyproject.toml") ?? "").includes("[project]")) && !hasBackend && !hasFrontend) {
    types.add("library")
  }
  if ((files.get("package.json") ?? "").includes('"main"') && !hasFrontend && !hasBackend) types.add("library")

  // Monorepo
  if ((files.get("package.json") ?? "").includes('"workspaces"') || allPaths.some(p => p === "lerna.json" || p === "pnpm-workspace.yaml" || p === "turbo.json")) {
    types.add("monorepo")
  }

  // If nothing detected
  if (types.size === 0) types.add("unknown")

  return {
    types: [...types],
    languages: [...languages],
    frameworks: [...frameworks],
    hasLLM,
    hasDatabase,
    hasDocker,
    hasTests,
    hasFrontend,
    hasBackend,
  }
}

// ── Check functions ───────────────────────────────────────────────────────────

function checkSecretPatterns(files: FileMap): CheckResult[] {
  const results: CheckResult[] = []
  const patterns = [
    { name: "OpenAI key", re: /sk-[A-Za-z0-9]{20,}/g, msg: "Possible OpenAI API key found" },
    { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g, msg: "Possible AWS access key ID found" },
    { name: "GitHub token", re: /ghp_[A-Za-z0-9]{36}/g, msg: "Possible GitHub token found" },
    { name: "Slack token", re: /xox[bprs]-[A-Za-z0-9-]{10,}/g, msg: "Possible Slack token found" },
    { name: "Private key", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, msg: "Private key found in source" },
    { name: "Hardcoded api_key", re: /api[_-]?key\s*=\s*["'][^'"${\s]{8,}/gi, msg: "Hardcoded api_key value found" },
    { name: "Hardcoded password", re: /password\s*=\s*["'][^'"${\s]{4,}/gi, msg: "Hardcoded password value found" },
    { name: "Hardcoded secret", re: /secret\s*=\s*["'][^'"${\s]{6,}/gi, msg: "Hardcoded secret value found" },
    { name: "JWT secret", re: /jwt[_-]?secret\s*=\s*["'][^'"${\s]{6,}/gi, msg: "Hardcoded JWT secret found" },
    { name: "Database URL", re: /(postgres|mysql|mongodb(\+srv)?):\/\/[^'"$\s]{10,}/gi, msg: "Database connection string with credentials found" },
  ]
  const skipFiles = new Set([".env.example", ".env.sample", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "uv.lock"])

  let found = false
  for (const [path, content] of files) {
    const filename = path.split("/").pop() ?? ""
    if (skipFiles.has(filename) || filename.endsWith(".lock")) continue
    for (const p of patterns) {
      if (p.re.test(content)) {
        results.push({ name: p.name, category: "Security", severity: "fail", message: p.msg, file: path, suggestion: "Move secrets to environment variables and add them to .gitignore" })
        found = true
        break
      }
      p.re.lastIndex = 0
    }
  }
  if (!found) results.push({ name: "No hardcoded secrets", category: "Security", severity: "pass", message: "No obvious secret patterns found in source files" })
  return results
}

function checkDotEnvGitignore(files: FileMap): CheckResult {
  const gitignore = files.get(".gitignore") ?? ""
  const hasDotEnv = [...files.keys()].some(p => p === ".env" || p.endsWith("/.env"))
  if (!files.has(".gitignore")) return { name: ".gitignore missing", category: "Security", severity: "fail", message: "No .gitignore found", suggestion: "Create .gitignore and add .env, secrets, build artifacts" }
  if (hasDotEnv && !gitignore.split("\n").some(l => l.trim() === ".env" || l.trim() === ".env*" || l.trim() === ".env.local")) {
    return { name: ".env not gitignored", category: "Security", severity: "fail", message: ".env file exists but is not in .gitignore", suggestion: 'Add ".env" to your .gitignore' }
  }
  return { name: ".env in .gitignore", category: "Security", severity: "pass", message: ".env is properly excluded from version control" }
}

function checkDebugMode(files: FileMap): CheckResult {
  for (const [path, content] of files) {
    if (/DEBUG\s*=\s*True/g.test(content) || /NODE_ENV\s*=\s*["']development["']/g.test(content)) {
      return { name: "Debug mode", category: "Security", severity: "warn", message: "DEBUG or development mode flag found", file: path, suggestion: "Use environment variables to control debug mode per environment" }
    }
  }
  return { name: "No debug flags", category: "Security", severity: "pass", message: "No hard-coded debug flags detected" }
}

function checkLLMTimeout(files: FileMap): CheckResult {
  const inits = [/OpenAI\s*\(/g, /Anthropic\s*\(/g, /ChatGroq\s*\(/g, /ChatOpenAI\s*\(/g, /ChatAnthropic\s*\(/g]
  for (const [path, content] of files) {
    for (const re of inits) {
      const matches = [...content.matchAll(re)]
      for (const m of matches) {
        const after = content.slice(m.index!, m.index! + 400)
        if (!after.includes("timeout") && !after.includes("max_retries")) {
          return { name: "LLM missing timeout", category: "LLM Config", severity: "warn", message: "LLM client initialized without timeout", file: path, suggestion: "Add timeout parameter to prevent hanging requests" }
        }
      }
      re.lastIndex = 0
    }
  }
  return { name: "LLM timeout configured", category: "LLM Config", severity: "pass", message: "LLM clients have timeout configuration" }
}

function checkHardcodedModel(files: FileMap): CheckResult {
  const hardcoded = /model\s*=\s*["'](gpt-|claude-|gemini-|llama-|mistral|deepseek)[^"']*["']/gi
  const envBased = /model\s*=\s*(os\.(environ|getenv)|process\.env|settings\.|config\.)/g
  let hasHardcoded = false, hasEnv = false, hFile: string | undefined
  for (const [path, content] of files) {
    if (hardcoded.test(content)) { hasHardcoded = true; hFile = path }
    if (envBased.test(content)) hasEnv = true
    hardcoded.lastIndex = 0; envBased.lastIndex = 0
  }
  if (hasHardcoded && !hasEnv) return { name: "Hardcoded model", category: "LLM Config", severity: "warn", message: "Model name is hardcoded", file: hFile, suggestion: "Use environment variable for model name so you can swap without redeploying" }
  return { name: "Model configurable", category: "LLM Config", severity: "pass", message: "Model name appears configurable" }
}

function checkLLMRetry(files: FileMap): CheckResult {
  const patterns = [/tenacity/g, /@retry/g, /backoff/g, /max_retries/g, /retry_on/g, /RateLimitError/g, /exponential_backoff/g]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Retry logic", category: "LLM Config", severity: "pass", message: "Retry/backoff logic detected" }; re.lastIndex = 0 } }
  return { name: "No retry logic", category: "LLM Config", severity: "warn", message: "No retry/backoff patterns found for LLM calls", suggestion: "Add retry with exponential backoff for resilience against rate limits" }
}

function checkStreaming(files: FileMap): CheckResult {
  const patterns = [/stream\s*=\s*True/g, /stream\s*=\s*true/g, /\.stream\s*\(/g, /streaming/gi, /StreamingResponse/g, /ReadableStream/g, /streamText/g, /streamUI/g]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Streaming", category: "LLM Config", severity: "pass", message: "LLM streaming is in use" }; re.lastIndex = 0 } }
  return { name: "No streaming", category: "LLM Config", severity: "warn", message: "No streaming detected", suggestion: "Consider streaming responses for better UX and latency" }
}

function checkFallbackModel(files: FileMap): CheckResult {
  const patterns = [/fallback/gi, /backup.*model/gi, /secondary.*model/gi, /model.*fallback/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Fallback model", category: "LLM Config", severity: "pass", message: "Fallback model configuration detected" }; re.lastIndex = 0 } }
  return { name: "No fallback", category: "LLM Config", severity: "warn", message: "No fallback model configured", suggestion: "Configure a fallback model in case the primary is unavailable" }
}

// API Health - only run if project is an API/web-app
function checkHealthEndpoint(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasBackend && !profile.types.includes("api")) return { name: "Health endpoint", category: "API Health", severity: "pass", message: "Not an API project — health endpoint check skipped" }
  const patterns = [/["']\/health["']/g, /["']\/healthz["']/g, /["']\/ping["']/g, /["']\/_health["']/g, /["']\/api\/health["']/g, /["']\/status["']/g]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Health endpoint", category: "API Health", severity: "pass", message: "Health endpoint found" }; re.lastIndex = 0 } }
  return { name: "No health endpoint", category: "API Health", severity: "warn", message: "No /health endpoint found", suggestion: "Add a GET /health endpoint for load balancer and uptime checks" }
}

function checkCORS(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasBackend && !profile.types.includes("api")) return { name: "CORS", category: "API Health", severity: "pass", message: "Not an API project — CORS check skipped" }
  const patterns = [/CORSMiddleware/g, /cors\(/gi, /Access-Control-Allow/g, /from fastapi\.middleware\.cors/g, /helmet/gi, /next\.config.*headers/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "CORS configured", category: "API Health", severity: "pass", message: "CORS middleware detected" }; re.lastIndex = 0 } }
  return { name: "No CORS", category: "API Health", severity: "warn", message: "No CORS middleware found", suggestion: "Add CORS middleware and configure allowed origins" }
}

function checkRateLimiting(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasBackend && !profile.types.includes("api")) return { name: "Rate limiting", category: "API Health", severity: "pass", message: "Not an API project — rate limit check skipped" }
  const patterns = [/slowapi/gi, /rate.?limit/gi, /RateLimiter/g, /express-rate-limit/gi, /upstash.*ratelimit/gi, /throttle/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Rate limiting", category: "API Health", severity: "pass", message: "Rate limiting detected" }; re.lastIndex = 0 } }
  return { name: "No rate limiting", category: "API Health", severity: "warn", message: "No rate limiting found", suggestion: "Add rate limiting to protect against abuse and runaway costs" }
}

function checkAuthentication(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasBackend && !profile.types.includes("api") && !profile.types.includes("web-app")) return { name: "Auth", category: "API Health", severity: "pass", message: "Auth check not applicable" }
  const patterns = [/jwt/gi, /oauth/gi, /Bearer/g, /passport/gi, /clerk/gi, /auth0/gi, /supabase.*auth/gi, /next-auth|NextAuth/gi, /Depends.*get_current_user/g, /middleware.*auth/gi, /verify_token/gi, /api_key.*header/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Authentication", category: "API Health", severity: "pass", message: "Authentication mechanism detected" }; re.lastIndex = 0 } }
  return { name: "No auth", category: "API Health", severity: "warn", message: "No authentication mechanism detected", suggestion: "Add authentication to protect API endpoints" }
}

function checkInputValidation(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasBackend && !profile.types.includes("api")) return { name: "Input validation", category: "API Health", severity: "pass", message: "Not applicable" }
  const patterns = [/pydantic|BaseModel/g, /zod/gi, /joi/gi, /yup/gi, /class-validator/gi, /marshmallow/gi, /cerberus/gi, /ajv/gi, /validate/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Input validation", category: "API Health", severity: "pass", message: "Input validation library detected" }; re.lastIndex = 0 } }
  return { name: "No input validation", category: "API Health", severity: "warn", message: "No input validation library found", suggestion: "Add Pydantic (Python) or Zod (TS) for request validation" }
}

// Infrastructure
function checkDockerfile(files: FileMap): CheckResult {
  if ([...files.keys()].some(p => p === "Dockerfile" || p.endsWith("/Dockerfile"))) return { name: "Dockerfile", category: "Infrastructure", severity: "pass", message: "Container configuration found" }
  if ([...files.keys()].some(p => p === "vercel.json" || p === "fly.toml" || p === "railway.json" || p === "Procfile" || p === "netlify.toml" || p === "render.yaml")) return { name: "Deploy config", category: "Infrastructure", severity: "pass", message: "Platform deployment config found" }
  return { name: "No deploy config", category: "Infrastructure", severity: "warn", message: "No Dockerfile or platform deploy config found", suggestion: "Add a Dockerfile or deployment config (vercel.json, fly.toml, etc.)" }
}

function checkGitignore(files: FileMap): CheckResult {
  if (files.has(".gitignore")) return { name: ".gitignore", category: "Infrastructure", severity: "pass", message: ".gitignore found" }
  return { name: "No .gitignore", category: "Infrastructure", severity: "fail", message: "No .gitignore — sensitive files may be committed", suggestion: "Add .gitignore for .env, build artifacts, node_modules, __pycache__" }
}

function checkCI(files: FileMap): CheckResult {
  const ci = [...files.keys()].some(p => p.startsWith(".github/workflows/") || p === ".travis.yml" || p.startsWith(".circleci/") || p === "Jenkinsfile" || p === ".gitlab-ci.yml")
  if (ci) return { name: "CI/CD", category: "Infrastructure", severity: "pass", message: "CI/CD pipeline found" }
  return { name: "No CI/CD", category: "Infrastructure", severity: "warn", message: "No CI/CD configuration", suggestion: "Add GitHub Actions for automated testing and linting" }
}

function checkReadme(files: FileMap): CheckResult {
  if (files.has("README.md") || files.has("README") || files.has("README.rst")) return { name: "README", category: "Infrastructure", severity: "pass", message: "README found" }
  return { name: "No README", category: "Infrastructure", severity: "warn", message: "No README found", suggestion: "Add README.md with setup instructions and usage examples" }
}

function checkDeps(files: FileMap): CheckResult {
  if (files.has("requirements.txt") || files.has("pyproject.toml") || files.has("package.json") || files.has("Cargo.toml") || files.has("go.mod") || files.has("Gemfile")) return { name: "Dependencies", category: "Infrastructure", severity: "pass", message: "Dependency manifest found" }
  return { name: "No dependency file", category: "Infrastructure", severity: "fail", message: "No dependency manifest found", suggestion: "Add requirements.txt, pyproject.toml, or package.json" }
}

function checkLockFile(files: FileMap): CheckResult {
  if ([...files.keys()].some(p => p.endsWith(".lock") || p === "package-lock.json" || p === "yarn.lock" || p === "pnpm-lock.yaml" || p === "uv.lock")) return { name: "Lock file", category: "Infrastructure", severity: "pass", message: "Dependency lock file found" }
  return { name: "No lock file", category: "Infrastructure", severity: "warn", message: "No dependency lock file", suggestion: "Commit a lock file for reproducible builds" }
}

function checkTests(files: FileMap, allPaths: string[], profile: ProjectProfile): CheckResult {
  if (profile.hasTests) return { name: "Tests", category: "Quality", severity: "pass", message: "Test files detected" }
  return { name: "No tests", category: "Quality", severity: "warn", message: "No test files found", suggestion: "Add tests for critical paths — pytest (Python), jest/vitest (JS/TS)" }
}

function checkLinting(files: FileMap, allPaths: string[]): CheckResult {
  const lintConfigs = [".eslintrc", ".eslintrc.js", ".eslintrc.json", "eslint.config.js", "eslint.config.mjs", ".flake8", "ruff.toml", ".pylintrc", "biome.json", ".prettierrc", "prettier.config.js"]
  if (lintConfigs.some(c => allPaths.some(p => p.endsWith(c)))) return { name: "Linting", category: "Quality", severity: "pass", message: "Linting configuration found" }
  const content = files.get("pyproject.toml") ?? ""
  if (content.includes("[tool.ruff]") || content.includes("[tool.flake8]") || content.includes("[tool.pylint]")) return { name: "Linting", category: "Quality", severity: "pass", message: "Linting config found in pyproject.toml" }
  return { name: "No linting", category: "Quality", severity: "warn", message: "No linter configuration found", suggestion: "Add ESLint (JS/TS) or Ruff (Python) for code quality" }
}

function checkTypeChecking(files: FileMap, allPaths: string[], profile: ProjectProfile): CheckResult {
  if (allPaths.some(p => p === "tsconfig.json" || p.endsWith("/tsconfig.json"))) return { name: "Type checking", category: "Quality", severity: "pass", message: "TypeScript configuration found" }
  if (allPaths.some(p => p === "py.typed" || p === "mypy.ini" || p === ".mypy.ini")) return { name: "Type checking", category: "Quality", severity: "pass", message: "Python type checking configured" }
  const pyproject = files.get("pyproject.toml") ?? ""
  if (pyproject.includes("[tool.mypy]") || pyproject.includes("[tool.pyright]")) return { name: "Type checking", category: "Quality", severity: "pass", message: "Type checker configured in pyproject.toml" }
  if (profile.languages.includes("Python")) return { name: "No type checking", category: "Quality", severity: "warn", message: "No type checker configured for Python", suggestion: "Add mypy or pyright for type safety" }
  return { name: "Type checking", category: "Quality", severity: "pass", message: "Type checking not applicable" }
}

// Database checks
function checkMigrations(files: FileMap, allPaths: string[], profile: ProjectProfile): CheckResult {
  if (!profile.hasDatabase) return { name: "Migrations", category: "Database", severity: "pass", message: "No database detected — migration check skipped" }
  const migrationPatterns = allPaths.some(p => /migration|alembic|prisma\/migrations|knex.*migration|flyway|liquibase/i.test(p))
  const contentPatterns = [...files.values()].some(c => /alembic|migrate|prisma migrate|knex.*migrate|typeorm.*migration/i.test(c))
  if (migrationPatterns || contentPatterns) return { name: "Migrations", category: "Database", severity: "pass", message: "Database migration setup detected" }
  return { name: "No migrations", category: "Database", severity: "warn", message: "Database detected but no migration tool found", suggestion: "Add Alembic (Python), Prisma Migrate (TS), or Knex migrations for schema management" }
}

function checkConnectionPooling(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.hasDatabase) return { name: "Connection pooling", category: "Database", severity: "pass", message: "Not applicable" }
  const patterns = [/pool_size/gi, /max_connections/gi, /connectionLimit/gi, /pool\s*:/gi, /create_pool/gi, /pgBouncer/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Connection pooling", category: "Database", severity: "pass", message: "Connection pooling configured" }; re.lastIndex = 0 } }
  return { name: "No pooling", category: "Database", severity: "warn", message: "No connection pooling detected", suggestion: "Configure connection pooling to handle concurrent database requests efficiently" }
}

// Agent-specific checks
function checkAgentGuardrails(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.types.includes("agent")) return { name: "Guardrails", category: "Agent Safety", severity: "pass", message: "Not an agent project" }
  const patterns = [/guardrail/gi, /content.?filter/gi, /moderation/gi, /safety/gi, /max.?iterations/gi, /max.?steps/gi, /recursion.?limit/gi, /tool.?validation/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Agent guardrails", category: "Agent Safety", severity: "pass", message: "Agent guardrails or safety checks detected" }; re.lastIndex = 0 } }
  return { name: "No guardrails", category: "Agent Safety", severity: "warn", message: "No agent guardrails detected", suggestion: "Add iteration limits, output validation, or content filtering for agent safety" }
}

function checkAgentLogging(files: FileMap, profile: ProjectProfile): CheckResult {
  if (!profile.types.includes("agent")) return { name: "Agent tracing", category: "Agent Safety", severity: "pass", message: "Not an agent project" }
  const patterns = [/langsmith/gi, /langfuse/gi, /wandb/gi, /mlflow/gi, /phoenix/gi, /callback/gi, /tracer/gi, /tracing/gi, /AgentCallbackHandler/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Agent tracing", category: "Agent Safety", severity: "pass", message: "Agent tracing/observability detected" }; re.lastIndex = 0 } }
  return { name: "No agent tracing", category: "Agent Safety", severity: "warn", message: "No agent tracing tool detected", suggestion: "Add LangSmith, Langfuse, or Phoenix for agent run observability" }
}

// Reliability
function checkLogging(files: FileMap): CheckResult {
  const patterns = [/import logging/g, /from logging/g, /winston/g, /pino/g, /morgan/g, /structlog/g, /logger\s*=/g, /getLogger/g, /bunyan/g]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Logging", category: "Reliability", severity: "pass", message: "Logging setup detected" }; re.lastIndex = 0 } }
  return { name: "No logging", category: "Reliability", severity: "warn", message: "No logging setup found", suggestion: "Add structured logging (structlog/loguru for Python, pino/winston for Node)" }
}

function checkMonitoring(files: FileMap): CheckResult {
  const patterns = [/sentry/gi, /opentelemetry/gi, /datadog/gi, /newrelic/gi, /prometheus/gi, /honeycomb/gi, /bugsnag/gi]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Monitoring", category: "Reliability", severity: "pass", message: "Monitoring tool detected" }; re.lastIndex = 0 } }
  return { name: "No monitoring", category: "Reliability", severity: "warn", message: "No monitoring/observability tools found", suggestion: "Add Sentry for errors, or OpenTelemetry for distributed tracing" }
}

function checkErrorHandling(files: FileMap): CheckResult {
  const patterns = [/exception_handler/gi, /errorHandler/gi, /app\.use\(.*err/g, /@app\.exception_handler/g, /global.*error/gi, /unhandledRejection/g, /process\.on.*uncaughtException/g]
  for (const [, content] of files) { for (const re of patterns) { if (re.test(content)) return { name: "Error handling", category: "Reliability", severity: "pass", message: "Global error handling detected" }; re.lastIndex = 0 } }
  return { name: "No global error handling", category: "Reliability", severity: "warn", message: "No global error handler found", suggestion: "Add a global exception/error handler to catch unhandled errors gracefully" }
}

// Cost
const KNOWN_MODELS: { pattern: RegExp; tier: string; monthlyLow: number; monthlyHigh: number }[] = [
  { pattern: /gpt-4o-mini/gi, tier: "low", monthlyLow: 5, monthlyHigh: 50 },
  { pattern: /gpt-4o/gi, tier: "medium", monthlyLow: 50, monthlyHigh: 300 },
  { pattern: /gpt-4-turbo/gi, tier: "high", monthlyLow: 150, monthlyHigh: 800 },
  { pattern: /gpt-4(?!o|-turbo|-mini)/gi, tier: "high", monthlyLow: 200, monthlyHigh: 1000 },
  { pattern: /gpt-3\.5-turbo/gi, tier: "low", monthlyLow: 5, monthlyHigh: 50 },
  { pattern: /claude-opus/gi, tier: "high", monthlyLow: 150, monthlyHigh: 900 },
  { pattern: /claude-sonnet|claude-3-sonnet|claude-3\.5-sonnet/gi, tier: "medium", monthlyLow: 40, monthlyHigh: 250 },
  { pattern: /claude-haiku/gi, tier: "low", monthlyLow: 5, monthlyHigh: 40 },
  { pattern: /gemini-pro/gi, tier: "medium", monthlyLow: 30, monthlyHigh: 200 },
  { pattern: /gemini-flash/gi, tier: "low", monthlyLow: 3, monthlyHigh: 30 },
  { pattern: /llama-3/gi, tier: "low", monthlyLow: 2, monthlyHigh: 20 },
  { pattern: /mistral-large/gi, tier: "medium", monthlyLow: 30, monthlyHigh: 180 },
  { pattern: /mistral-small|mistral-7b/gi, tier: "low", monthlyLow: 2, monthlyHigh: 20 },
  { pattern: /deepseek/gi, tier: "low", monthlyLow: 3, monthlyHigh: 30 },
  { pattern: /groq/gi, tier: "low", monthlyLow: 2, monthlyHigh: 25 },
]

function checkCostModels(files: FileMap): { checks: CheckResult[]; costEstimate?: ScanReport["costEstimate"] } {
  const detected: CostModel[] = []
  const seen = new Set<string>()
  const all = [...files.values()].join("\n")
  for (const m of KNOWN_MODELS) {
    const match = m.pattern.exec(all); m.pattern.lastIndex = 0
    if (match) { const name = match[0].toLowerCase(); if (!seen.has(name)) { seen.add(name); detected.push({ name: match[0], tier: m.tier, monthlyLow: m.monthlyLow, monthlyHigh: m.monthlyHigh }) } }
  }
  if (detected.length === 0) return { checks: [{ name: "No LLM models", category: "Cost", severity: "pass", message: "No LLM model references found in source" }] }
  const checks: CheckResult[] = []
  const high = detected.filter(m => m.tier === "high")
  if (high.length > 0) checks.push({ name: "High-cost models", category: "Cost", severity: "warn", message: `Expensive model(s): ${high.map(m => m.name).join(", ")}`, suggestion: "Consider cheaper models for non-critical tasks" })
  else checks.push({ name: "Cost efficient", category: "Cost", severity: "pass", message: `Models: ${detected.map(m => m.name).join(", ")}` })

  // Check caching
  const cachePatterns = [/cache/gi, /redis/gi, /memoize/gi, /lru_cache/gi]
  let hasCaching = false
  for (const [, content] of files) { for (const re of cachePatterns) { if (re.test(content)) hasCaching = true; re.lastIndex = 0 } }
  if (!hasCaching && detected.length > 0) checks.push({ name: "No LLM caching", category: "Cost", severity: "warn", message: "No response caching detected", suggestion: "Add caching for repeated LLM queries to reduce costs" })
  else if (hasCaching) checks.push({ name: "Caching", category: "Cost", severity: "pass", message: "Response caching detected" })

  return { checks, costEstimate: { models: detected, totalLow: detected.reduce((s, m) => s + m.monthlyLow, 0), totalHigh: detected.reduce((s, m) => s + m.monthlyHigh, 0) } }
}

// Score
function computeScore(checks: CheckResult[]): number {
  const real = checks.filter(c => !c.message.includes("skipped") && !c.message.includes("Not applicable") && !c.message.includes("not applicable") && !c.message.includes("Not an"))
  if (real.length === 0) return 100
  const weights: Record<Severity, number> = { pass: 1, warn: 0.5, fail: 0 }
  return Math.round((real.reduce((s, c) => s + weights[c.severity], 0) / real.length) * 100)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  if (!body.url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  const parsed = parseGitHubURL(body.url)
  if (!parsed) return NextResponse.json({ error: "Invalid GitHub URL. Expected https://github.com/owner/repo" }, { status: 400 })
  const { owner, repo } = parsed

  let tree: TreeItem[]
  try {
    const result = await fetchTree(owner, repo)
    tree = result.items
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (msg === "REPO_NOT_FOUND") return NextResponse.json({ error: "Repository not found or is private." }, { status: 404 })
    if (msg === "RATE_LIMITED") return NextResponse.json({ error: "GitHub API rate limit reached. Try again in a few minutes." }, { status: 429 })
    return NextResponse.json({ error: "Failed to fetch repository" }, { status: 500 })
  }

  const allPaths = tree.map(i => i.path)
  const relevant = tree.filter(i => isRelevant(i.path)).slice(0, 60)
  const fileMap: FileMap = new Map()
  for (let i = 0; i < relevant.length; i += 10) {
    const batch = relevant.slice(i, i + 10)
    const results = await Promise.all(batch.map(async item => [item.path, await fetchFileContent(owner, repo, item.path)] as [string, string]))
    for (const [p, c] of results) { if (c) fileMap.set(p, c) }
  }

  // Detect project type
  const profile = detectProjectProfile(fileMap, allPaths)

  // Run checks based on project profile
  const checks: CheckResult[] = []

  // Always run: Security
  checks.push(...checkSecretPatterns(fileMap))
  checks.push(checkDotEnvGitignore(fileMap))
  checks.push(checkDebugMode(fileMap))

  // LLM checks — only if LLM usage detected
  if (profile.hasLLM) {
    checks.push(checkLLMTimeout(fileMap))
    checks.push(checkHardcodedModel(fileMap))
    checks.push(checkLLMRetry(fileMap))
    checks.push(checkStreaming(fileMap))
    checks.push(checkFallbackModel(fileMap))
  }

  // API Health — contextual
  checks.push(checkHealthEndpoint(fileMap, profile))
  checks.push(checkCORS(fileMap, profile))
  checks.push(checkRateLimiting(fileMap, profile))
  checks.push(checkAuthentication(fileMap, profile))
  checks.push(checkInputValidation(fileMap, profile))

  // Infrastructure — always
  checks.push(checkDockerfile(fileMap))
  checks.push(checkGitignore(fileMap))
  checks.push(checkCI(fileMap))
  checks.push(checkReadme(fileMap))
  checks.push(checkDeps(fileMap))
  checks.push(checkLockFile(fileMap))

  // Quality
  checks.push(checkTests(fileMap, allPaths, profile))
  checks.push(checkLinting(fileMap, allPaths))
  checks.push(checkTypeChecking(fileMap, allPaths, profile))

  // Database — only if detected
  if (profile.hasDatabase) {
    checks.push(checkMigrations(fileMap, allPaths, profile))
    checks.push(checkConnectionPooling(fileMap, profile))
  }

  // Agent safety — only if agent project
  if (profile.types.includes("agent")) {
    checks.push(checkAgentGuardrails(fileMap, profile))
    checks.push(checkAgentLogging(fileMap, profile))
  }

  // Cost
  const { checks: costChecks, costEstimate } = checkCostModels(fileMap)
  checks.push(...costChecks)

  // Reliability
  checks.push(checkLogging(fileMap))
  checks.push(checkMonitoring(fileMap))
  checks.push(checkErrorHandling(fileMap))

  // Filter out "not applicable" checks from display
  const displayChecks = checks.filter(c => !c.message.includes("Not applicable") && !c.message.includes("not applicable") && !c.message.includes("Not an agent"))

  const passed = displayChecks.filter(c => c.severity === "pass").length
  const warnings = displayChecks.filter(c => c.severity === "warn").length
  const failures = displayChecks.filter(c => c.severity === "fail").length

  const report: ScanReport = {
    project: `${owner}/${repo}`,
    score: computeScore(displayChecks),
    total: displayChecks.length,
    passed, warnings, failures,
    checks: displayChecks,
    profile,
    ...(costEstimate ? { costEstimate } : {}),
  }

  return NextResponse.json(report)
}
