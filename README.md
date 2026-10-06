# Библиотека регламентов

Каталог СОП, НПА и приказов с публичным чтением и административным управлением. Express / TypeScript / Prisma, React 18 / Vite / Tailwind, PostgreSQL 16, Gotenberg 8, Nginx и Docker Compose.

## Первый запуск

1. Установите Docker Engine и Docker Compose. Пользователь должен иметь доступ к Docker.
2. Клонируйте репозиторий и перейдите в каталог:
   ```sh
   git clone https://github.com/ZQRey/docs_sop.git
   cd docs_sop
   cp .env.example .env
   ```
3. Укажите в `.env` случайные `POSTGRES_PASSWORD` (буквы и цифры, чтобы не требовалось URL-кодирование) и `JWT_SECRET` (минимум 32 символа). Для генерации: `openssl rand -hex 32`. Установите `ADMIN_PASSWORD` для первого запуска.
4. Запустите:
   ```sh
   docker compose up --build -d
   docker compose ps
   docker compose logs backend
   ```
5. Откройте `http://localhost:8080` или `http://172.16.16.62:8080` на сервере. Порт задаётся через `PORT`.

Миграции и seed выполняются автоматически при старте API. Seed идемпотентен: повторный запуск не изменяет пароль существующего администратора и не дублирует начальные категории. Тестовый вход при значениях по умолчанию: **admin / admin123**. Задайте собственный пароль до первого запуска. Для HTTPS включите `COOKIE_SECURE=true` и настройте TLS на внешнем прокси.

## Миграции и seed

```sh
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

Для новой миграции в среде разработки: `npx prisma migrate dev --name название` из `backend` с доступной тестовой PostgreSQL и `DATABASE_URL`. Применяйте сохранённые миграции через `migrate deploy`.

## Использование

Гость выбирает папку, ищет по названию, фильтрует по тегу, просматривает PDF и скачивает оригинал. Поиск работает в выбранной папке; без выбора — во всей библиотеке. Счётчик дерева включает вложенные папки. API показывает до 500 последних документов, поэтому используйте фильтры для больших каталогов.

Ссылка «Вход для администратора» находится внизу меню. После входа доступны создание / переименование / каскадное удаление папок и загрузка / удаление документов. PDF хранится без конвертации; DOC и DOCX конвертируются в PDF через Gotenberg. Максимальный файл — 100 МБ (multipart-запрос целиком также ограничен Nginx до 100 МБ). Перетащите файл в выбранную папку или используйте кнопку загрузки. Перед удалением требуется подтверждение.

## API

| Метод | Путь | Доступ |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Публичный |
| GET | `/api/auth/me` | Администратор |
| GET | `/api/categories/tree` | Публичный |
| POST | `/api/categories` | Администратор |
| PATCH, DELETE | `/api/categories/:id` | Администратор |
| GET | `/api/documents?categoryId=&search=&tag=` | Публичный |
| POST | `/api/documents` | Администратор, multipart: file, title, categoryId, tags |
| DELETE | `/api/documents/:id` | Администратор |
| GET | `/api/documents/:id/preview`, `/api/documents/:id/download` | Публичный |
| GET | `/api/health` | Публичный |

JWT хранится в HttpOnly / SameSite=Strict cookie, срок сессии 8 часов. Вход ограничен по частоте; административные запросы проверяют авторизацию и Origin. Оригиналы доступны только через API; пути файлов не публикуются в каталоге. У Gotenberg отключены Chromium-маршруты и загрузка внешних ресурсов LibreOffice.

## Проверка и разработка

```sh
cd backend
npm ci
npx prisma generate
npm run build
npm test
cd ../frontend
npm ci
npm run build
```

Для локального API задайте `DATABASE_URL`, `JWT_SECRET`, `GOTENBERG_URL`, `STORAGE_PATH`. После сборки `npm start`; фронтенд `npm run dev` проксирует API на localhost:3000.

Интеграционная проверка запущенного приложения (Python 3, без внешних библиотек): `python scripts/smoke.py http://localhost:8080`. Для нестандартного входа задайте переменные `ADMIN_USERNAME` и `ADMIN_PASSWORD`. Проверка создаёт временную папку, загружает PDF / DOCX, проверяет конвертацию, фильтры, скачивание и удаление, затем удаляет тестовые записи.

## Хранение и обновление

PostgreSQL сохраняется в томе `pgdata`; файлы — в `./storage/originals` и `./storage/pdf`. Резервируйте вместе дамп PostgreSQL и каталог storage. `docker compose down` сохраняет данные; `down -v` удаляет БД. При удалении категории или документа запись удаляется из БД, затем очищаются файлы; при сбое диска смотрите логи API и удалите оставшиеся файлы после сверки с БД.

Обновление: `git pull` и `docker compose up --build -d`. Nginx получает актуальную сборку через общий том static. `.env` и документы не включаются в Git.
