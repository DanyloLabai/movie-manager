// Defaults to Google's publicly documented reCAPTCHA v2 test key (always
// passes) — matches what movie-frontend's local .env already uses for dev.
// Override via EXPO_PUBLIC_RECAPTCHA_SITE_KEY with the same value as
// movie-frontend's VITE_RECAPTCHA_SITE_KEY for anything beyond local dev.
export const RECAPTCHA_SITE_KEY =
  process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY ?? '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXji';
