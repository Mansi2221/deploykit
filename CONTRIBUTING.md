# Contributing to gitpulse

Thanks for your interest in contributing!

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/<your-username>/gitpulse.git`
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`
5. Open http://localhost:3000

## Project Structure

- `app/page.tsx` — main page with search, dashboard, and compare views
- `app/api/pulse/route.ts` — API endpoint that fetches GitHub data
- `app/components/Dashboard.tsx` — single-user analytics dashboard
- `app/components/CompareView.tsx` — side-by-side comparison
- `app/components/RoleAnalysis.tsx` — career fit analysis with role-based scoring
- `app/components/SearchBar.tsx` — search input with compare toggle

## Adding a New Role

Edit `app/components/RoleAnalysis.tsx`:
1. Add the role key to the `RoleKey` type
2. Add it to the `ROLES` array
3. Add suggested profiles in `SUGGESTED_PROFILES`
4. Add a scoring function (e.g. `analyzeNewRole`)
5. Add the case to the switch in `analyzeRole`

## Running Tests

```bash
npm run build  # type-check + build
```
