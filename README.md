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
- **Find your class**: pick any college (about 10,000 worldwide, or type one that is missing) and
  search its classes. Results come from setups other students shared, plus the official course list
  where one exists (UIUC so far)
- **Set it up yourself**: when a class is not found, add it and type in the categories, weights,
  drops and assignments. "Add several" creates a run of numbered assignments at once
- **Share a setup**: one click adds a class's grading setup (never scores) to the search for classmates
- **Import from a syllabus or gradebook** (PDF or screenshot), read by AI and reviewed before adding
- Classes are saved in the browser, no account needed

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. That address only works on the computer where `npm run dev` is running.

The syllabus import needs a Claude API key. Copy `.env.example` to `.env.local`
and fill in `ANTHROPIC_API_KEY`. Everything else works without it.

## Tests

```bash
npm test
```

The grade math lives in `src/lib/grades.ts` and is covered by `src/lib/grades.test.ts`.

## Where the data comes from

- **Colleges** (`public/data/colleges.json`): the public
  [world universities list](https://github.com/Hipo/university-domains-list). Rebuild with
  `node scripts/build-colleges.mjs`.
- **Course lists** (`public/data/catalog/<college id>.json`): only UIUC so far, from the public
  [UIUC GPA Dataset](https://github.com/wadefagen/datasets/tree/main/gpa) by Wade Fagen-Ulmschneider
  (course codes and titles only). Rebuild with `node scripts/build-uiuc.mjs`. To add a college's
  course list, write a similar script and add the college id to `CATALOG_COLLEGES` in
  `src/lib/catalog.ts`.
- **Shared class setups**: saved by the server in `.data/shared-classes.json`. This works on your
  own computer or a server with a disk. Hosts like Vercel have no permanent disk, so before
  deploying there, swap the two functions at the top of `src/lib/server/class-store.ts` for a hosted
  database. Sharing is open to anyone (no accounts, no moderation, no rate limit yet).

## Layout

- `src/lib/grades.ts`: all grade calculations (no UI)
- `src/lib/colleges.ts`, `src/lib/catalog.ts`: college and class search
- `src/lib/shared.ts`, `src/lib/server/class-store.ts`, `src/app/api/classes/`: shared class setups
- `src/lib/store.ts`: saving classes in the browser
- `src/components/`: the screens
- `src/app/api/import/route.ts`: the AI import endpoint
