# Grade Planner

A website for students to work out where their grade stands, what they need
for a target grade, and what they can afford to skip.

See [PLAN.md](PLAN.md) for the full plan and what is still to build.

## What works today

- **Current grade** from graded work, with weighted categories or total points
- **Lowest and highest possible final grade** given what is left
- **Drop rules** ("drop lowest N") per category, applied to whichever scores help most
- **Target grade**: the score needed on the remaining work for an A, A-, B+ …
- **What-if scores**: type a hypothetical score and see the grade and what the rest then needs
- **What can I skip?**: which remaining assignments can be skipped while still hitting the target
- **Import from a syllabus or gradebook** (PDF or screenshot), read by AI and reviewed before adding
- Classes are saved in the browser, no account needed

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

The syllabus import needs a Claude API key. Copy `.env.example` to `.env.local`
and fill in `ANTHROPIC_API_KEY`. Everything else works without it.

## Tests

```bash
npm test
```

The grade math lives in `src/lib/grades.ts` and is covered by `src/lib/grades.test.ts`.

## Layout

- `src/lib/grades.ts`: all grade calculations (no UI)
- `src/lib/store.ts`: saving classes in the browser
- `src/components/`: the screens
- `src/app/api/import/route.ts`: the AI import endpoint
