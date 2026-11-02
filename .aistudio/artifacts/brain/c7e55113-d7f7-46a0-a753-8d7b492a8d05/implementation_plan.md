# JEE CBT Platform Engine Stabilization & Performance Optimization

A comprehensive audit and refinement across the Computer-Based Test (CBT) engine, analytics dashboard, LaTeX math parser, and input validation layer to guarantee zero loss of candidate work, seamless UI responsiveness, and accurate grading.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed with the user in Phase 1 and will guide the execution without feature loss:

- **Confirmed Decision 1 (Uncommitted Active Responses)**: When a candidate submits or when the 3-hour timer reaches zero, any active response typed or chosen on the current question will be automatically committed as `ANSWERED` (or `ANSWERED_AND_MARKED_FOR_REVIEW`) and graded, eliminating the risk of lost marks from forgetting to click "Save & Next".
- **Confirmed Decision 2 (Numerical Input Format)**: Numerical NAT questions will support standard integers, decimals, negative signs, and scientific exponential notation (e.g., `1.5e-3`, `2.4E5`, `3.0 x 10^2`), with an epsilon tolerance checker.
- **Confirmed Decision 3 (Full-Scope Performance Audit)**: Auditing and hardening all major layers—exam engine state machine, Analytics Dashboard chart re-render cycles, question navigation consistency, and KaTeX rendering edge cases.

---

### 1. Overview & Core Concept

- **What It Does**: The platform simulates the authentic National Testing Agency (NTA) Computer-Based Test (CBT) interface for IIT JEE aspirants. It supports single-choice MCQs, numerical response questions (NAT), and subjective long-form answers with self-assessment grading, LaTeX equation rendering, fullscreen compliance tracking, and a rich post-test analytics dashboard.
- **Target Audience / Persona**: Competitive examination students and educators who demand a glitch-free, high-fidelity exam simulation where every keystroke and timed submission is accurately recorded, evaluated, and analyzed.
- **Key Value**: Rock-solid exam reliability with automatic submission auto-commit, responsive subject navigation, lag-free analytics comparisons across multiple mock tests, and resilient LaTeX math formula rendering.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Test Launch*: Select or upload a test, configure marking presets, review candidate declaration, and enter fullscreen exam mode.
  2. *Exam Navigation & Answering*: Navigate between Physics, Chemistry, and Mathematics sections. Type answers with live validation (supporting decimals and scientific notation like `1.5e-3`), mark questions for review, and inspect the responsive question palette.
  3. *Auto-Commit & Submission*: On clicking "Submit Examination" or when the timer reaches 00:00:00, the system automatically commits the candidate's active choice/input, grades all objective questions accurately, saves the session into IndexedDB, and exits fullscreen cleanly.
  4. *Review & Self-Grading*: Inspect question-by-question solutions with color-coded answer comparison and self-score subjective answers against official model solutions.
  5. *Deep Analytics*: Compare performance across attempts, analyze accuracy heatmaps, review time spent per question, and inspect radar skills breakdowns without UI stutter.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian, high-contrast, institutional examination cockpit reflecting authentic NTA CBT standards (slate headers, high-contrast radio controls, exact JEE status shape badges: Hexagon, Arrow, Circle, Dot).
  - *Color Palette*:
    - Background: `#f8fafc` (slate-50) canvas; dark slate `#1e293b` persistent exam top bar.
    - Status Badges: `#e03b24` (Not Answered), `#2baf2b` (Answered), `#7c3aed` (Marked for Review), `#94a3b8` (Not Visited).
    - Accents: `#1e3a8a` (Deep Blue primary), `#0284c7` (Section tabs active), `#10b981` (Submit & Score success).
  - *Typography*: Clean system sans-serif hierarchy for interface chrome paired with KaTeX serif for formulas and monospace for numerical answers and timers.
  - *Layout & Spatial Rhythm*: Split workspace with responsive question viewport and collapsible palette sidebar, supporting desktop and mobile touch gestures with swipe navigation.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Auto-Commit Active Question on Submission vs. Strict Manual Save Requirement**
  - *Chosen Approach*: Auto-commit any non-empty answer on the active question to `ANSWERED` immediately prior to grading and submission.
  - *Why*: In actual competitive exams under intense time pressure, candidates often select an answer in the final seconds before time expires. Discarding their work because the "Save & Next" button wasn't clicked leads to unfair score penalties and user frustration.
  - *Alternative Considered*: Showing an alert warning or discarding the answer. Rejected because timeout prevents user interaction, and modal interruptions during final seconds disrupt candidate concentration.
