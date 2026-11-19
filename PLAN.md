# Grade Planner — Project Plan

A website where students work out what grade they will get in a class, given
their scores so far, what is left in the course, and how many drops the class
allows.

## Core features

### 1. Grade range (min / max)
- From completed scores plus remaining work, show the **lowest possible** final
  grade (0 on everything left) and the **highest possible** (100 on everything
  left), with drops applied optimally in each case.
- Show the current grade (completed work only) alongside the range.

### 2. Drops
- Each category (homework, quizzes, exams, ...) can have its own rule:
  "drop lowest N", "final replaces lowest midterm", etc.
- Drops are always applied to whichever items help the student most.

### 3. "What can I skip?"
- Given a target grade and the drops available, list exactly which remaining
  assignments the student can skip (score 0) and still hit the target.
- Show the trade-off: skipping X means needing Y% on everything else.

### 4. Target grade
- Student picks a target letter (A, A-, B+, ...).
- Show what they need on remaining work: the average needed across everything
  left, and the score needed on each individual item (e.g. "92% on the final").
- Clearly say when a target is already locked in or no longer reachable.

### 5. What-if estimator
- Student plugs in hypothetical scores for uncompleted assignments and sees the
  resulting grade update live.

### 6. Class search by college
- Student picks their college, then searches for a class to load its grading
  setup (categories, weights, drop rules, letter-grade cutoffs).
- Needs an online database. See "Class data" below.

### 7. Upload a syllabus or gradebook (AI import)
- Student uploads a PDF or screenshot (syllabus, Canvas/Blackboard gradebook).
- AI reads it and fills in categories, weights, drop policy, grade cutoffs, and
  any scores it can see.
- Student always reviews and edits the result before it is used.

## Class data (how the search gets its data)

There is no universal public source of syllabus grading policies, so the
database fills up in layers:

1. **Course catalog**: college list plus course codes/titles, seeded from public
   catalog data per college, so search returns something from day one.
2. **Crowdsourced grading setups**: when a student enters or uploads a class's
   grading scheme, they can share it. The next student searching that class
   (same college, course, professor, term) gets it pre-filled.
3. **Manual entry**: always available as a fallback.

Grading setups vary by professor and term, so each one is stored per
college + course + instructor + term rather than per course.

## Grade engine (the hard part)

One calculation module, kept separate from the UI and fully unit tested:

- Weighted categories and points-based courses
- Drop-lowest-N per category, and replacement rules
- Extra credit and items with different point values
- Custom letter-grade cutoffs per class (93 for an A vs. 90, with/without +/-)
- Min/max range, required-score solver, and skip finder all built on the same
  core function, so every feature gives consistent answers

## Suggested tech stack

- **Frontend**: Next.js (React) + TypeScript, Tailwind CSS
- **Grade engine**: plain TypeScript module, runs in the browser for instant updates
- **Database + accounts**: Supabase (Postgres, auth, full-text search for classes)
- **AI import**: Claude API (reads PDFs and images directly), called from a
  server route so the API key stays private; returns structured JSON
- **Hosting**: Vercel

## Status

- Done: steps 1 and 2 (grade engine with tests, calculator UI saved in the browser).
- Done but untested against the real AI: step 3 (upload endpoint and review screen). Needs an API key to try.
- Done in a first version: step 5. Students pick any college (public list of about 10,000, or type
  their own), search its classes, and set a class up by hand when it is not found. A setup can be
  shared so classmates find it in search. UIUC also has its official course list. Shared setups
  use Supabase when configured, can be reported (three reports hide one), and are rate limited.
  Still missing: course lists for more colleges.
- Ready to deploy: see DEPLOY.md. Needs a Supabase and a Vercel account.
- Not started: step 4 (accounts) and the multi-class dashboard in step 6.

## Build order

1. **Grade engine + tests**: all the math, no UI
2. **Calculator UI**: manual entry of categories, assignments, drops; min/max,
   target grade, what-if, skip finder. Saved in the browser, no account needed.
3. **AI upload**: PDF/screenshot to pre-filled class, with a review step
4. **Accounts + saved classes**: sync across devices
5. **College/class search**: catalog seed plus shared grading setups
6. **Polish**: mobile layout, multi-class dashboard, GPA view across classes

Steps 1–2 give a usable product on their own; each later step adds to it.

## Open decisions

- **Which colleges first?** Recommend launching with one or two and seeding
  those catalogs well, rather than every college thinly.
- **Accounts required?** Recommend no: usable without sign-in, account only
  needed to sync or share.
- **AI cost**: each upload costs a small amount per call; needs a per-user
  limit on free use.
- **Shared data quality**: crowdsourced setups need a way to flag or correct
  wrong entries (e.g. show "verified by N students").
- **Privacy**: uploaded gradebooks contain student names and scores. Extract
  what is needed and do not keep the original file.
