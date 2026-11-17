export default function Home() {
  return (
    <main className="flex flex-col min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span
            className="font-mono text-sm font-semibold tracking-tight text-[#e5e5e5]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            deploykit
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-[#888888] hover:text-[#e5e5e5] transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-[#888888] hover:text-[#e5e5e5] transition-colors"
            >
              How it works
            </a>
            <a
              href="https://github.com/Mansi2221/deploykit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-1.5 rounded-md border border-[#333333] text-[#e5e5e5] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-all duration-200"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 relative overflow-hidden">
        {/* Subtle radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(59,130,246,0.08) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#222222] bg-[#111111] text-xs text-[#888888]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block" />
            Open source · MIT licensed · pip-installable
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
            <span
              className="font-mono gradient-text"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              deploykit
            </span>
          </h1>

          <p className="text-xl sm:text-2xl font-medium text-[#e5e5e5] leading-snug">
            Know if your AI app is ready for production.
          </p>

          <p className="text-base text-[#888888] max-w-md">
            One command. Six categories. A clear verdict.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <a
              href="https://github.com/Mansi2221/deploykit"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-md bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] transition-colors duration-200 shadow-lg shadow-blue-500/20"
            >
              Get Started
            </a>
            <a
              href="https://github.com/Mansi2221/deploykit"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-md border border-[#333333] text-[#e5e5e5] text-sm font-medium hover:border-[#444444] hover:bg-[#111111] transition-all duration-200"
            >
              View on GitHub
            </a>
          </div>

          {/* Terminal install block */}
          <div
            className="mt-8 w-full max-w-xl rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden terminal-scroll"
            style={{
              boxShadow:
                "0 0 0 1px #1a1a1a, 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a] bg-[#111111]">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span
                className="ml-auto text-xs text-[#444444]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                terminal
              </span>
            </div>
            <div className="p-5 text-left">
              <p
                className="text-sm"
                style={{ fontFamily: "var(--font-mono)", lineHeight: "2" }}
              >
                <span className="text-[#3b82f6]">$</span>{" "}
                <span className="text-[#e5e5e5]">pip install deploykit</span>
                <br />
                <span className="text-[#3b82f6]">$</span>{" "}
                <span className="text-[#e5e5e5]">
                  deploykit scan ./my-project
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[#1a1a1a] py-4">
        <div className="max-w-6xl mx-auto px-6">
          <p
            className="text-center text-xs text-[#555555] tracking-widest uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            6 check categories &nbsp;&middot;&nbsp; 30+ individual checks
            &nbsp;&middot;&nbsp; 52 tests &nbsp;&middot;&nbsp; MIT licensed
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold tracking-tight mb-3">
              Everything that matters before deploy
            </h2>
            <p className="text-[#888888] text-base max-w-lg mx-auto">
              deploykit runs 30+ checks across six critical categories and gives
              you a prioritized list of what to fix.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Security */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 1L2 3.5V8c0 3.3 2.5 5.7 6 7 3.5-1.3 6-3.7 6-7V3.5L8 1z"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                Security
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Detects hardcoded API keys, exposed secrets, and debug mode
                enabled in production environments.
              </p>
            </div>

            {/* LLM Config */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="1"
                    y="4"
                    width="14"
                    height="8"
                    rx="2"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M4 8h2M7 8h5"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="2" r="1" fill="#3b82f6" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                LLM Configuration
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Flags missing timeouts, absent retry logic, hardcoded model
                names, and lack of streaming configuration.
              </p>
            </div>

            {/* API Health */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8h3l2-5 2 10 2-5 1 3h2"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                API Health
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Checks for health endpoints, CORS configuration, rate limiting
                middleware, and proper error handlers.
              </p>
            </div>

            {/* Infrastructure */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="1"
                    y="1"
                    width="14"
                    height="4"
                    rx="1"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <rect
                    x="1"
                    y="7"
                    width="14"
                    height="4"
                    rx="1"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <circle cx="12.5" cy="3" r="0.8" fill="#3b82f6" />
                  <circle cx="12.5" cy="9" r="0.8" fill="#3b82f6" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                Infrastructure
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Validates Dockerfile presence, CI/CD pipeline setup, dependency
                management hygiene, and .gitignore coverage.
              </p>
            </div>

            {/* Cost Estimation */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.5"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M8 4v1.5M8 10.5V12M6 7.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5-1 1.5-2 1.5-2 .7-2 1.5.9 1.5 2 1.5 2-.7 2-1.5"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                Cost Estimation
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Identifies LLM models in use, estimates monthly API cost, and
                flags patterns that lead to unexpectedly high spend.
              </p>
            </div>

            {/* Reliability */}
            <div className="feature-card p-6 rounded-xl border border-[#222222] bg-[#111111]">
              <div className="mb-4 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 2a6 6 0 100 12A6 6 0 008 2z"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M8 5v3l2 2"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-2 text-[#e5e5e5]">
                Reliability
              </h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Checks logging setup, structured log output, monitoring
                integration, and graceful shutdown handling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live output section */}
      <section className="py-20 px-6 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.04) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-semibold tracking-tight mb-3">
              See it in action
            </h2>
            <p className="text-[#888888] text-base">
              A clear, scannable report with pass/warn/fail per category.
            </p>
          </div>

          {/* Terminal output */}
          <div
            className="terminal-glow rounded-xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 0 1px #1e3a5f30, 0 0 60px rgba(59,130,246,0.06), 0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a] bg-[#111111]">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span
                className="ml-auto text-xs text-[#444444]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                deploykit scan ./my-ai-app
              </span>
            </div>

            {/* Terminal content */}
            <div
              className="p-6 overflow-x-auto terminal-scroll"
              style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
            >
              {/* Box */}
              <div className="text-[#3b82f6] mb-4 whitespace-pre">
                {"╭──────────────────────────────────────────────────────╮\n"}
                {"│  deploykit Production Readiness Report               │\n"}
                {"│  Project: my-ai-app                                  │\n"}
                {"│  Score:   74/100                                     │\n"}
                {"╰──────────────────────────────────────────────────────╯"}
              </div>

              {/* Results */}
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">
                    Security
                  </span>
                  <span>
                    <span className="text-[#22c55e]">✓ ✓ ✓ ✓</span>
                    {"           "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    4/4 passed
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">
                    LLM Config
                  </span>
                  <span>
                    <span className="text-[#22c55e]">✓ ✓ </span>
                    <span className="text-[#eab308]">⚠ ⚠ ⚠</span>
                    {"        "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    2/5 passed
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">
                    API Health
                  </span>
                  <span>
                    <span className="text-[#22c55e]">✓ ✓ </span>
                    <span className="text-[#ef4444]">✗</span>
                    {"             "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    2/3 passed
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">Infra</span>
                  <span>
                    <span className="text-[#22c55e]">✓ ✓ ✓ ✓ </span>
                    <span className="text-[#eab308]">⚠</span>
                    {"        "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    4/5 passed
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">Cost</span>
                  <span>
                    <span className="text-[#22c55e]">✓ </span>
                    <span className="text-[#eab308]">⚠ ⚠</span>
                    {"            "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    1/3 passed
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#888888] w-20 shrink-0">
                    Reliability
                  </span>
                  <span>
                    <span className="text-[#22c55e]">✓ ✓ ✓ </span>
                    <span className="text-[#eab308]">⚠</span>
                    {"         "}
                  </span>
                  <span className="text-[#888888] text-xs ml-auto">
                    3/4 passed
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#1a1a1a] mb-5" />

              {/* Recommendations */}
              <div>
                <p className="text-[#888888] mb-3 text-xs uppercase tracking-widest">
                  Top Recommendations
                </p>
                <div className="space-y-2">
                  <p>
                    <span className="text-[#3b82f6]">→</span>{" "}
                    <span className="text-[#cccccc]">
                      Add timeout to LLM client initialization
                    </span>
                  </p>
                  <p>
                    <span className="text-[#3b82f6]">→</span>{" "}
                    <span className="text-[#cccccc]">
                      Configure rate limiting middleware
                    </span>
                  </p>
                  <p>
                    <span className="text-[#3b82f6]">→</span>{" "}
                    <span className="text-[#cccccc]">
                      Set up a fallback model for resilience
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold tracking-tight mb-3">
              How it works
            </h2>
            <p className="text-[#888888] text-base">
              Three steps from install to confident deploy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden sm:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#333333] to-transparent" />

            {/* Step 1 */}
            <div className="flex flex-col items-center text-center group">
              <div className="mb-5 relative">
                <div className="w-16 h-16 rounded-full border border-[#222222] bg-[#111111] flex items-center justify-center group-hover:border-[#3b82f6] transition-colors duration-300">
                  <span className="text-lg text-[#3b82f6] font-mono font-semibold">
                    01
                  </span>
                </div>
              </div>
              <h3 className="text-base font-semibold mb-2">Install</h3>
              <div
                className="text-xs bg-[#111111] border border-[#222222] rounded-md px-3 py-2 text-[#3b82f6] mb-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                pip install deploykit
              </div>
              <p className="text-sm text-[#666666]">
                Available on PyPI. No configuration required to get started.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center group">
              <div className="mb-5 relative">
                <div className="w-16 h-16 rounded-full border border-[#222222] bg-[#111111] flex items-center justify-center group-hover:border-[#3b82f6] transition-colors duration-300">
                  <span className="text-lg text-[#3b82f6] font-mono font-semibold">
                    02
                  </span>
                </div>
              </div>
              <h3 className="text-base font-semibold mb-2">Scan</h3>
              <div
                className="text-xs bg-[#111111] border border-[#222222] rounded-md px-3 py-2 text-[#3b82f6] mb-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                deploykit scan ./your-project
              </div>
              <p className="text-sm text-[#666666]">
                Runs 30+ checks across your codebase in seconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center group">
              <div className="mb-5 relative">
                <div className="w-16 h-16 rounded-full border border-[#222222] bg-[#111111] flex items-center justify-center group-hover:border-[#3b82f6] transition-colors duration-300">
                  <span className="text-lg text-[#3b82f6] font-mono font-semibold">
                    03
                  </span>
                </div>
              </div>
              <h3 className="text-base font-semibold mb-2">Ship</h3>
              <div
                className="text-xs bg-[#111111] border border-[#222222] rounded-md px-3 py-2 text-[#888888] mb-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                fix → re-scan → deploy
              </div>
              <p className="text-sm text-[#666666]">
                Fix the flagged issues, re-scan to verify, deploy with
                confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Start scanning in 30 seconds
          </h2>
          <p className="text-[#888888] text-base mb-8">
            Free, open source, runs locally. No account required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://github.com/Mansi2221/deploykit"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-md bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] transition-colors duration-200 shadow-lg shadow-blue-500/20"
            >
              View on GitHub
            </a>
            <div
              className="px-6 py-3 rounded-md border border-[#222222] bg-[#111111] text-[#888888] text-sm"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              pip install deploykit
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-mono text-[#444444]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              deploykit
            </span>
            <span className="text-[#333333] text-sm">&middot;</span>
            <span className="text-sm text-[#444444]">
              Built by{" "}
              <a
                href="https://github.com/Mansi2221"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#666666] hover:text-[#e5e5e5] transition-colors"
              >
                Mansi Patil
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Mansi2221/deploykit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#444444] hover:text-[#888888] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/Mansi2221/deploykit/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#444444] hover:text-[#888888] transition-colors"
            >
              MIT License
            </a>
            <span className="text-xs text-[#333333]">
              &copy; 2025
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
