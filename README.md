# Портал адвокатов

Всероссийский SEO-агрегатор адвокатов на Next.js 15 + Prisma + PostgreSQL (локальный инстанс).

## Быстрый старт

```powershell
# 1. Поднять локальный PostgreSQL (порт 5433, данные в .pgdata)
npm run pg:start

# 2. Зависимости уже установлены; при необходимости:
npm install

# 3. Схема и сиды
npm run db:push
npm run db:seed

# 4. Dev-сервер
npm run dev
```

Откройте http://localhost:3000 и http://localhost:3000/ui-kit

### Учётные данные (seed)

- Админ: `admin@portal.local` / `admin123`
- Юристы: смотрите emails в seed (`*@portal.local`) / `lawyer123`

### Локальная БД

- URL: `postgresql://postgres:portal_local_dev@127.0.0.1:5433/portal_advokatov`
- Старт/стоп: `npm run pg:start` / `npm run pg:stop`
- Альтернатива: `docker-compose.yml` (порт 5432) — смените URL в `.env`

### Полезные команды

- `npm run rating:recalc` — пересчёт рейтингов
- `npm run parse:minjust` — выгрузка адвокатов из ЕГРА Минюста (Москва + Тольятти)
- `npm run prepare:registry` — города/палаты + удаление демо-адвокатов без `externalId`
- `npm run import:parsed -- data/parsed/lawyers-moscow-tolyatti.json` — импорт в БД
- `npm run import:parsed -- scripts/sample-import.json` — демо-импорт
- `npm run db:studio` — Prisma Studio

### Источник реестра адвокатов

Публичный **Единый государственный реестр адвокатов** Минюста РФ:
https://minjust.gov.ru/ru/pages/advokaty-rossijskoj-federacii/

Данные выгружаются через API `reestrs.minjust.gov.ru` без искажения полей (ФИО, реестровый номер, статус, субъект РФ). Город Тольятти определяется по адресу адвокатского образования в связанном реестре АО.
