-- Adds support for native (Expo) push subscriptions alongside the existing
-- browser VAPID web-push ones. An Expo push token is a single opaque
-- string, so it's stored directly in the existing unique "endpoint" column
-- rather than adding new columns for it; "p256dh"/"auth" only apply to
-- web-push and are now nullable so Expo rows can omit them.
ALTER TABLE "push_subscription"
  ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'web';

ALTER TABLE "push_subscription"
  ALTER COLUMN "p256dh" DROP NOT NULL;

ALTER TABLE "push_subscription"
  ALTER COLUMN "auth" DROP NOT NULL;
