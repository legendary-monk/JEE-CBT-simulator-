```text
 /\_/\
( o.o )  <  JEE CBT Simulator
 > ^ <      practice paws-itively better
 /   \
(_____)   Bring your .tex papers. I brought the focus.
```

<div align="center">

# JEE CBT Simulator

A polished, browser-based Computer-Based Test practice portal for JEE aspirants. Import LaTeX question papers, run a realistic 3-hour CBT session, review attempts, and track performance analytics entirely on your local machine.

![Richard Feynman](https://physicsworld.com/wp-content/uploads/2018/04/65-12-163-FEYNMAN.jpg)

> “What I cannot create, I do not understand.”  
> — Richard P. Feynman, reportedly written on his blackboard at the time of his death. [Source](https://en.wikiquote.org/wiki/Richard_Feynman)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Using the Simulator](#using-the-simulator)
- [LaTeX Question Format](#latex-question-format)
- [Data Storage, Backup, and Restore](#data-storage-backup-and-restore)
- [Project Structure](#project-structure)
- [Quality Checks](#quality-checks)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

JEE CBT Simulator is a frontend-only exam environment designed to help students rehearse the flow of a real computer-based test. It supports custom `.tex` papers, JEE-style marking presets, MathJax-like LaTeX rendering through KaTeX, attempt persistence, post-exam review, and analytics dashboards.

Because the app stores papers and attempts in the browser with IndexedDB, it is suitable for private practice, coaching demos, and offline-first local workflows after dependencies are installed.

## Key Features

### Exam Creation

- Upload, drag-and-drop, or paste custom `.tex` question files.
- Load an included sample JEE mock test to explore the workflow quickly.
- Reuse previously saved papers from local storage.
- Configure candidate name and test name before every attempt.

### JEE-Style CBT Experience

- 3-hour exam timer.
- Subject-wise navigation across Physics, Chemistry, and Mathematics, or any custom subjects defined in the paper.
- Question state tracking for not visited, not answered, answered, marked for review, and answered plus marked for review.
- Fullscreen awareness and tab-switch tracking to encourage disciplined test-taking.
- Multi-tab protection to reduce accidental attempt corruption.

### Flexible Marking

- Presets for JEE Main, JEE Advanced, and no-negative-marking practice.
- Custom positive and negative marks for MCQ, numerical, and subjective questions.
- Optional no-negative numerical-answer behavior.
- Automatic objective grading with tolerance support for numerical answers.
- Self-assessment workflow for subjective answers.

### Review and Analytics

- Detailed attempt review after submission.
- Per-question response, correctness, marks earned, and time spent tracking.
- Historical attempt dashboard powered by Recharts.
- Local backup and restore for tests and attempt history.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript |
| Build tooling | Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Math rendering | KaTeX |
| Charts | Recharts |
| Browser storage | IndexedDB via `idb` |

## Getting Started

### Prerequisites

- Node.js 20 or newer is recommended.
- npm, which is bundled with Node.js.

### Installation

```bash
git clone <repository-url>
cd JEE-CBT-simulator-
npm install
```

### Environment Variables

Copy the example environment file if you need local environment configuration:

```bash
cp .env.example .env.local
```

The current simulator experience is client-side. If your local version uses optional AI Studio or Gemini functionality, place your key in `.env.local` as documented by `.env.example`.

### Run Locally

```bash
npm run dev
```

Open the local URL printed by Vite. The default development server is configured for port `3000`.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on `0.0.0.0:3000`. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run TypeScript validation with `tsc --noEmit`. |
| `npm run clean` | Remove generated `dist` and `server.js` artifacts. |

## Using the Simulator

1. Start the application with `npm run dev`.
2. Enter a candidate name and a test name.
3. Choose a marking preset or customize the scoring values.
4. Add a paper by uploading a `.tex` file, pasting LaTeX content, selecting an existing saved paper, or loading the sample.
5. Start the exam and read the instruction screen.
6. Attempt questions using the subject tabs and question palette.
7. Submit the exam when finished.
8. Review objective scores and self-assess subjective responses.
9. Visit the analytics dashboard to compare attempts over time.

## LaTeX Question Format

Each question must be wrapped in a `quizquestion` environment with a unique question ID:

```tex
\begin{quizquestion}{Q1}
  \subject{Physics}
  \topic{Electrostatics}
  \answertype{mcq}
  \marks{4}
  \difficulty{medium}

  The question body can contain normal LaTeX, inline math like $E = mc^2$, and display math.

  \option{First option}
  \option{Second option}
  \option{Third option}
  \option{Fourth option}

  \correctoption{Second option}
\end{quizquestion}
```

### Supported Tags

| Tag | Required? | Notes |
| --- | --- | --- |
| `\subject{...}` | Recommended | Used for subject tabs and grouping. |
| `\topic{...}` | Recommended | Displayed in review and analytics contexts. |
| `\answertype{mcq\|numerical\|subjective}` | Required | Determines answer UI and grading behavior. |
| `\marks{...}` | Optional | Stores nominal question marks. Marking scheme controls scoring. |
| `\difficulty{easy\|medium\|hard}` | Optional | Useful for paper metadata. |
| `\option{...}` | Required for MCQ | Add one tag per option. |
| `\correctoption{...}` | Required for MCQ grading | Must match one option exactly. |
| `\correctvalue{...}` | Required for numerical grading | Numeric answer key. |
| `\tolerance{...}` | Optional for numerical | Accepts answers within the tolerance range. Defaults to exact matching when omitted. |
| `\modelanswer{...}` | Recommended for subjective | Displayed during review and self-assessment. |

### Numerical Example

```tex
\begin{quizquestion}{Q2}
  \subject{Mathematics}
  \topic{Matrices and Determinants}
  \answertype{numerical}
  \marks{4}

  Let $A$ be a $3 \times 3$ matrix where $\det(A)=5$. Find $\det(2A)$.

  \correctvalue{40}
  \tolerance{0}
\end{quizquestion}
```

### Subjective Example

```tex
\begin{quizquestion}{Q3}
  \subject{Chemistry}
  \topic{Thermodynamics}
  \answertype{subjective}
  \marks{4}

  Define Gibbs Free Energy and explain its relation to spontaneity.

  \modelanswer{A complete answer should define $G = H - TS$ and explain the sign of $\Delta G$.}
\end{quizquestion}
```

## Data Storage, Backup, and Restore

The simulator stores data locally in the browser using IndexedDB.

- Saved tests are stored in the `tests` object store.
- Attempts are stored in the `attempts` object store.
- Deleting a test also deletes attempts associated with that test.
- Export creates a JSON backup containing both tests and attempts.
- Import merges valid tests and attempts from a backup into the local database.

> Tip: Export a backup before clearing browser data or moving to another machine.

## Project Structure

```text
.
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src
    ├── App.tsx                    # App shell, routing state, backup/restore actions
    ├── db.ts                      # IndexedDB persistence helpers
    ├── parser.ts                  # Custom LaTeX quiz parser
    ├── types.ts                   # Shared TypeScript domain models
    ├── data
    │   └── sampleTex.ts           # Built-in sample paper
    └── components
        ├── AnalyticsDashboard.tsx # Attempt history and charts
        ├── AttemptReview.tsx      # Submitted-attempt review and self-assessment
        ├── CbtExamEngine.tsx      # Main CBT exam runtime
        ├── LatexRenderer.tsx      # KaTeX rendering wrapper
        └── UploadManager.tsx      # Paper ingestion and marking setup
```

## Quality Checks

Run these checks before opening a pull request:

```bash
npm run lint
npm run build
```

`npm run lint` performs TypeScript validation. `npm run build` verifies the production bundle can be generated successfully.

## Troubleshooting

### The parser says no questions were found

Ensure each question uses `\begin{quizquestion}{ID}` and `\end{quizquestion}` exactly, and that braces are balanced inside the block.

### MCQ answers are marked incorrectly

The value in `\correctoption{...}` should match the intended `\option{...}` text exactly after parsing.

### Numerical answers are too strict

Add a tolerance, for example `\tolerance{0.01}`, when decimal rounding is expected.

### My attempts disappeared

Attempts are stored in the current browser profile. They may be removed if browser data is cleared, if you switch profiles, or if you use a private browsing session. Use the export feature to keep backups.

## Contributing

Contributions are welcome. For a clean workflow:

1. Create a feature branch.
2. Keep changes focused and typed.
3. Run `npm run lint` and `npm run build`.
4. Include screenshots for visible UI changes.
5. Open a pull request with a concise summary and test notes.

## License

This project includes source files with Apache-2.0 SPDX headers. Unless a repository-level license file states otherwise, preserve existing license notices when modifying source files.
