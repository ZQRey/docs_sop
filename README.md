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

## HTTPS и автоматическое продление через AD CS

Развёртывание в GP1: `https://docs.gp1.loc` на `172.16.16.62:443`; порт 80 перенаправляет на HTTPS (308). Сертификаты выдаёт `dc01.gp1.loc\gp1-DC01-CA`. DNS-запись `docs.gp1.loc` должна указывать на `172.16.16.62`, а клиенты должны доверять корневому сертификату GP1 CA.

В серверном `.env` включена конфигурация:

```dotenv
PORT=80
COMPOSE_FILE=docker-compose.yml:docker-compose.https.yml
COOKIE_SECURE=true
```

`COMPOSE_FILE` использует разделитель `:` на Linux. Обновление сервера по-прежнему выполняется командой `docker compose up --build -d`; Compose автоматически подключает HTTPS override. Закрытые TLS-ключи и сертификаты находятся в `tls/`, исключённом из Git. Nginx использует `tls/current/fullchain.pem` и `tls/current/key.pem`. TLS 1.2 / 1.3; административная cookie имеет флаг Secure. HTTP-вход перенаправляется на HTTPS.

На `dc01.gp1.loc` создан отдельный шаблон **DocsSopTLS**, действующий 365 дней, только с EKU Server Authentication, RSA от 3072 бит. Явное право Enroll дано компьютеру `GP1\DC01$`. Существующие шаблоны CA не изменяются. Запрос CSR содержит SAN `DNS:docs.gp1.loc`; закрытый TLS-ключ генерируется на Linux и остаётся там.

Задача **DocsSopTLS-Renew** на DC01 запускается от SYSTEM ежедневно в **03:15 (Asia/Qyzylorda)** и при загрузке DC. Она проверяет срок сертификата и выпускает новый за 30 дней до истечения. При ошибке повторяется до трёх раз с интервалом 15 минут. Пароль доменного пользователя не хранится. SSH-ключ задачи доступен только SYSTEM, каталог защищён правами SYSTEM / Administrators. На Linux ключ имеет принудительную команду `scripts/tls-bridge.sh`; разрешены только `status`, `csr`, `install`, отключены туннели, forwarding и PTY. SSH host key закреплён в `known_hosts`.

Перед активацией проверяются цепочка CA, имя, срок действия, назначение Server Authentication и соответствие ключа. Замена каталога сертификата выполняется через символьную ссылку, затем `nginx -t` и reload. При ошибке проверки Nginx возвращается предыдущая ссылка. Ежедневная проверка работает независимо от компьютера разработчика.

Проверка на DC01:

```powershell
Get-ScheduledTaskInfo -TaskName DocsSopTLS-Renew
Start-ScheduledTask -TaskName DocsSopTLS-Renew
Get-Content C:\ProgramData\DocsSopTLS\renewal.log -Tail 10
```

Скрипты задачи и журналы: `C:\ProgramData\DocsSopTLS`. `LastTaskResult = 0` означает успешную проверку/продление. При недоступности CA или Linux задача завершится с ошибкой, сохранит старый сертификат и запишет причину в `renewal.log` / `task-output.log`. Отдельные уведомления по почте не настроены.

Проверка на сервере приложения:

```sh
docker compose exec -T nginx nginx -t
openssl x509 -in tls/current/cert.pem -noout -subject -issuer -dates
SSL_CERT_FILE="$PWD/tls/ca.pem" python3 scripts/smoke.py https://docs.gp1.loc
```

Для восстановления задачи скопируйте `scripts/Initialize-DocsCertificateTask.ps1` и `scripts/Renew-DocsCertificate.ps1` в один каталог DC01 и запустите Initialize от администратора с параметром `-SshHostPublicKey` (публичный host key из `/etc/ssh/ssh_host_ed25519_key.pub` сервера Linux). Скрипт идемпотентно создаёт/публикует шаблон и регистрирует задачу; выведенный публичный SSH-ключ добавьте в `authorized_keys` Linux с ограничениями, описанными выше. Сохраните публичный корневой сертификат CA в `tls/ca.pem`, установите права 700 на мост. Затем запустите задачу для первого выпуска и только после появления `tls/current` включите HTTPS override. Приватный ключ задачи с DC01 переносить не нужно.

Резервируйте `tls/` и защищённый каталог задачи вместе с конфигурацией; в резервной копии находятся закрытые ключи. При потере SSH-ключа создайте новый на CA и замените только соответствующую строку `DocsSopTLS` в `authorized_keys`, не затрагивая остальные ключи.
