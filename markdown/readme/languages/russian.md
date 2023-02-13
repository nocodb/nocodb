<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Альтернатива Airtable с открытым исходным кодом ✨ <br>

</h1>
<p align="center">
Превращает любой MySQL, PostgreSQL, SQL Server, SQLite & Mariadb в смарт-таблицу. 
</p>
<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# Быстрый старт

### Используя Docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Для сохранения данных, вы можете установить том в `/usr/app/data/`.

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Используя NPM

```
npx create-nocodb-app
```

### Используя git.

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Получите доступ к панели управления, используя : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Присоединяйтесь к нашему сообществу

<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" 
    alt="Join NocoDB : Free & Open Source Airtable Alternative"
    >
</a>
<br>

# Скриншоты

![1](https://user-images.githubusercontent.com/86527202/136070774-7a69ed00-5645-4518-8a65-3adc5a8ce2bb.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136070784-c6c61301-6ce0-4534-a1bb-d8532a28cb39.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136070790-6b3b4691-8a79-4cde-b9a7-cd7c773afa6e.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136070792-002b1b22-b9b8-4115-b6ec-8336cd23128c.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136070794-c4958974-5767-4037-b894-1e3bbd0be906.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136070796-edc30c76-c694-4e34-a832-29a70bf8fcda.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136070799-4086c8f2-bfb2-4058-947d-d6b1c15d875b.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136070802-18761f84-c434-4878-934e-79fc75e218c8.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136070806-6717781a-f55a-4e80-bad4-81e3063a6467.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136070808-2cf013da-0a14-4a5c-aa19-b0f7f10b6388.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136070810-6e808086-aa82-4f84-879a-e33765f97395.png)
<br>

# Функции

### Богатый интерфейс электронной таблицы

- ⚡ Поиск, сортировка, фильтр, скрыть столбцы с невероятной легкостью
- ⚡ Создание видов: сетка, галерея, канбан, Гантт, форма
- ⚡ Делиться видами: публичный & защищенный паролем
- ⚡ Личные и заблокированные виды
- ⚡ Загрузить изображения в ячейки (работает с S3, Minio, GCP, Azure, Digitalocean, Linode, Ovh, BackBlaze)
- ⚡ Роли: владелец, создатель, редактор, зритель, комментатор, пользовательские роли.
- ⚡ Контроль доступа: тонкозернистый контроль доступа даже в базе данных, уровень таблицы и столбца.

### App Store для автоматики рабочего процесса:

- ⚡ Чат: Microsoft Teams, Slack, Discord, Mattermost
- ⚡ Электронная почта: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ WhatsApp
- ⚡ Любая API третьей стороны

### Программный доступ API через:

- ⚡ REST API (Swagger)
- ⚡ GraphQL API
- ⚡ Включает в себя JWT Authentication & Social Auth
- ⚡ токены API для интеграции с Zapier, Integomat.

# Настройка производства

NocoDB требует базу данных для хранения метаданных видов электронных таблиц и внешних баз данных. Подключения параметров для этой базы данных можно указать в переменной среды NC_DB.

## Docker

#### Пример MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Пример Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Пример SQL Server

```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose

```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## Переменные среды

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)

# Настройка разработки

Please refer to [Development Setup](https://github.com/nocodb/nocodb/tree/master#development-setup)

# Содействие

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Почему мы строим это?

Большинство интернет-компаний используют электронные таблицы или базы данных для решения своих бизнес-задач. Таблицы ежедневно используют более миллиарда человек. Однако мы далеко не работаем с аналогичной скоростью над базами данных, которые являются более мощными инструментами, когда дело доходит до вычислений. Попытки решить эту проблему с помощью предложений SaaS означали ужасный контроль доступа, блокировку поставщиков, блокировку данных, резкие изменения цен и, самое главное, стеклянный потолок для того, что возможно в будущем.

# Наша миссия

Наша миссия - предоставить самый мощный интерфейс без кода для баз данных с открытым исходным кодом для каждого интернет-бизнеса в мире. Это не только демократизирует доступ к мощному вычислительному инструменту, но и приведет к появлению более миллиарда человек, которые будут иметь радикальные способности возиться и строить в Интернете.
