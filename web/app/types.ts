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

export interface ScanReport {
  project: string
  score: number
  total: number
  passed: number
  warnings: number
  failures: number
  checks: CheckResult[]
  costEstimate?: {
    models: CostModel[]
    totalLow: number
    totalHigh: number
  }
}
