# Міграція з Railway на один VPS (найдешевший варіант)

У проєкті є повний стек у [docker/docker-compose.yml](docker/docker-compose.yml):
Postgres+pgvector, Redis, backend (NestJS з 6 щоденними cron-джобами), frontend,
і Caddy як reverse proxy з авто-HTTPS. Це one-box деплой — усе живе на одній
машині, без розбиття по керованих сервісах. Причина: NestJS `@nestjs/schedule`
крони (нагадування, ротація квізу, векторні апдейти — див. `@Cron` у
`quiz-scheduler.service.ts`, `movies.service.ts`, `notifications.service.ts`,
`watched-reminder.service.ts`, `vector.service.ts`) вимагають процесу, що
працює постійно. Безкоштовні тарифи керованих PaaS це часто ламають, тож для
дешевизни надійніше тримати весь стек на одному завжди-увімкненому сервері.

**Код уже готовий до цього** — `docker-compose.yml`, `movie-frontend/Dockerfile`
і Caddy-конфіги виправлені (без публічних портів БД/Redis, frontend збирається
у статику замість dev-сервера). Нижче — тільки те, що робиться руками на
самому сервері.

## 1. Вибір VPS

| Варіант | Ціна | Коли обрати |
|---|---|---|
| **Oracle Cloud Free Tier** (рекомендовано) | $0/міс назавжди | Ampere A1 (ARM), до 4 OCPU / 24GB RAM у безкоштовному пулі — з великим запасом на весь стек. Мінус: реєстрація іноді з кількох спроб через дефіцит ARM-потужностей у популярних регіонах; картка потрібна для верифікації, але не списують. |
| **Hetzner CX22** (запасний) | ~€4.2/міс | x86, 2 vCPU / 4GB RAM, реєстрація без проблем із доступністю, EU-датацентри — низький пінг для укр. аудиторії. |

ОС: Ubuntu 24.04 LTS.

## 2. Підготовка сервера

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
ufw allow 22,80,443/tcp
ufw enable
```

## 3. Клонування і .env

```bash
git clone <repo> /opt/movie-manager
cd /opt/movie-manager/docker
cp .env.example .env
nano .env   # заповнити реальними значеннями
```

Список змінних у [docker/.env.example](docker/.env.example) — це повний
перелік того, що бекенд реально читає через `ConfigService` (перевірено по
коду, а не по старому `movie-backend/.env.example`, який трохи неповний).
Найпростіший спосіб отримати правильні значення — скопіювати їх один в один
з Railway: у кожному сервісі (`backend`, `frontend`) відкрити вкладку
**Variables** і перенести звідти, а не вгадувати заново. Два нові, яких на
Railway немає: `DOMAIN` і `API_DOMAIN` — домен і піддомен, на які буде
дивитись Caddy.

⚠️ `VITE_API_BASE_URL` і `VITE_RECAPTCHA_SITE_KEY` вшиваються у статичну
збірку **під час `docker build`**, а не читаються в рантаймі (так уже працює
Vite) — якщо зміниш їх пізніше, треба перезібрати `frontend` (`docker compose
up -d --build frontend`), рестарту контейнера недостатньо.

## 4. Перенесення бази даних з Railway

Redis мігрувати не треба — там лише кеш (історія чату з TTL 7 днів), почати з
порожнього нормально. А от Postgres треба перенести з даними (юзери, квіз,
watchlist, embeddings).

**На своєму комп'ютері** (з `psql`/`pg_dump`, версія 15+, щоб збігалась з
`pgvector/pgvector:pg15` на VPS):

```bash
# Railway → Postgres service → вкладка "Connect" → Public Network → скопіювати рядок підключення
RAILWAY_DB_URL="postgresql://postgres:xxxxx@xxxxx.proxy.rlwy.net:12345/railway"

pg_dump "$RAILWAY_DB_URL" -Fc -f movie_manager.dump
scp movie_manager.dump root@<VPS_IP>:/opt/movie-manager/
```

**На VPS** — підняти тільки базу першою, відновити дамп, і лише потім весь стек:

```bash
cd /opt/movie-manager/docker
docker compose up -d db
sleep 5   # дати Postgres піднятись

docker exec -i movie_postgres pg_restore \
  -U $(grep '^DB_USER=' .env | cut -d= -f2) \
  -d $(grep '^DB_NAME=' .env | cut -d= -f2) \
  --no-owner --no-privileges \
  < /opt/movie-manager/movie_manager.dump
```

`--no-owner --no-privileges` — щоб відновлення не падало через
Railway-специфічні імена ролей, яких на новому сервері не існує.

## 5. Смоук-тест перед перемиканням DNS

Поки DNS ще вказує на Railway, підняти весь стек на VPS і перевірити його
за IP, підставляючи заголовок Host вручну (Caddy без реального DNS не видасть
TLS-сертифікат — це нормально, перевіряємо по HTTP):

```bash
docker compose up -d --build
docker compose logs -f backend   # переконатись, що міграції пройшли і крони зареєструвались

curl -H "Host: api.example.com" http://<VPS_IP>/api/docs
```

Перевірити вручну зі свого браузера через тимчасовий запис у `/etc/hosts`
(на своєму комп'ютері, не на сервері): `<VPS_IP> example.com api.example.com`
— так побачиш реальний фронтенд і логін/квіз на новому сервері, не чіпаючи
прод-трафік.

## 6. Перемикання DNS

1. Заздалегідь (за годину-дві) зменшити TTL A-записів домену до 300с — щоб
   перемикання розповсюдилось швидко.
2. Змінити A-записи `example.com` і `api.example.com` на IP нового VPS.
3. Зачекати кілька хвилин — Caddy сам випустить Let's Encrypt сертифікати,
   щойно побачить, що DNS резолвиться на нього (`docker compose logs -f
   caddy` покаже прогрес).
4. Тримати Railway-деплой увімкненим ще 24–48 год як фолбек (на випадок
   застряглого DNS-кешу в когось із користувачів), потім вимкнути сервіси
   на Railway.

## 7. Бекапи

Щоденний дамп Postgres хост-кроном (не плутати з NestJS cron у контейнері):

```bash
# /etc/cron.d/pg-backup
0 3 * * * root docker exec movie_postgres pg_dump -U $DB_USER $DB_NAME | gzip > /opt/backups/$(date +\%F).sql.gz
```

Опційно — заливати бекапи на Cloudflare R2 (безкоштовний tier 10GB) окремим `rclone`-кроном.

## 8. Оновлення (майбутні деплої)

```bash
cd /opt/movie-manager && git pull
cd docker && docker compose up -d --build
```

## Вартість

| Компонент | Варіант | Ціна/міс |
|---|---|---|
| VPS (весь стек) | Oracle Cloud Free | $0 |
| VPS запасний | Hetzner CX22 | ~€4.2 |
| Домен | будь-який регістратор | ~$10/рік |
| Groq / Gemini / TMDB / Cloudinary / Resend / reCAPTCHA / VAPID | безкоштовні тарифи | $0 |
| **Разом (Oracle)** | | **лише домен, ~$0.8/міс** |
| **Разом (Hetzner)** | | **~€5/міс** |
