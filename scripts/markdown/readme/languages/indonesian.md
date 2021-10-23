<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Sebuah Alternatif AirTable Open Source ✨ <br>

</h1>
<p align="center">
Mengubah MySQL, PostgreSQL, SQL Server, SQLite & MariaDB apapun menjadi spreadsheet pintar. 
</p>
<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://badgen.net/npm/node/next)](http://nodejs.org/download/)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/NocoDB.svg?style=social&label=Follow%20%40NocoDB)](https://twitter.com/NocoDB)

</div>



<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> • 
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a>
</p>  

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)



<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>


# Mulai Cepat
### 1-Klik Deploy

#### Heroku
<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>
<br>

### Menggunakan Docker.
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### Menggunakan NPM.
```
npx create-nocodb-app
```
### Menggunakan git.
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Akses dasbor menggunakan : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# Bergabunglah dengan komunitas kami
<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>

# Tangkapan Layar

![1](https://user-images.githubusercontent.com/86527202/136074228-f52e181b-e65d-44ce-afca-0447eb506e90.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136074239-a180d0c9-129a-4819-974f-e18a8a2260fe.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136074246-7c01d499-0086-42c6-a9b1-2ce474ece54e.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136074251-7da52d76-7e18-41bb-bb29-e678306c2a45.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136074254-6e4a7d39-0b34-4246-99c4-3eff0ae26ec0.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136074258-7fa78660-b42e-4be4-95d8-faf6576ce5f1.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136074261-aede8e3d-e30c-4d6d-ac07-39b90baf2f5a.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136074269-c6db140f-156c-49f5-a6a3-82dcc48b714b.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136074272-4b212227-f3d6-4714-aea0-630e9ec482a9.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136074279-a51373f3-88e8-417d-b641-a49949feabae.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136074285-b5d1dc5c-fac3-43af-b9fc-1a5d1d41d071.png)
<br>





# Fitur
### Antarmuka spreadsheet yang kaya

- ⚡ Cari, Sortir, Filter, Sembunyikan Kolom dengan Uber Ease
- ⚡ Buat Tampilan: Grid, Galeri, Kanban, Gantt, Formulir
- ⚡ Bagikan Pandangan: Dilindungi Publik & Kata Sandi
- ⚡ Pandangan Pribadi & Terkunci
- ⚡ Unggah gambar ke sel (bekerja dengan S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backblaze) !!
- ⚡ Peran: Pemilik, Pencipta, Editor, komentator, pemirsa, komentator, peran khusus.
- ⚡ Kontrol akses: kontrol akses berbutir halus bahkan pada tingkat basis data, tabel & kolom.

### App Store untuk Automasi Alur Kerja:
- ⚡ Obrolan: Tim Microsoft, kendur, perselisihan, paling penting
- ⚡ Email: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ Whatsapp.
- ⚡ API Pihak ke-3

### Akses API Programmatik melalui:
- ⚡ Rest API (Swagger)
- ⚡ Apis Graphql.
- ⚡ Termasuk Otentikasi JWT & Auth Sosial
- ⚡ Token API untuk berintegrasi dengan Zapier, Integromat.


# Pengaturan Produksi
NOCODB membutuhkan database untuk menyimpan metadata tampilan spreadsheet dan database eksternal. Dan params koneksi untuk basis data ini dapat ditentukan dalam variabel lingkungan NC_DB.


## Docker

#### Contoh MySQL
```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Contoh Postgres
```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Contoh SQL Server
```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose
```
git clone https://github.com/nocodb/nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up
```


## Environment variables
| Variabel                |   Wajib   | Komentar                                                                         | Jika Tidak Ada                                 |
|-------------------------|-----------|----------------------------------------------------------------------------------|--------------------------------------------|
| NC_DB                   | Iya      | Lihat URL basis data kami                                                            | SQLite lokal akan dibuat di folder root  |
| DATABASE_URL            | Tidak       | Format JDBC URL. Dapat digunakan sebagai pengganti NC_DB. Digunakan dalam 1-Klik Deployment|   |
| DATABASE_URL_FILE       | Tidak       | path ke file yang berisi Format URL JDBC. Dapat digunakan sebagai pengganti NC_DB. Digunakan dalam penyebaran 1-Klik Heroku Deployment |   |
| NC_PUBLIC_URL           | Iya       | Digunakan untuk mengirim undangan Email                   | Tebakan terbaik dari params permintaan http        |
| NC_AUTH_JWT_SECRET      | Iya       | Rahasia JWT digunakan untuk auth dan menyimpan rahasia lainnya                               | Rahasia acak akan dibuat          |
| NC_SENTRY_DSN           | Tidak        | Untuk pemantauan Penjaga                                                     |   |
| NC_CONNECT_TO_EXTERNAL_DB_DISABLED | Tidak | Nonaktifkan pembuatan Proyek dengan database eksternal                              |   |
| NC_DISABLE_TELE | Tidak | Nonaktifkan telemetry                              |   |
| NC_BACKEND_URL | Tidak |  Backend URL Khusus                             | ``http://localhost:8080`` akan digunakan  |

# Pengaturan Pengembangan
```
git clone https://github.com/nocodb/nocodb
cd nocodb

# run backend
cd packages/nocodb
npm install
npm run watch:run

# open localhost:8080/dashboard in browser

# run frontend 
cd packages/nc-gui
npm install
npm run dev

# open localhost:3000/dashboard in browser
```

Perubahan yang dibuat pada kode akan dimulai ulang secara otomatis.


## Menjalankan tes Cypress secara Lokal

```shell
# install dependencies(cypress)
npm install

# run required services by using docker compose 
docker-compose -f ./docker-compose-cypress.yml up



# wait until both 3000 and 8080 porta are avalable
# and run cypress test using following command
npm run cypress:run

# or run following command to run it with GUI
npm run cypress:open
```

# Berkontribusi
- Silahkan lihat ./scripts/contribute/HowToApplyLicense.md
- Abaikan penambahan headers untuk .json or .md or .yml

# 🎯  Kenapa kita membangun ini?
Sebagian besar bisnis internet melengkapi diri mereka dengan spreadsheet atau database untuk menyelesaikan kebutuhan bisnis mereka. Spreadsheet digunakan oleh satu miliar + manusia secara kolaboratif setiap hari. Namun, kami jauh bekerja dengan kecepatan yang sama pada basis data yang merupakan alat yang lebih kuat ketika datang ke komputasi. Upaya untuk menyelesaikan ini dengan persembahan SaaS berarti kontrol akses yang mengerikan, vendor lockin, data lockin, perubahan harga mendadak & paling penting plafon kaca pada apa yang mungkin di masa depan.

# ❤ Misi kita :
Misi kami adalah menyediakan antarmuka tanpa kode yang paling kuat untuk basis data yang merupakan sumber terbuka untuk setiap bisnis internet di dunia. Ini tidak hanya akan mendemokratisasi akses ke alat komputasi yang kuat tetapi juga memunculkan satu miliar + orang yang akan memiliki kemampuan mengotori-dan membangun radikal di Internet.
