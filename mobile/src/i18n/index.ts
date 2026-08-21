import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common_en from './locales/en/common.json';
import auth_en from './locales/en/auth.json';
import settings_en from './locales/en/settings.json';
import discover_en from './locales/en/discover.json';
import movie_en from './locales/en/movie.json';
import profile_en from './locales/en/profile.json';
import social_en from './locales/en/social.json';
import quiz_en from './locales/en/quiz.json';

import common_uk from './locales/uk/common.json';
import auth_uk from './locales/uk/auth.json';
import settings_uk from './locales/uk/settings.json';
import discover_uk from './locales/uk/discover.json';
import movie_uk from './locales/uk/movie.json';
import profile_uk from './locales/uk/profile.json';
import social_uk from './locales/uk/social.json';
import quiz_uk from './locales/uk/quiz.json';

export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  uk: 'Українська',
};

const resources = {
  en: {
    common: common_en,
    auth: auth_en,
    settings: settings_en,
    discover: discover_en,
    movie: movie_en,
    profile: profile_en,
    social: social_en,
    quiz: quiz_en,
  },
  uk: {
    common: common_uk,
    auth: auth_uk,
    settings: settings_uk,
    discover: discover_uk,
    movie: movie_uk,
    profile: profile_uk,
    social: social_uk,
    quiz: quiz_uk,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: Object.keys(resources.en),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
