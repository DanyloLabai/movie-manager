-- Baseline schema for tables that were previously created only by TypeORM's
-- `synchronize: true` and never had a migration. Reflects entity shape as of
-- before migration 2 (rating still integer, no isAdmin/watchedAt/lastReminderSentAt
-- columns yet) so the later delta migrations apply cleanly on top of this.

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "username" varchar NOT NULL UNIQUE,
  "email" varchar NOT NULL UNIQUE,
  "password" varchar NOT NULL,
  "avatarUrl" varchar,
  "isVerified" boolean NOT NULL DEFAULT false,
  "verificationToken" varchar,
  "verificationTokenExpiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "resetToken" varchar,
  "resetTokenExpiresAt" TIMESTAMPTZ,
  "hashedRefreshToken" varchar
);

CREATE TABLE IF NOT EXISTS "user_friends" (
  "userId" integer NOT NULL,
  "friendId" integer NOT NULL,
  PRIMARY KEY ("userId", "friendId"),
  CONSTRAINT "FK_user_friends_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_user_friends_friendId" FOREIGN KEY ("friendId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" SERIAL PRIMARY KEY,
  "tmdbId" integer NOT NULL,
  "rating" integer,
  "mediaType" varchar NOT NULL DEFAULT 'movie',
  "title" varchar NOT NULL,
  "isWatched" boolean NOT NULL DEFAULT false,
  "isFavorite" boolean NOT NULL DEFAULT false,
  "currentSeason" integer,
  "currentEpisode" integer,
  "posterUrl" varchar,
  "releaseDate" date,
  "notified" boolean NOT NULL DEFAULT false,
  "addedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_watchlist_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "notification" (
  "id" SERIAL PRIMARY KEY,
  "tmdbId" integer NOT NULL,
  "title" varchar NOT NULL,
  "posterUrl" varchar,
  "mediaType" varchar NOT NULL,
  "isRead" boolean NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_notification_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "friend_request" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "fromUserId" integer NOT NULL,
  "toUserId" integer NOT NULL,
  CONSTRAINT "FK_friend_request_fromUserId" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_friend_request_toUserId" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "push_subscription" (
  "id" SERIAL PRIMARY KEY,
  "endpoint" text NOT NULL UNIQUE,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_push_subscription_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "activity" (
  "id" SERIAL PRIMARY KEY,
  "type" varchar NOT NULL,
  "tmdbId" integer NOT NULL,
  "title" varchar NOT NULL,
  "posterUrl" varchar,
  "mediaType" varchar NOT NULL,
  "rating" integer,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_activity_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
