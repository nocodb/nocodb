<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/icons/512x512.png" width="80" />
            <br>
            NocoDB
        </a>
    </div>
    Опенсорс альтернатива Airtable <br>
</h1>

<p align="center">
Nocodb перетворює будь-яку базу даних MySQL, PostgreSQL, SQL Server, SQLite та MariaDB в розумну електронну таблицю.
</p>

<div align="center">

[![Node version](https://img.shields.io/badge/node-%3E%3D%2018.19.1-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Сайт</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Спільнота</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Документація</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

<div align="center">

[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263434-75fe793d-42af-49e4-b964-d70920e41655.png">](markdown/readme/languages/chinese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263474-787d71e7-3a87-42a8-92a8-be1d1f55413d.png">](markdown/readme/languages/french.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263531-fae58600-6616-4b43-95a0-5891019dd35d.png">](markdown/readme/languages/german.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263669-f567196a-d4e8-4143-a80a-93d3be32ba90.png">](markdown/readme/languages/portuguese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263707-ba4e04a4-268a-4626-91b8-048e572fd9f6.png">](markdown/readme/languages/italian.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263770-38e3e79d-11d4-472e-ac27-ae0f17cf65c4.png">](markdown/readme/languages/japanese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263822-28fce9de-915a-44dc-962d-7a61d340e91d.png">](markdown/readme/languages/korean.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263589-3dbeda9a-0d2e-4bbd-b1fc-691404bb74fb.png">](markdown/readme/languages/spanish.md)

</div>

<p align="center"><a href="markdown/readme/languages/README.md"><b>Дивіться інші мови »</b></a></p>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# Приєднуйтеся до нашої команди

<p align=""><a href="http://careers.nocodb.com" target="_blank"><img src="https://user-images.githubusercontent.com/61551451/169663818-45643495-e95b-48e2-be13-01d6a77dc2fd.png" width="250"/></a></p>

# Приєднуйтеся до нашої спільноти

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](http://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# Швидка спроба проекту

## Docker

```bash
# для SQLite
docker run -d --name nocodb \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
nocodb/nocodb:latest


# для PostgreSQL
docker run -d --name nocodb-postgres \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest


> Щоб зберегти дані в Docker, ви можете змонтувати том в /usr/app/data/ з версії 0.10.6. В іншому випадку ваші дані будуть втрачені після перестворення контейнера.

> Якщо ви плануєте вводити будь-які спеціальні символи, вам може знадобитися змінити набір символів та порівняння при створенні бази даних. Будь ласка, перегляньте приклади для [MySQL Docker](https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043).

> Різні команди лише вказують базу даних, яку NocoDB буде використовувати для зберігання метаданих, але це не впливає на можливість підключення до іншого типу бази даних.

## Binaries

##### MacOS (x64)

```bash
curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### MacOS (arm64)

```bash
curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### Linux (x64)

```bash
curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### Linux (arm64)

```bash
curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### Windows (x64)

```bash
iwr http://get.nocodb.com/win-x64.exe -o Noco-win-x64.exe
.\Noco-win-x64.exe
```

##### Windows (arm64)

```bash
iwr http://get.nocodb.com/win-arm64.exe -o Noco-win-arm64.exe
.\Noco-win-arm64.exe
```

## Docker Compose

Ми надаємо різні приклад конфігурацій docker-compose.yml у [цьому каталозі](https://github.com/nocodb/nocodb/tree/master/docker-compose). Ось деякі приклади.

```bash
git clone https://github.com/nocodb/nocodb
# для PostgreSQL
cd nocodb/docker-compose/2_pg
docker-compose up -d
```

> Щоб зберегти дані в Docker, ви можете змонтувати том в /usr/app/data/ з версії 0.10.6. В іншому випадку ваші дані будуть втрачені після перестворення контейнера.

> Якщо ви плануєте вводити будь-які спеціальні символи, вам може знадобитися змінити набір символів та порівняння при створенні бази даних. Будь ласка, перегляньте приклади для [MySQL Docker](https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043).

## Node Application

Для початку ви можете використати простий Node.js застосунок.

```bash
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```


# GUI

Доступ до панелі інструментів за адресою: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Screenshots
![2](https://github.com/nocodb/nocodb/assets/86527202/a127c05e-2121-4af2-a342-128e0e2d0291)
![3](https://github.com/nocodb/nocodb/assets/86527202/674da952-8a06-4848-a0e8-a7b02d5f5c88)
![4](https://github.com/nocodb/nocodb/assets/86527202/cbc5152a-9caf-4f77-a8f7-92a9d06d025b)
![5](https://github.com/nocodb/nocodb/assets/86527202/dc75dfdc-c486-4f5a-a853-2a8f9e6b569a)

![5](https://user-images.githubusercontent.com/35857179/194844886-a17006e0-979d-493f-83c4-0e72f5a9b716.png)
![7](https://github.com/nocodb/nocodb/assets/86527202/be64e619-7295-43e2-aa95-cace4462b17f)
![8](https://github.com/nocodb/nocodb/assets/86527202/4538bf5a-371f-4ec1-a867-8197e5824286)

![8](https://user-images.githubusercontent.com/35857179/194844893-82d5e21b-ae61-41bd-9990-31ad659bf490.png)
![9](https://user-images.githubusercontent.com/35857179/194844897-cfd79946-e413-4c97-b16d-eb4d7678bb79.png)
![10](https://user-images.githubusercontent.com/35857179/194844902-c0122570-0dd5-41cf-a26f-6f8d71fefc99.png)
![11](https://user-images.githubusercontent.com/35857179/194844903-c1e47f40-e782-4f5d-8dce-6449cc70b181.png)
![12](https://user-images.githubusercontent.com/35857179/194844907-09277d3e-cbbf-465c-9165-6afc4161e279.png)

# Функції

### Багатий інтерфейс таблиць

- ⚡ &nbsp;Основні операції: Створення, Читання, Оновлення та Видалення Таблиць, Стовпців та Рядків
- ⚡ &nbsp;Операції з полями: Сортування, Фільтрація, Приховування / Розкриття Стовпців
- ⚡ &nbsp;Типи переглядів: Сітка (за замовчуванням), Галерея, Форма та Канбан
- ⚡ &nbsp;Типи дозволів для переглядів: Спільний доступ для переглядів та Заблоковані перегляди
- ⚡ &nbsp;Поділ баз / переглядів: Публічно або Приватно (з паролем)
- ⚡ &nbsp;Варіанти типів клітинок: ID, ПосиланняНаІншийЗапис, Пошук, Сума, ОдноРядковийТекст, Вкладення, Валюта, Формула, тощо
- ⚡ &nbsp;Контроль доступу за ролями: Деталізований контроль доступу на різних рівнях
- ⚡ &nbsp;і більше ...

### Широкий вибір застосунків для автоматизації робочих процесів

Ми надаємо різні інтеграції у трьох основних категоріях. Деталі дивіться у <a href="https://docs.nocodb.com/setup-and-usages/account-settings#app-store" target="_blank">App Store</a>.

- ⚡ &nbsp;Чат: Slack, Discord, Mattermost, тощо
- ⚡ &nbsp;Електронна пошта: AWS SES, SMTP, MailerSend, тощо
- ⚡ &nbsp;Сховище: AWS S3, Google Cloud Storage, Minio, тощо

### API доступ

Ми надаємо різні способи, якими користувачі можуть програмно викликати дії. Ви можете використовувати токен (або JWT, або соціальний авторизаційний токен) для підписання ваших запитань для авторизації в NocoDB.

- ⚡ &nbsp;REST API
- ⚡ &nbsp;NocoDB SDK

### Синхронізація схеми

Ми дозволяємо вам синхронізувати зміни схеми, якщо ви внесли зміни поза NocoDB GUI. Проте слід зауважити, що вам доведеться мати власні міграції схеми для переміщення з одного середовища в інше. Деталі дивіться у <a href="https://docs.nocodb.com/data-sources/sync-with-data-source" target="_blank">Sync Schema</a>.

### Аудит

Ми зберігаємо всі журнали операцій користувача в одному місці. Деталі дивіться у <a href="https://docs.nocodb.com/data-sources/actions-on-data-sources/#audit-logs" target="_blank">Audit</a>.

# Налаштування продукції

За замовчуванням використовується SQLite для зберігання метаданих. Однак ви можете вказати свою базу даних. Параметри підключення до цієї бази даних можна вказати в змінній середовища `NC_DB`. Крім того, ми також надаємо наступні змінні середовища для налаштувань.

## Змінні середовища

Будь ласка, звертайтеся до [Змінні середовища](https://docs.nocodb.com/getting-started/self-hosted/environment-variables)

# Налаштування розробки

Будь ласка, перегляньте всю необхідну інформацію тут [Development Setup](https://docs.nocodb.com/engineering/development-setup)

# Вклад у проект

Будь ласка, перегляньте всю необхідну інформацію тут [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Чому ми створюємо цей проект?

Більшість інтернет-бізнесів використовують електронні таблиці, або бази даних для вирішення своїх бізнес-потреб. Електронні таблиці використовуються мільярдами людей кожен день. Однак ми далекі від роботи на подібних швидкостях у роботі з базами даних, які є набагато потужнішими інструментами, коли мова йде про обчислення. Спроби вирішити це за допомогою пропозицій SaaS приводить до жахливого контролю доступу, в'язницю від постачальників хмарних сервісів, в'язницю даних, раптові зміни цін та, що найважливіше, скляну стелю щодо того, що можливо у майбутньому.

# Наша місія

Наша місія - надати найпотужніший no-code інтерфейс для баз даних, код яких є відкритим для кожного інтернет-бізнесу в світі. Це не лише демократизує доступ до потужного інструмента для обчислень, але також приведе до того, що мільярди людей матимуть неймовірні можливості до експериментів та створення проектів в інтернеті.

# Ліцензія

<p>
Цей проект ліцензується за <a href="./LICENSE">AGPLv3</a>.
</p>

# Співтовариші

Дякуємо за ваші внески! Ми вдячні за всі внески від спільноти.

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>
