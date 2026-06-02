# TODO

- [ ] Replace `app/api/feedback/route.ts` with a thin alias (or 410) so there is no duplicate AI evaluation logic.
- [ ] Ensure `app/api/feedback` forwards to `/api/agent` using the same request payload format.
- [ ] Verify `.env.local`-driven env vars are required and missing env vars return clear 500 errors.
- [ ] Run lint/build and basic integration checks.
- [ ] Test end-to-end flow with the front-end running:
  - [ ] Load problem via `GET /api/problems?topic=...&difficulty=...`
  - [ ] Submit answer via `POST /api/agent` with `command=submit_answer`
  - [ ] Coach buttons via `POST /api/agent` with `command=review_progress` / `recommend_problem`
- [ ] Run `npm test:integration`.

