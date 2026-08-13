# Movie Manager

Повноцінний застосунок для пошуку фільмів, ведення watchlist'у, AI-рекомендацій та соціальних фіч навколо кіно. Монорепозиторій із NestJS-бекендом та React-фронтендом, розгорнутий на власному VPS через Docker Compose і Caddy.

## Стек

**Backend**- `movie-backend/`

- NestJS 11 + TypeORM + PostgreSQL (з розширенням `pgvector`)
- Redis (кешування через `@nestjs/cache-manager`)
- JWT-автентифікація (access + refresh токени) через Passport
- AI: Google Gemini / Groq / OpenAI-сумісні провайдери через `ai` SDK, векторний пошук за embeddings
- Cloudinary (зображення), Resend (email), Web Push (VAPID), reCAPTCHA
- `@nestjs/schedule` для крон-задач, `@nestjs/throttler` для rate-limiting
- Jest для юніт- та e2e-тестів

**Frontend**- `movie-frontend/`

- React 19 + TypeScript + Vite
- React Router, Tailwind CSS, Recharts
- Vitest + Testing Library

**Інфраструктура**- `docker/`

- `docker-compose.yml`: `db` (pgvector), `redis`, `backend`, `frontend`, `caddy`
- Caddy як reverse proxy й видача TLS-сертифікатів на власному домені
- Секрети/URL передаються через `docker/.env` (див. `docker/.env.example`)

## Основні можливості

- Пошук фільмів та акторів, деталі фільму/актора, Top100 підбірки
- Watchlist (переглянуто / заплановано), статистика профілю, публічний профіль користувача
- AI-чат із рекомендаціями фільмів (Lumen AI) та семантичний (векторний) пошук
- Discover- свайп-механіка підбору фільмів
- Щоденний квіз (Daily Quiz) по фільмах
- Досягнення (achievements) та стрічка активності (activity heatmap)
- Push-сповіщення та email (верифікація пошти, скидання пароля)
- Адмін-панель
- Rate limiting, guard'и на AI daily limit тощо

## Розробка

### Backend

```bash
cd movie-backend
npm install
npm run start:dev      # dev-режим з watch
npm run migrate        # застосувати SQL-міграції
npm run test            # юніт-тести
npm run test:e2e        # e2e-тести
```

Бекенд читає конфігурацію з `.env` у `movie-backend/` (`DATABASE_URL` або `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, ключі AI-провайдерів, Cloudinary, Resend, VAPID тощо- повний список див. `docker/.env.example`).

### Frontend

```bash
cd movie-frontend
npm install
npm run dev             # dev-сервер Vite
npm run test             # тести (vitest)
npm run build            # прод-збірка
```

Фронтенд читає `VITE_API_BASE_URL` та `VITE_RECAPTCHA_SITE_KEY` з `.env`.

## Продакшн-деплой

Застосунок розгортається на власному VPS (self-hosted), а не на Railway/Vercel/Neon. Усі сервіси піднімаються разом через Docker Compose, зовнішній трафік приймає лише Caddy (80/443), решта контейнерів спілкується у внутрішній docker-мережі.

```bash
cd docker
cp .env.example .env    # заповнити секрети, домени, ключі API
docker compose up -d --build
```

- `DOMAIN` / `API_DOMAIN`- домени фронтенду й API; Caddy сам видає TLS-сертифікати.
- `backend` читає `DATABASE_URL` (зібраний з `DB_*`) і `REDIS_URL` (саме ці env-змінні, не `REDIS_HOST/REDIS_PORT`).
- `frontend` збирається зі своїми `VITE_*` змінними на етапі `docker build` (вони вшиваються у статику).
- Postgres і Redis не публікують портів назовні- доступні лише іншим контейнерам за назвою сервісу.

Крон-задачі (нагадування про watchlist тощо) виконуються всередині `backend`-процесу через `@nestjs/schedule`, тож контейнер має лишатися always-on.

## Структура репозиторію

```
movie-manager/
├── docker/            # docker-compose, Caddyfile, .env для прод-деплою
├── movie-backend/     # NestJS API
│   └── src/
│       ├── ai-chat/   # AI-чат і рекомендації
│       ├── vector/    # embeddings і векторний пошук
│       ├── movies/    # фільми, watchlist
│       ├── swipe/     # Discover (свайп-механіка)
│       ├── quiz/      # Daily Quiz
│       ├── achievements/, activity/  # досягнення, стрічка активності
│       ├── users/, auth/             # користувачі, автентифікація
│       ├── push/, notifications/     # push- та email-сповіщення
│       └── admin/, health/, search-history/
└── movie-frontend/    # React SPA
    └── src/
        ├── pages/      # сторінки (Search, Watchlist, AiChat, Discover, ...)
        ├── components/ # UI-компоненти
        ├── api/        # клієнт до бекенду
        └── context/    # auth-контекст тощо
```
