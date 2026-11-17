export type Severity = "pass" | "warn" | "fail"

export interface CheckResult {
  name: string
  category: string
  severity: Severity
  message: string
  file?: string
  suggestion?: string
}

export interface CostModel {
  name: string
  tier: string
  monthlyLow: number
  monthlyHigh: number
}

export type ProjectType =
  | "api"           // FastAPI, Flask, Express, Django REST
  | "web-app"       // Next.js, React, Vue, Svelte frontend
  | "library"       // pip/npm package, no server
  | "cli"           // CLI tool
  | "ml-pipeline"   // training, inference, notebooks
  | "agent"         // AI agent (LangChain, CrewAI, AutoGen)
  | "monorepo"      // multiple sub-projects
  | "unknown"

export interface ProjectProfile {
  types: ProjectType[]
  languages: string[]
  frameworks: string[]
  hasLLM: boolean
  hasDatabase: boolean
  hasDocker: boolean
  hasTests: boolean
  hasFrontend: boolean
  hasBackend: boolean
}

export interface ScanReport {
  project: string
  score: number
  total: number
  passed: number
  warnings: number
  failures: number
  checks: CheckResult[]
  profile: ProjectProfile
  costEstimate?: {
    models: CostModel[]
    totalLow: number
    totalHigh: number
  }
}
