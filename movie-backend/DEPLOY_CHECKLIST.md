# Deploy checklist: rolling out auth hardening + recent updates to prod

Prod is currently running an older version without email verification /
refresh-token auth. This checklist covers what breaks if you just deploy
the new code as-is, and what to do about it.

## 1. Before deploy — environment variables

Confirm these are set in the production environment (not just local `.env`):

- [ ] `JWT_SECRET` — required, backend throws on boot if missing ([auth-jwt-strategy.ts:22-24](src/auth/auth-jwt-strategy.ts#L22-L24))
- [ ] `JWT_REFRESH_SECRET`
- [ ] `JWT_REFRESH_EXPIRES_IN` (defaults to `30d` if unset — fine to omit)
- [ ] `RESEND_API_KEY` — without it, verification/reset emails silently fail to send
- [ ] `FRONTEND_URL` — used to build verification/reset links; must point at the real prod frontend origin
- [ ] `NODE_ENV=production` — controls refresh-cookie `secure`/`sameSite` flags ([auth.controller.ts:47-54](src/auth/auth.controller.ts#L47-L54))
- [ ] `RECAPTCHA_SECRET_KEY` — signup will fail captcha verification without it

## 2. Cross-origin cookie check

If the frontend and backend are on **different domains** in prod:
- Refresh cookie needs `secure: true` + `sameSite: 'none'`, which only happens when `NODE_ENV=production` — verify this is actually set, not assumed.
- Both frontend and backend must be served over HTTPS, or the browser will silently drop the cookie and token refresh will stop working (initial login still works — only silent refresh breaks).

## 3. Deploy the new backend

`synchronize: true` ([app.module.ts:56](src/app.module.ts#L56)) means the new columns
(`isVerified`, `verificationToken`, `verificationTokenExpiresAt`, `resetToken`,
`resetTokenExpiresAt`, `hashedRefreshToken`) get added automatically on boot.
No manual migration needed for the schema change itself.

## 4. Immediately after deploy — grandfather existing users

**This step is not optional.** `isVerified` defaults to `false`, so every
pre-existing account gets locked out of login with "Please verify your
email" until you run this:

```bash
psql "$DATABASE_URL" -f scripts/backfill-verified-users.sql
```

See [scripts/backfill-verified-users.sql](scripts/backfill-verified-users.sql) —
it only touches accounts with no `verificationToken` on file, so genuine
new signups made during the deploy window are left alone.

## 4b. Vector search tables (AI chat / recommendations)

`VectorService` ([src/vector/vector.service.ts](src/vector/vector.service.ts)) talks to
`movie_embeddings` and `user_memory_embeddings` via raw SQL — these are **not**
TypeORM entities, so `synchronize: true` never creates them. If they don't
exist yet on prod, the pgvector extension + tables need to be created once:

```bash
psql "$DATABASE_URL" -f scripts/create-vector-tables.sql
```

Symptom if this is skipped: backend logs fill with
`relation "movie_embeddings" does not exist` / `relation "user_memory_embeddings" does not exist`
on every AI-chat message. The app doesn't crash — it silently falls back to
plain TMDB search and skips long-term user memory — so this can go
unnoticed unless someone checks the logs.

## 5. Verify

- [ ] Log in with an existing (pre-deploy) account — should succeed without a "verify your email" error.
- [ ] Register a brand-new account — should still require email verification (this is the intended behavior going forward).
- [ ] Confirm the refresh cookie is set on login (`Set-Cookie: refresh_token=...; Secure; SameSite=None` in prod) and that a page reload keeps the session alive.
- [ ] Watch backend logs for a few minutes after rollout for repeated "Please verify your email" 401s — that's the signal the backfill didn't run or missed rows.

## Longer-term note (not blocking this deploy)

`synchronize: true` in production is risky long-term — schema changes
happen implicitly on every boot with no version history or rollback.
Worth migrating to TypeORM migrations before the next schema change,
but out of scope for this rollout.
