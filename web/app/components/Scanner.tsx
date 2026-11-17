"use client"

import { useState, useCallback } from "react"
import { ScanReport, CheckResult, Severity } from "@/app/types"

// ── Icons ─────────────────────────────────────────────────────────────────────

function PassIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <circle cx="7" cy="7" r="6.5" stroke="#22c55e" strokeWidth="1.2" />
      <path d="M4 7l2 2 4-4" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M7 1.5L13 12.5H1L7 1.5z" stroke="#eab308" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 5.5v3M7 10.5v.5" stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function FailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <circle cx="7" cy="7" r="6.5" stroke="#ef4444" strokeWidth="1.2" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "pass") return <PassIcon />
  if (severity === "warn") return <WarnIcon />
  return <FailIcon />
}

// ── Category grouping ─────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["Security", "LLM Config", "API Health", "Infrastructure", "Cost", "Reliability"]

function groupByCategory(checks: CheckResult[]): Record<string, CheckResult[]> {
  const groups: Record<string, CheckResult[]> = {}
  for (const check of checks) {
    if (!groups[check.category]) groups[check.category] = []
    groups[check.category].push(check)
  }
  return groups
}

function categoryScore(checks: CheckResult[]): { passed: number; total: number } {
  return { passed: checks.filter((c) => c.severity === "pass").length, total: checks.length }
}

