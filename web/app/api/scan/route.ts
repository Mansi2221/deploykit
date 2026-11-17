import { NextRequest, NextResponse } from "next/server"
import { CheckResult, ScanReport, CostModel, Severity } from "@/app/types"

// ── GitHub helpers ────────────────────────────────────────────────────────────

function parseGitHubURL(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== "github.com") return null
    const parts = u.pathname.replace(/^\//, "").replace(/\/$/, "").split("/")
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

interface TreeItem {
  path: string
  type: string
  url: string
}

const RELEVANT_EXTENSIONS = new Set([
  ".py", ".ts", ".tsx", ".js", ".jsx",
  ".json", ".yml", ".yaml", ".toml", ".cfg", ".ini",
  ".env", ".env.example", ".env.sample",
])
const RELEVANT_FILENAMES = new Set([
  "Dockerfile", ".gitignore", "README.md", "README",
  "requirements.txt", "pyproject.toml", "package.json",
  "Makefile", "docker-compose.yml", "docker-compose.yaml",
])

function isRelevant(path: string): boolean {
  const filename = path.split("/").pop() ?? ""
  if (RELEVANT_FILENAMES.has(filename)) return true
  const dot = filename.lastIndexOf(".")
  if (dot !== -1) {
    const ext = filename.slice(dot)
    if (RELEVANT_EXTENSIONS.has(ext)) return true
  }
  return false
}

async function fetchTree(
  owner: string,
  repo: string
): Promise<{ items: TreeItem[]; branch: string }> {
  // Try main then master
  for (const branch of ["main", "master"]) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, next: { revalidate: 0 } }
    )
    if (res.ok) {
      const data = await res.json()
      const items: TreeItem[] = (data.tree ?? []).filter(
        (item: TreeItem) => item.type === "blob"
      )
      return { items, branch }
    }
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}))
      if (body?.message?.includes("Not Found")) break
    }
  }
  throw new Error("REPO_NOT_FOUND")
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
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

// ── File map type ─────────────────────────────────────────────────────────────

type FileMap = Map<string, string> // path → decoded content

// ── Individual checks ─────────────────────────────────────────────────────────

