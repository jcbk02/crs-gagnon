# AI Coding Agent Instructions for CRS Calculator

## Project Overview
**CRS Calculator** is a React 19 + TypeScript + Vite application that implements a Canadian Permanent Residency Comprehensive Ranking Score questionnaire. It guides users through an interview-style questionnaire to collect information about their education, language skills, work experience, and other immigration factors, then calculates their CRS score.

- **Stack**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3.4
- **Styling**: Custom Tailwind theme with primary color `#8D161E`, serif fonts (Newsreader for headings, Quicksand for body)
- **Deployment**: GitHub Pages at `/crs-calculator/` sub-path

## Architecture: State Machine + Scene System

The app uses a **multi-scene state machine pattern** in [src/App.tsx](src/App.tsx) with these scenes:
- **`intro`**: Welcome screen
- **`interview`**: Interactive questionnaire driven by `script` array
- **`thinking`**: Loading/processing state
- **`result`**: Final CRS score display

The **interview loop** works through a `scriptIndex` that progresses through a `ScriptStep[]` array. Each step:
- Has `type`: 'statement', 'choice', or 'input'
- Can have conditional `next` or `jump` fields for branching
- Updates `UserProfile` state via field mappings

**Key insight**: The script is the source of truth for flow logic—branching logic is encoded in step definitions, not React routing.

## Critical Data Types

**[src/App.tsx](src/App.tsx#L6-L50)** defines three core interfaces:

```typescript
// User answers from questionnaire
interface UserProfile {
  age, education, canadianEducation, 
  english, french, firstLanguage,           // Language proficiency
  workInCanada, workForeign,                // Work experience (years)
  maritalStatus, spouseAccompanying, ...    // Family factors
  pnp, siblingInCanada, ...                 // Additional factors
}

// Questionnaire step
interface ScriptStep {
  text, type, next, field, options, setter, dummy
}

// Final score breakdown (max ~1700 total)
interface ScoreBreakdown {
  total, coreHumanCapital (max 500), 
  spouseFactors (max 40), transferability (max 100), 
  additional (max 600)
}
```

## Scoring System

**Core Human Capital** (max 500):
- Age: 0–135 points (peak 35–37 years)
- Education: 0–150 points (bachelor+ = 120–150)
- Language proficiency: 0–160 points (CLB 9+ for both languages = max)
- Canadian work: 0–105 points (3+ years = max)

**Transferability** (max 100):
- French language bonus: 0–50 points
- Canadian education: 0–30 points

**Additional Points** (max 600):
- Provincial Nominee Program (PNP): 600 points
- Canadian sibling: 15 points

When spouse is `spouseAccompanying: true`, their education/language contribute to **Spouse Factors** (max 40) instead of core.

## Common Development Patterns

### Conditional Field Rendering
Use the `field` property to map questions to `UserProfile` fields:
```tsx
field: 'age'           // Updates profile.age
field: 'english.speak' // Nested property update
```

### Language Proficiency Mapping
The `mapFluencyToCLB()` helper converts UI-friendly fluency labels ('Extremely', 'Mostly', 'Somewhat', 'Not') to Canadian Language Benchmark (CLB) 0–9 scale.

### Spouse Logic
When `maritalStatus !== 'Single'` and `spouseAccompanying: true`, spouse fields contribute differently to scoring. Always check both flags before applying spouse adjustments.

## Build & Deployment

```bash
npm run start           # Dev server on http://localhost:5173
npm run build:vite     # TypeScript compile + Vite bundle → dist/
npm run test           # Run Vitest suite
npm run deploy         # Deploy dist/ to gh-pages at /crs-calculator/
```

**Note**: `build:vite` runs `tsc -b` first to catch TypeScript errors before bundling.

## Project Conventions

1. **Type-driven development**: All user input data is typed via `UserProfile`, `ScriptStep`, and enums (MaritalStatus, LangFluency)
2. **No external state management**: All state lives in [src/App.tsx](src/App.tsx) component; no Redux/Zustand
3. **Questionnaire-first design**: Logic flows through script array, not React components—new questions are added to the script, not new .tsx files
4. **Styling via Tailwind**: Avoid inline `style={}` props; all styling is Tailwind classes
5. **No custom hooks**: Keep logic in App.tsx for now; extract to hooks only if component grows beyond ~1000 LOC

## ESLint & TypeScript Config

- **Flat config** (eslint.config.js): React Hooks plugin, React Refresh plugin, TypeScript ESLint recommended
- **TypeScript 5.9**: Strict mode recommended; check tsconfig.app.json for any custom settings
- **No strict: false**—enforce proper typing on all new code

## Testing & Validation

- **Vitest** is configured for unit tests; add tests under `src/` with `.test.ts(x)` suffix
- Test scoring logic thoroughly when modifying `calculateScore()` or branching conditions
- Run `npm test` before commits to catch regressions

## Key Files Reference

| File | Purpose |
|------|---------|
| [src/App.tsx](src/App.tsx) | All logic: state, scoring, script, rendering |
| [tailwind.config.js](tailwind.config.js) | Theme colors, fonts, animations |
| [vite.config.ts](vite.config.ts) | Base path `/crs-calculator/`; React plugin |
| [eslint.config.js](eslint.config.js) | Flat config; React Hooks/Refresh rules |

## When Adding Features

1. **New questions**: Add `ScriptStep` objects to the script array; map `field` to `UserProfile`
2. **Scoring changes**: Update the `calculateScore()` function and test with edge cases (spouse scenarios, language combos)
3. **UI/layout changes**: Use Tailwind classes; check tailwind.config.js for custom colors/animations
4. **State changes**: Add fields to `UserProfile` interface; initialize in `initialProfile`; handle in setter logic

---

**Last Updated**: Jan 2026 | **Stack**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind 3.4