- **Decision 2: Scientific Notation in Numerical Input Field**
  - *Chosen Approach*: Allow regex pattern `[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?` and evaluate candidate numerical values against question target using `|candidate - target| <= (tolerance + 1e-9)`.
  - *Why*: Physics and Chemistry questions routinely have answers like $1.6 \times 10^{-19}$ or $3.0 \times 10^{8}$; students entering `1.6e-19` or `1.6E-19` should have their answers accurately parsed and credited.
- **Decision 3: Optimized State Management & Memoization in Analytics Dashboard**
  - *Chosen Approach*: Decouple `selectedAttemptId` effect from `comparedAttemptIds` state updates to break re-render cascades, and memoize all aggregated chart data.
  - *Why*: Prevents re-render lag when toggling between attempts in the analytics view.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App.tsx (Main Hub)                            │
│  - Active Tab State ('arena' | 'analytics')                            │
│  - Test Collection & Attempts Collection (IndexedDB)                   │
│  - Test Seed & Migration Management                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌────────────────────────────────┐                    ┌────────────────────────────────┐
│      CbtExamEngine.tsx         │                    │    AnalyticsDashboard.tsx      │
│  - Active Question State       │                    │  - Attempt Comparison State    │
│  - Timer & Heartbeat (1s tick) │                    │  - Question & Topic Heatmaps   │
│  - State Machine Transition    │                    │  - Subject Radar & Bar Charts  │
│  - Input Filter (Sci-Notation) │                    │  - Memoized Metric Slices      │
│  - Auto-Commit Submission Hook │                    │  - Single/Multi Attempt Toggle │
└──────────────┬─────────────────┘                    └────────────────────────────────┘
               │
               ▼
┌────────────────────────────────┐
│      LatexRenderer.tsx         │
│  - KaTeX Safe Rendering Engine │
│  - Bracket Balance Sanitizer   │
│  - Inline & Block Math Parser  │
└────────────────────────────────┘
```

#### Component & State Mapping

1. **`src/components/CbtExamEngine.tsx`**:
   - `handleAnswerChange`: Update input filter to accept negative signs, decimals, and scientific exponential notation (`e`/`E`).
   - `executeSubmission`: Before calling `gradeAttempt`, commit the current question's pending answer if it is non-empty (updating its state from `NOT_ANSWERED` to `ANSWERED` or preserving `ANSWERED_AND_MARKED_FOR_REVIEW`).
   - Numerical grading logic: Parse scientific notation with `Number()` / `parseFloat()`, verifying equality within `tolerance + 1e-7`.
   - Section and Subject switching: Ensure switching subject updates both `activeSubject` and selects the first question of that subject without leaving orphaned state.
2. **`src/components/AnalyticsDashboard.tsx`**:
   - Fix `useEffect` on `[attempts, selectedAttemptId]` to prevent cyclical `setComparedAttemptIds` triggers.
   - Memoize chart data sets (`scoreComparisonData`, `subjectBreakdownData`, `heatmapData`) with strict primitive dependencies.
3. **`src/components/LatexRenderer.tsx`**:
   - Enhance KaTeX error handling and math delimiter extraction to prevent parse crashes when unescaped characters occur.
4. **`src/parser.ts`**:
   - Ensure clean handling of nested braces in `quizquestion` blocks and support scientific notation in `\correctvalue` tags.