function checkSecretPatterns(files: FileMap): CheckResult[] {
  const results: CheckResult[] = []

  // Secret pattern regexes with actual value captures
  const patterns: { name: string; re: RegExp; msg: string }[] = [
    { name: "OpenAI key", re: /sk-[A-Za-z0-9]{20,}/g, msg: "Possible OpenAI API key found in source" },
    { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g, msg: "Possible AWS access key ID found in source" },
    { name: "GitHub token", re: /ghp_[A-Za-z0-9]{36}/g, msg: "Possible GitHub personal access token found in source" },
    { name: "Hardcoded api_key", re: /api[_-]?key\s*=\s*["'][^'"${\s]{6,}/gi, msg: "Hardcoded api_key value found" },
    { name: "Hardcoded password", re: /password\s*=\s*["'][^'"${\s]{4,}/gi, msg: "Hardcoded password value found" },
    { name: "Hardcoded secret", re: /secret\s*=\s*["'][^'"${\s]{4,}/gi, msg: "Hardcoded secret value found" },
  ]

  // Skip .env files from secret scanning (they're meant to hold values)
  // but still flag if the .env file is not gitignored (handled separately)
  const skipPaths = new Set([".env.example", ".env.sample"])

  let found = false
  for (const [path, content] of files) {
    const filename = path.split("/").pop() ?? ""
    if (skipPaths.has(filename)) continue
    // Don't scan lock files
    if (filename.endsWith(".lock") || filename === "package-lock.json") continue

    for (const p of patterns) {
      if (p.re.test(content)) {
        results.push({
          name: p.name,
          category: "Security",
          severity: "fail",
          message: p.msg,
          file: path,
          suggestion: "Move secrets to environment variables and add them to .gitignore",
        })
        found = true
        break // one fail per file is enough
      }
      p.re.lastIndex = 0
    }
  }

  if (!found) {
    results.push({
      name: "No hardcoded secrets",
      category: "Security",
      severity: "pass",
      message: "No obvious secret patterns found in source files",
    })
  }

  return results
}

function checkDotEnvGitignore(files: FileMap): CheckResult {
  const gitignoreContent = files.get(".gitignore") ?? ""
  const hasGitignore = files.has(".gitignore")
  const hasDotEnv = [...files.keys()].some((p) => p === ".env" || p.endsWith("/.env"))

  if (!hasGitignore) {
    return {
      name: ".gitignore missing",
      category: "Security",
      severity: "fail",
      message: "No .gitignore file found — secrets in .env could be committed",
      suggestion: "Create a .gitignore and add .env to it",
    }
  }

  if (hasDotEnv && !gitignoreContent.split("\n").some((l) => l.trim() === ".env")) {
    return {
      name: ".env not in .gitignore",
      category: "Security",
      severity: "fail",
      message: ".env file exists but is not listed in .gitignore",
      suggestion: 'Add ".env" to your .gitignore',
    }
  }

  return {
    name: ".env in .gitignore",
    category: "Security",
    severity: "pass",
    message: ".env is properly excluded from version control",
  }
}

function checkDebugMode(files: FileMap): CheckResult {
  const debugPatterns = [/DEBUG\s*=\s*True/g, /debug\s*=\s*true/gi, /NODE_ENV\s*=\s*["']development["']/g]
  for (const [path, content] of files) {
    for (const re of debugPatterns) {
      if (re.test(content)) {
        return {
          name: "DEBUG mode enabled",
          category: "Security",
          severity: "warn",
          message: "DEBUG=True pattern found — ensure this is not enabled in production",
          file: path,
          suggestion: "Use environment variables to control debug mode (e.g. DEBUG=False in production)",
        }
      }
      re.lastIndex = 0
    }
  }
  return {
    name: "No debug flags",
    category: "Security",
    severity: "pass",
    message: "No hard-coded debug flags detected",
  }
}

function checkLLMTimeout(files: FileMap): CheckResult {
  // Look for LLM client init without timeout parameter
  // e.g. openai.OpenAI() or Anthropic() without timeout=
  const initPatterns = [
    /OpenAI\s*\(/g,
    /Anthropic\s*\(/g,
    /anthropic\.Anthropic\s*\(/g,
    /openai\.OpenAI\s*\(/g,
  ]

  for (const [path, content] of files) {
    for (const re of initPatterns) {
      const matches = [...content.matchAll(re)]
      for (const match of matches) {
        // Extract the call arguments — look for timeout in the next ~200 chars
        const after = content.slice(match.index!, match.index! + 300)
        if (!after.includes("timeout")) {
          return {
            name: "LLM client missing timeout",
            category: "LLM Config",
            severity: "warn",
            message: "LLM client initialized without a timeout parameter",
            file: path,
            suggestion: "Pass timeout= when initializing the LLM client to prevent hanging requests",
          }
        }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "LLM timeout configured",
    category: "LLM Config",
    severity: "pass",
    message: "LLM clients appear to have timeout configuration",
  }
}

function checkHardcodedModel(files: FileMap): CheckResult {
  const hardcodedModelRe = /model\s*=\s*["'](gpt-4|gpt-3\.5-turbo|gpt-4o|gpt-4-turbo|claude-3|claude-sonnet|claude-haiku|claude-opus|text-davinci)[^"']*["']/gi
  const envModelRe = /model\s*=\s*os\.(environ|getenv)|model\s*=\s*process\.env/g

  let hasHardcoded = false
  let hasEnvBased = false
  let hardcodedFile: string | undefined

  for (const [path, content] of files) {
    if (hardcodedModelRe.test(content)) {
      hasHardcoded = true
      hardcodedFile = path
    }
    if (envModelRe.test(content)) hasEnvBased = true
    hardcodedModelRe.lastIndex = 0
    envModelRe.lastIndex = 0
  }

  if (hasHardcoded && !hasEnvBased) {
    return {
      name: "Hardcoded model name",
      category: "LLM Config",
      severity: "warn",
      message: "LLM model name is hardcoded in source",
      file: hardcodedFile,
      suggestion: "Use an environment variable (e.g. MODEL=gpt-4o) so you can change models without redeployment",
    }
  }

  return {
    name: "Model name configurable",
    category: "LLM Config",
    severity: "pass",
    message: "Model name appears to be configurable via environment",
  }
}

function checkLLMRetry(files: FileMap): CheckResult {
  const retryPatterns = [
    /tenacity/g, /retry/gi, /backoff/gi, /RateLimitError/g,
    /except.*Error/g, /try\s*{/g, /\.catch\s*\(/g,
  ]

  let hasRetry = false
  for (const [, content] of files) {
    for (const re of retryPatterns) {
      if (re.test(content)) { hasRetry = true; break }
      re.lastIndex = 0
    }
    if (hasRetry) break
  }

  if (!hasRetry) {
    return {
      name: "No retry/error handling",
      category: "LLM Config",
      severity: "warn",
      message: "No retry logic or error handling patterns found around LLM calls",
      suggestion: "Add retry logic (e.g. tenacity in Python, or axios-retry in JS) for resilience against rate limits",
    }
  }

  return {
    name: "Error handling present",
    category: "LLM Config",
    severity: "pass",
    message: "Retry/error handling patterns detected",
  }
}

function checkStreaming(files: FileMap): CheckResult {
  const streamPatterns = [/stream\s*=\s*True/g, /stream\s*=\s*true/g, /\.stream\s*\(/g, /streaming/gi]

  for (const [, content] of files) {
    for (const re of streamPatterns) {
      if (re.test(content)) {
        return {
          name: "Streaming configured",
          category: "LLM Config",
          severity: "pass",
          message: "LLM streaming is in use — good for latency and UX",
        }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No streaming detected",
    category: "LLM Config",
    severity: "warn",
    message: "LLM calls do not appear to use streaming",
    suggestion: "Consider streaming responses to improve perceived latency for end users",
  }
}

function detectFramework(files: FileMap): string | null {
  for (const [, content] of files) {
    if (/from fastapi/i.test(content) || /import fastapi/i.test(content)) return "FastAPI"
    if (/from flask/i.test(content) || /import flask/i.test(content)) return "Flask"
    if (/express\(\)/i.test(content) || /require\(['"](express)['"]\)/i.test(content)) return "Express"
  }
  if (files.has("package.json")) {
    const pkg = files.get("package.json") ?? ""
    if (pkg.includes('"next"')) return "Next.js"
  }
  return null
}

function checkHealthEndpoint(files: FileMap): CheckResult {
  const framework = detectFramework(files)
  const healthPatterns = [
    /["']\/health["']/g,
    /["']\/healthz["']/g,
    /["']\/ping["']/g,
    /["']\/_health["']/g,
    /path\s*=\s*["']\/health/g,
  ]

  for (const [, content] of files) {
    for (const re of healthPatterns) {
      if (re.test(content)) {
        return {
          name: "Health endpoint exists",
          category: "API Health",
          severity: "pass",
          message: `Health endpoint detected${framework ? ` (${framework})` : ""}`,
        }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No health endpoint",
    category: "API Health",
    severity: "warn",
    message: `No /health or /ping endpoint found${framework ? ` in ${framework} app` : ""}`,
    suggestion: "Add a GET /health endpoint that returns {status: 'ok'} for load balancer checks",
  }
}

function checkCORS(files: FileMap): CheckResult {
  const corsPatterns = [
    /CORSMiddleware/g, /cors\s*\(/gi, /Access-Control-Allow-Origin/g,
    /from fastapi.middleware.cors/g, /cors\s*=\s*require/gi,
  ]

  for (const [, content] of files) {
    for (const re of corsPatterns) {
      if (re.test(content)) {
        return {
          name: "CORS middleware",
          category: "API Health",
          severity: "pass",
          message: "CORS middleware configured",
        }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No CORS middleware",
    category: "API Health",
    severity: "warn",
    message: "No CORS middleware found — browser clients may be blocked",
    suggestion: "Add CORS middleware and configure allowed origins explicitly",
  }
}

function checkRateLimiting(files: FileMap): CheckResult {
  const rateLimitPatterns = [
    /slowapi/gi, /rate.?limit/gi, /RateLimiter/g,
    /express-rate-limit/gi, /upstash.*ratelimit/gi, /limiter/gi,
  ]

  for (const [, content] of files) {
    for (const re of rateLimitPatterns) {
      if (re.test(content)) {
        return {
          name: "Rate limiting",
          category: "API Health",
          severity: "pass",
          message: "Rate limiting implementation detected",
        }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No rate limiting",
    category: "API Health",
    severity: "fail",
    message: "No rate limiting found — API is vulnerable to abuse and runaway LLM costs",
    suggestion: "Add rate limiting middleware (slowapi for FastAPI, express-rate-limit for Express)",
  }
}

function checkDockerfile(files: FileMap): CheckResult {
  if (files.has("Dockerfile")) {
    return { name: "Dockerfile exists", category: "Infrastructure", severity: "pass", message: "Dockerfile found" }
  }
  return {
    name: "No Dockerfile",
    category: "Infrastructure",
    severity: "warn",
    message: "No Dockerfile found — containerization not configured",
    suggestion: "Add a Dockerfile for consistent, reproducible deployments",
  }
}

function checkGitignore(files: FileMap): CheckResult {
  if (files.has(".gitignore")) {
    return { name: ".gitignore exists", category: "Infrastructure", severity: "pass", message: ".gitignore file found" }
  }
  return {
    name: "No .gitignore",
    category: "Infrastructure",
    severity: "fail",
    message: "No .gitignore found — sensitive files may be committed",
    suggestion: "Add a .gitignore to exclude .env, __pycache__, node_modules, etc.",
  }
}

function checkCI(files: FileMap): CheckResult {
  const ciPaths = [...files.keys()].filter(
    (p) =>
      p.startsWith(".github/workflows/") ||
      p === ".travis.yml" ||
      p === "circle.yml" ||
      p.startsWith(".circleci/") ||
      p === "Jenkinsfile"
  )

  if (ciPaths.length > 0) {
    return { name: "CI/CD configured", category: "Infrastructure", severity: "pass", message: `CI/CD pipeline found (${ciPaths[0]})` }
  }

  return {
    name: "No CI/CD",
    category: "Infrastructure",
    severity: "warn",
    message: "No CI/CD configuration found",
    suggestion: "Add a GitHub Actions workflow to run tests and lint on every push",
  }
}

function checkReadme(files: FileMap): CheckResult {
  if (files.has("README.md") || files.has("README") || files.has("README.rst")) {
    return { name: "README exists", category: "Infrastructure", severity: "pass", message: "README file found" }
  }
  return {
    name: "No README",
    category: "Infrastructure",
    severity: "warn",
    message: "No README found",
    suggestion: "Add a README.md with setup instructions and usage examples",
  }
}

function checkDependencyFile(files: FileMap): CheckResult {
  if (
    files.has("requirements.txt") ||
    files.has("pyproject.toml") ||
    files.has("package.json") ||
    files.has("Pipfile")
  ) {
    return { name: "Dependency file exists", category: "Infrastructure", severity: "pass", message: "Dependency manifest found" }
  }
  return {
    name: "No dependency file",
    category: "Infrastructure",
    severity: "fail",
    message: "No requirements.txt, pyproject.toml, or package.json found",
    suggestion: "Add a dependency manifest so the project can be reproduced",
  }
}

// ── Cost checks ───────────────────────────────────────────────────────────────

interface ModelInfo {
  pattern: RegExp
  tier: string
  monthlyLow: number
  monthlyHigh: number
}

const KNOWN_MODELS: ModelInfo[] = [
  { pattern: /gpt-4o/gi, tier: "medium", monthlyLow: 50, monthlyHigh: 300 },
  { pattern: /gpt-4-turbo/gi, tier: "high", monthlyLow: 150, monthlyHigh: 800 },
  { pattern: /gpt-4(?!o|-turbo)/gi, tier: "high", monthlyLow: 200, monthlyHigh: 1000 },
  { pattern: /gpt-3\.5-turbo/gi, tier: "low", monthlyLow: 5, monthlyHigh: 50 },
  { pattern: /claude-3-opus/gi, tier: "high", monthlyLow: 150, monthlyHigh: 900 },
  { pattern: /claude-3-sonnet|claude-sonnet/gi, tier: "medium", monthlyLow: 40, monthlyHigh: 250 },
  { pattern: /claude-3-haiku|claude-haiku/gi, tier: "low", monthlyLow: 5, monthlyHigh: 40 },
  { pattern: /claude-3\.5-sonnet/gi, tier: "medium", monthlyLow: 50, monthlyHigh: 300 },
]

function checkCostModels(files: FileMap): { checks: CheckResult[]; costEstimate?: ScanReport["costEstimate"] } {
  const detectedModels: CostModel[] = []
  const seenNames = new Set<string>()
  const allContent = [...files.values()].join("\n")

  for (const m of KNOWN_MODELS) {
    const match = m.pattern.exec(allContent)
    m.pattern.lastIndex = 0
    if (match) {
      const name = match[0].toLowerCase()
      if (!seenNames.has(name)) {
        seenNames.add(name)
        detectedModels.push({ name: match[0], tier: m.tier, monthlyLow: m.monthlyLow, monthlyHigh: m.monthlyHigh })
      }
    }
  }

  if (detectedModels.length === 0) {
    return {
      checks: [{
        name: "No LLM models detected",
        category: "Cost",
        severity: "warn",
        message: "Could not detect LLM model names in source",
        suggestion: "Ensure model names are visible in source for cost estimation",
      }],
    }
  }

  const checks: CheckResult[] = []
  const highTierModels = detectedModels.filter((m) => m.tier === "high")

  if (highTierModels.length > 0) {
    checks.push({
      name: "High-cost model in use",
      category: "Cost",
      severity: "warn",
      message: `High-cost model(s) detected: ${highTierModels.map((m) => m.name).join(", ")}`,
      suggestion: "Consider using a cheaper model for non-critical tasks (e.g. gpt-4o-mini, claude-haiku)",
    })
  } else {
    checks.push({
      name: "Reasonable model tier",
      category: "Cost",
      severity: "pass",
      message: `Models detected: ${detectedModels.map((m) => m.name).join(", ")}`,
    })
  }

  const totalLow = detectedModels.reduce((s, m) => s + m.monthlyLow, 0)
  const totalHigh = detectedModels.reduce((s, m) => s + m.monthlyHigh, 0)

  return {
    checks,
    costEstimate: {
      models: detectedModels,
      totalLow,
      totalHigh,
    },
  }
}

// ── Reliability checks ────────────────────────────────────────────────────────

function checkLogging(files: FileMap): CheckResult {
  const loggingPatterns = [
    /import logging/g, /from logging/g,
    /winston/g, /pino/g, /morgan/g,
    /console\.log/g, /logger\./g,
    /structlog/g,
  ]

  for (const [, content] of files) {
    for (const re of loggingPatterns) {
      if (re.test(content)) {
        re.lastIndex = 0
        return { name: "Logging configured", category: "Reliability", severity: "pass", message: "Logging setup detected" }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No logging",
    category: "Reliability",
    severity: "warn",
    message: "No logging imports or configuration found",
    suggestion: "Add structured logging (Python: logging/structlog, Node: winston/pino)",
  }
}

function checkMonitoring(files: FileMap): CheckResult {
  const monitoringPatterns = [
    /sentry/gi, /opentelemetry/gi, /datadog/gi, /newrelic/gi,
    /prometheus/gi, /grafana/gi, /honeycomb/gi,
  ]

  for (const [, content] of files) {
    for (const re of monitoringPatterns) {
      if (re.test(content)) {
        re.lastIndex = 0
        return { name: "Monitoring integrated", category: "Reliability", severity: "pass", message: "Monitoring/observability tool detected" }
      }
      re.lastIndex = 0
    }
  }

  return {
    name: "No monitoring",
    category: "Reliability",
    severity: "warn",
    message: "No monitoring or observability tools found",
    suggestion: "Add Sentry for error tracking, or OpenTelemetry for distributed tracing",
  }
}

// ── Score calculation ─────────────────────────────────────────────────────────

function computeScore(checks: CheckResult[]): number {
  if (checks.length === 0) return 0
  const weights: Record<Severity, number> = { pass: 1, warn: 0.5, fail: 0 }
  const total = checks.reduce((s, c) => s + weights[c.severity], 0)
  return Math.round((total / checks.length) * 100)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { url } = body
  if (!url) return NextResponse.json({ error: "Missing url field" }, { status: 400 })

  const parsed = parseGitHubURL(url)
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL. Expected https://github.com/owner/repo" },
      { status: 400 }
    )
  }

  const { owner, repo } = parsed

  // Fetch file tree
  let tree: TreeItem[]
  let branch: string
  try {
    const result = await fetchTree(owner, repo)
    tree = result.items
    branch = result.branch
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "REPO_NOT_FOUND") {
      return NextResponse.json(
        { error: "Repository not found or is private. Only public repositories are supported." },
        { status: 404 }
      )
    }
    if (msg.includes("rate limit") || msg.includes("403")) {
      return NextResponse.json(
        { error: "GitHub API rate limit reached. Please try again in a few minutes." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Failed to fetch repository tree" }, { status: 500 })
  }

  // Filter to relevant files, capped at 50
  const relevantFiles = tree.filter((item) => isRelevant(item.path)).slice(0, 50)

  // Fetch file contents in parallel (batches of 10 to avoid hammering GH API)
  const fileMap: FileMap = new Map()
  const batchSize = 10
  for (let i = 0; i < relevantFiles.length; i += batchSize) {
    const batch = relevantFiles.slice(i, i + batchSize)
    const contents = await Promise.all(
      batch.map(async (item) => {
        const content = await fetchFileContent(owner, repo, item.path)
        return [item.path, content] as [string, string]
      })
    )
    for (const [path, content] of contents) {
      if (content) fileMap.set(path, content)
    }
  }

  // Run all checks
  const checks: CheckResult[] = []

  // Security
  checks.push(...checkSecretPatterns(fileMap))
  checks.push(checkDotEnvGitignore(fileMap))
  checks.push(checkDebugMode(fileMap))

  // LLM Config
  checks.push(checkLLMTimeout(fileMap))
  checks.push(checkHardcodedModel(fileMap))
  checks.push(checkLLMRetry(fileMap))
  checks.push(checkStreaming(fileMap))

  // API Health
  checks.push(checkHealthEndpoint(fileMap))
  checks.push(checkCORS(fileMap))
  checks.push(checkRateLimiting(fileMap))

  // Infrastructure
  checks.push(checkDockerfile(fileMap))
  checks.push(checkGitignore(fileMap))
  checks.push(checkCI(fileMap))
  checks.push(checkReadme(fileMap))
  checks.push(checkDependencyFile(fileMap))

  // Cost + Reliability
  const { checks: costChecks, costEstimate } = checkCostModels(fileMap)
  checks.push(...costChecks)
  checks.push(checkLogging(fileMap))
  checks.push(checkMonitoring(fileMap))

  const passed = checks.filter((c) => c.severity === "pass").length
  const warnings = checks.filter((c) => c.severity === "warn").length
  const failures = checks.filter((c) => c.severity === "fail").length
  const score = computeScore(checks)

  const report: ScanReport = {
    project: `${owner}/${repo}`,
    score,
    total: checks.length,
    passed,
    warnings,
    failures,
    checks,
    ...(costEstimate ? { costEstimate } : {}),
  }

  // Suppress unused variable warning
  void branch

  return NextResponse.json(report)
}
