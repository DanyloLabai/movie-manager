-- Run ONCE against the production database, right after deploying the
-- version that introduces users.isVerified / verificationToken / resetToken /
-- hashedRefreshToken (TypeORM synchronize adds these columns with
-- isVerified defaulting to false for every pre-existing row).
--
-- Without this, every user who registered before this deploy will be
-- unable to log in ("Please verify your email before logging in"),
-- because they were never issued a verification token.
--
-- Safe to run multiple times (idempotent) and safe to run before or
-- after the new backend boots, since it only touches rows that are
-- still unverified with no verification token on file (i.e. accounts
-- from before email verification existed, not someone's genuinely
-- pending signup made after this deploy).

-- 1. Sanity check BEFORE- see how many accounts this will affect.
SELECT count(*) AS accounts_to_grandfather
FROM users
WHERE "isVerified" = false
  AND "verificationToken" IS NULL;

-- 2. The actual backfill.
UPDATE users
SET "isVerified" = true
WHERE "isVerified" = false
  AND "verificationToken" IS NULL;

-- 3. Sanity check AFTER- should be 0 remaining unverified accounts
--    with no way to verify (genuine new unverified signups will still
--    show up here correctly, since they DO have a verificationToken).
SELECT count(*) AS still_unverified_with_no_token
FROM users
WHERE "isVerified" = false
  AND "verificationToken" IS NULL;
