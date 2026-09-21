# Movie Manager

A full-featured app for movie search, watchlist management, AI recommendations, and social features around movies. A monorepo with a NestJS backend and a React frontend, deployed on Railway (backend + Redis), Vercel (frontend), and Supabase (PostgreSQL + pgvector).

## Stack

**Backend** - `movie-backend/`

- NestJS 11 + TypeORM + PostgreSQL (with the `pgvector` extension)
- Redis (caching via `@nestjs/cache-manager`)
- JWT authentication (access + refresh tokens) via Passport
- AI: Google Gemini / Groq / OpenAI-compatible providers via the `ai` SDK, embedding-based vector search
- Cloudinary (images), Resend (email), Web Push (VAPID), reCAPTCHA
- `@nestjs/schedule` for cron jobs, `@nestjs/throttler` for rate limiting
- Jest for unit and e2e tests

**Frontend** - `movie-frontend/`

- React 19 + TypeScript + Vite
- React Router, Tailwind CSS, Recharts
- Vitest + Testing Library

**Infrastructure**

- Production: Railway (backend + Redis), Vercel (frontend), Supabase (managed PostgreSQL with `pgvector`)
- `docker/` - an alternative self-hosted setup (Docker Compose + Caddy) with its own `db`/`redis` containers; not what's currently deployed, but usable for local Docker runs or self-hosting

## Key features

- Movie and actor search, movie/actor details, Top100 collections
- Watchlist (watched / planned), profile stats, public user profile
- AI chat with movie recommendations (Lumen AI) and semantic (vector) search
- Discover - swipe-based movie picking
- Daily Quiz about movies
- Achievements and an activity heatmap
- Push notifications and email (email verification, password reset)
- Admin panel
- Rate limiting, AI daily limit guards, etc.

## Development

### Backend

```bash
cd movie-backend
npm install
npm run start:dev      # dev mode with watch
npm run migrate        # apply SQL migrations
npm run test            # unit tests
npm run test:e2e        # e2e tests
```

The backend reads its configuration from `.env` in `movie-backend/` (`DATABASE_URL` or `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, AI provider keys, Cloudinary, Resend, VAPID, etc. - see `docker/.env.example` for the full list).

### Frontend

```bash
cd movie-frontend
npm install
npm run dev             # Vite dev server
npm run test             # tests (vitest)
npm run build            # production build
```

The frontend reads `VITE_API_BASE_URL` and `VITE_RECAPTCHA_SITE_KEY` from `.env`.

## Production deployment

- **Backend + Redis**: Railway, auto-deployed from `main`. Railway keeps the service always-on, which `@nestjs/schedule` cron jobs (watchlist reminders, etc.) depend on.
- **Frontend**: Vercel, auto-deployed from `main`. `VITE_*` variables are set as Vercel project env vars and get baked in at build time.
- **Database**: Supabase-managed PostgreSQL with the `pgvector` extension, reached via `DATABASE_URL`.
- Secrets/API keys (JWT, AI providers, Cloudinary, Resend, VAPID, etc.) are configured directly in the Railway/Vercel project settings, not via a committed `.env`.

### Alternative: self-hosted via Docker Compose

The `docker/` setup (its own Postgres+pgvector, Redis, and Caddy as reverse proxy/TLS) is kept as a self-hosting option but isn't what currently serves production:

```bash
cd docker
cp .env.example .env    # fill in secrets, domains, API keys
docker compose up -d --build
```

- `DOMAIN` / `API_DOMAIN` - frontend and API domains; Caddy issues TLS certificates automatically.
- `backend` reads `DATABASE_URL` (assembled from `DB_*`) and `REDIS_URL` (these exact env vars, not `REDIS_HOST/REDIS_PORT`).
- `frontend` is built with its `VITE_*` variables at `docker build` time (they get baked into the static assets).
- Postgres and Redis don't publish ports externally - they're only reachable by other containers via service name.

## Repository structure

```
movie-manager/
├── docker/            # docker-compose, Caddyfile, .env for self-hosted deployment (not used in production)
├── movie-backend/     # NestJS API
│   └── src/
│       ├── ai-chat/   # AI chat and recommendations
│       ├── vector/    # embeddings and vector search
│       ├── movies/    # movies, watchlist
│       ├── swipe/     # Discover (swipe mechanic)
│       ├── quiz/      # Daily Quiz
│       ├── achievements/, activity/  # achievements, activity heatmap
│       ├── users/, auth/             # users, authentication
│       ├── push/, notifications/     # push and email notifications
│       └── admin/, health/, search-history/
└── movie-frontend/    # React SPA
    └── src/
        ├── pages/      # pages (Search, Watchlist, AiChat, Discover, ...)
        ├── components/ # UI components
        ├── api/        # backend client
        └── context/    # auth context, etc.
```