function categoryBadgeColor(checks: CheckResult[]): string {
  const fails = checks.filter((c) => c.severity === "fail").length
  const warns = checks.filter((c) => c.severity === "warn").length
  if (fails > 0) return "#ef4444"
  if (warns > 0) return "#eab308"
  return "#22c55e"
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 96
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score > 80 ? "#22c55e" : score > 60 ? "#eab308" : "#ef4444"

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[10px] text-[#555555] mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="mt-8 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-6">
      <div className="flex items-center gap-3 mb-6">
        {/* Spinner */}
        <svg
          className="animate-spin"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="9" cy="9" r="7" stroke="#1e3a5f" strokeWidth="2" />
          <path d="M9 2a7 7 0 017 7" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-[#888888]" style={{ fontFamily: "var(--font-mono)" }}>
          Scanning repository…
        </span>
      </div>
      <div className="space-y-3">
        {[80, 60, 70, 50, 65, 55].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#1a1a1a] animate-pulse" />
            <div
              className="h-3 rounded-md bg-[#1a1a1a] animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Error display ─────────────────────────────────────────────────────────────

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="mt-8 rounded-xl border border-[#2a1515] bg-[#110a0a] p-5">
      <div className="flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
          <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.2" />
          <path d="M8 5v4M8 11v.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-sm font-medium text-[#ef4444] mb-1">Scan failed</p>
          <p className="text-sm text-[#888888]">{message}</p>
        </div>
      </div>
    </div>
  )
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ report, onReset }: { report: ScanReport; onReset: () => void }) {
  const groups = groupByCategory(report.checks)

  return (
    <div className="mt-8 space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ScoreRing score={report.score} />
            <span className="text-xs text-[#555555]">score</span>
          </div>

          {/* Summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3
                  className="text-sm font-semibold text-[#e5e5e5] mb-0.5"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {report.project}
                </h3>
                <p className="text-xs text-[#555555]">
                  {report.total} checks run
                </p>
              </div>
              <button
                onClick={onReset}
                className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-[#2a2a2a] text-[#666666] hover:border-[#444444] hover:text-[#aaaaaa] transition-all duration-200"
              >
                Scan another
              </button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                <span className="text-xs text-[#888888]">{report.passed} passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                <span className="text-xs text-[#888888]">{report.warnings} warnings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span className="text-xs text-[#888888]">{report.failures} failures</span>
              </div>
            </div>

            {/* Detected project profile */}
            {report.profile && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.profile.types.filter(t => t !== "unknown").map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a2e] text-[#818cf8] border border-[#2a2a4e]">{t}</span>
                ))}
                {report.profile.frameworks.map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a1a1a] text-[#38BDAE] border border-[#1a3a3a]">{f}</span>
                ))}
                {report.profile.languages.map((l) => (
                  <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a]">{l}</span>
                ))}
                {report.profile.hasDatabase && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a150a] text-[#eab308] border border-[#3a2a0a]">database</span>}
                {report.profile.hasDocker && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a1520] text-[#3b82f6] border border-[#1a2540]">docker</span>}
              </div>
            )}
          </div>
        </div>

        {/* Cost estimate, if any */}
        {report.costEstimate && report.costEstimate.models.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
            <p className="text-xs text-[#555555] uppercase tracking-widest mb-2">
              Estimated LLM cost / month
            </p>
            <div className="flex flex-wrap gap-3">
              {report.costEstimate.models.map((m) => (
                <div key={m.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#222222] bg-[#111111]">
                  <span className="text-xs text-[#e5e5e5]" style={{ fontFamily: "var(--font-mono)" }}>{m.name}</span>
                  <span className="text-xs text-[#555555]">·</span>
                  <span className="text-xs text-[#888888]">${m.monthlyLow}–${m.monthlyHigh}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: m.tier === "high" ? "#2a1515" : m.tier === "medium" ? "#1a1a0a" : "#0a1a0a",
                      color: m.tier === "high" ? "#ef4444" : m.tier === "medium" ? "#eab308" : "#22c55e",
                    }}
                  >
                    {m.tier}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#555555] mt-2">
              Total estimate: <span className="text-[#888888]">${report.costEstimate.totalLow}–${report.costEstimate.totalHigh}/mo</span> (rough, based on model usage patterns)
            </p>
          </div>
        )}
      </div>

      {/* Category cards */}
      {CATEGORY_ORDER.filter((cat) => groups[cat]).map((category) => {
        const catChecks = groups[category]
        const { passed, total } = categoryScore(catChecks)
        const badgeColor = categoryBadgeColor(catChecks)

        return (
          <div key={category} className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] bg-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: badgeColor }} />
                <span className="text-sm font-medium text-[#e5e5e5]">{category}</span>
              </div>
              <span className="text-xs text-[#555555]" style={{ fontFamily: "var(--font-mono)" }}>
                {passed}/{total}
              </span>
            </div>

            {/* Checks list */}
            <div className="divide-y divide-[#161616]">
              {catChecks.map((check, idx) => (
                <div key={idx} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <SeverityIcon severity={check.severity} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-[#cccccc] font-medium">{check.name}</span>
                        {check.file && (
                          <span
                            className="text-[10px] text-[#444444] truncate max-w-[200px]"
                            style={{ fontFamily: "var(--font-mono)" }}
                            title={check.file}
                          >
                            {check.file.split("/").slice(-2).join("/")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666666] mt-0.5">{check.message}</p>
                      {check.suggestion && check.severity !== "pass" && (
                        <p className="text-xs text-[#3b82f6] mt-1">
                          <span className="text-[#2a4a7f]">→ </span>{check.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Scanner component ────────────────────────────────────────────────────

export default function Scanner() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ScanReport | null>(null)

  const handleScan = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "An unexpected error occurred. Please try again.")
        return
      }

      setReport(data)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [url])

  const handleReset = useCallback(() => {
    setUrl("")
    setReport(null)
    setError(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !loading) handleScan()
    },
    [handleScan, loading]
  )

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input row */}
      {!report && (
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            className="flex-1 rounded-lg border border-[#222222] bg-[#111111] px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#444444] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 disabled:opacity-50 transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <button
            onClick={handleScan}
            disabled={loading || !url.trim()}
            className="px-5 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20 shrink-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Scanning
              </span>
            ) : "Scan"}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && <LoadingState />}

      {/* Error */}
      {error && !loading && <ErrorDisplay message={error} />}

      {/* Results */}
      {report && !loading && <ResultsPanel report={report} onReset={handleReset} />}
    </div>
  )
}
