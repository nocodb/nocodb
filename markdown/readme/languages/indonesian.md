
<h1 align="center" style="border-bottom: none">
     <div>
        <a href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/icons/512x512.png" width="80" />
            <br>
            NocoDB
        </a>
    </div>
    ✨ Sebuah Alternatif AirTable Open Source ✨ <br>

</h1>
<p align="center">
Mengubah MySQL, PostgreSQL, SQL Server, SQLite & MariaDB apapun menjadi spreadsheet pintar. 
</p>

<div align="center">
 
[![Node version](https://img.shields.io/badge/node-%3E%3D%2016.14.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Komunitas</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Dokumentasi</b></a>
</p>

![All Views](https://user-images.githubusercontent.com/35857179/194825053-3aa3373d-3e0f-4b42-b3f1-42928332054a.gif)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# Join Tim Kami

<p align=""><a href="http://careers.nocodb.com" target="_blank"><img src="https://user-images.githubusercontent.com/61551451/169663818-45643495-e95b-48e2-be13-01d6a77dc2fd.png" width="250"/></a></p>

# Join Komunitas Kami

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](https://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# Coba singkat

## Docker

```bash
# for SQLite
docker run -d --name nocodb \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
nocodb/nocodb:latest


# for PostgreSQL
docker run -d --name nocodb-postgres \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest


> Untuk menyimpan data di dalam Docker, Anda dapat melakukan mount volume di direktori /usr/app/data/ mulai dari versi 0.10.6. Jika tidak, data Anda akan hilang setelah mengulang pembuatan kontainer.

> Jika Anda berencana untuk memasukkan beberapa karakter khusus, Anda perlu mengubah set karakter dan kolasi sendiri saat membuat basis data. Silakan lihat contoh-contoh untuk [MySQL Docker](https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043).

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

Kami menyediakan berbagai file docker-compose.yml di [bawah direktori](https://github.com/nocodb/nocodb/tree/master/docker-compose) ini. Berikut beberapa contohnya:

```bash
git clone https://github.com/nocodb/nocodb
# for PostgreSQL
cd nocodb/docker-compose/2_pg
docker-compose up -d
```

> Untuk menyimpan data dalam Docker, Anda dapat melakukan mount volume pada direktori /usr/app/data/ mulai dari versi 0.10.6. Jika tidak, data Anda akan hilang setelah mengulang pembuatan kontainer.

> Jika Anda berencana untuk memasukkan beberapa karakter khusus, Anda perlu mengubah set karakter dan kolasi sendiri saat membuat basis data. Silakan lihat contoh-contoh untuk [MySQL Docker Compose](https://github.com/nocodb/nocodb/issues/1313#issuecomment-1046625974).


```bash
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

# GUI

Akses dasbor menggunakan : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

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

# Table of Contents

# Daftar Isi

- [Coba Singkat](#coba-singkat)
  - [Docker](#docker)
  - [Docker Compose](#docker-compose)
- [Antarmuka Grafis Pengguna (GUI)](#gui)
- [Bergabunglah dengan Komunitas Kami](#join-komunitas-kami)
- [Screenshots](#tangkapan-layar)
- [Daftar Isi](#daftar-isi)
- [Fitur-fitur](#fitur)
  - [Antarmuka Lembar Kerja yang Kaya](#antarmuka-spreadsheet-yang-kaya)
  - [Toko Aplikasi untuk Otomasi Alur Kerja](#app-store-untuk-automasi-alur-kerja)
  - [Akses Programatik](#akses-api-programmatik-melalui)
  - [Sinkronisasi Skema](#sinkronisasi-skema)
  - [Audit](#audit)
- [Pengaturan Produksi](#pengaturan-produksi)
  - [Variabel Lingkungan](#environment-variables)
- [Pengaturan Pengembangan](#pengaturan-pengembangan)
- [Berkontribusi](#berkontribusi)
- [Mengapa kami membangun ini?](#kenapa-kita-membangun-ini)
- [Misi Kami](#misi-kami)
- [Lisensi](#lisensi)


# Fitur

### Antarmuka spreadsheet yang kaya

- ⚡ Cari, Sortir, Filter, Sembunyikan Kolom dengan Uber Ease
- ⚡ Buat Tampilan: Grid, Galeri, Kanban, Formulir
- ⚡ Bagikan Pandangan: Dilindungi Publik & Kata Sandi
- ⚡ Pandangan Pribadi & Terkunci
- ⚡ Unggah gambar ke sel (bekerja dengan S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backblaze) !!
- ⚡ Peran: Pemilik, Pencipta, Editor, komentator, pemirsa, komentator, peran khusus.
- ⚡ Kontrol akses: kontrol akses berbutir halus bahkan pada tingkat basis data, tabel & kolom.

### App Store untuk Automasi Alur Kerja

- ⚡ Obrolan: Tim Microsoft, kendur, perselisihan, paling penting
- ⚡ Email: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ Whatsapp.
- ⚡ API Pihak ke-3

### Akses API Programmatik melalui

- ⚡ Rest API (Swagger)
- ⚡ Apis Graphql.
- ⚡ Termasuk Otentikasi JWT & Auth Sosial
- ⚡ Token API untuk berintegrasi dengan Zapier, Integromat.

### Sinkronisasi Skema

Kami memungkinkan Anda untuk menyinkronkan perubahan skema jika Anda telah melakukan perubahan di luar antarmuka NocoDB GUI. Namun, perlu diperhatikan bahwa Anda harus menyediakan migrasi skema sendiri untuk berpindah dari satu lingkungan ke lingkungan lainnya. Lihat [Sinkronisasi Skema](https://docs.nocodb.com/data-sources/sync-with-data-source) untuk detail lebih lanjut.

### Audit

Kami menyimpan semua log operasi pengguna di satu tempat. Lihat [Audit](https://docs.nocodb.com/data-sources/actions-on-data-sources/#audit-logs) untuk detail lebih lanjut.

# Pengaturan Produksi

Secara default, SQLite digunakan untuk menyimpan metadata. Namun, Anda dapat menentukan basis data Anda sendiri. Parameter koneksi untuk basis data ini dapat ditentukan dalam variabel lingkungan `NC_DB`. Selain itu, kami juga menyediakan

## Environment variables

Silakan lihat [Environment Variables](https://docs.nocodb.com/getting-started/self-hosted/environment-variables) untuk informasi lebih lanjut. 

# Pengaturan Pengembangan

Silakan lihat [Pengaturan Development](https://docs.nocodb.com/engineering/development-setup) untuk informasi lebih lanjut.

# Berkontribusi
Silakan lihat [Panduan Kontribusi](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md) untuk informasi lebih lanjut.

# Kenapa kita membangun ini?

Sebagian besar bisnis internet melengkapi diri mereka dengan spreadsheet atau database untuk menyelesaikan kebutuhan bisnis mereka. Spreadsheet digunakan oleh satu miliar+ manusia secara kolaboratif setiap hari. Namun, kami jauh bekerja dengan kecepatan yang sama pada basis data yang merupakan alat yang lebih kuat ketika datang ke komputasi. Upaya untuk menyelesaikan ini dengan persembahan SaaS berarti kontrol akses yang mengerikan, vendor lockin, data lockin, perubahan harga mendadak & paling penting plafon kaca pada apa yang mungkin di masa depan.

# Misi Kami

Misi kami adalah menyediakan antarmuka no-code yang paling kuat untuk basis data yang merupakan sumber terbuka untuk setiap bisnis internet di dunia. Ini tidak hanya akan mendemokratisasi akses ke alat komputasi yang kuat tetapi juga memunculkan satu miliar+ orang yang akan memiliki kemampuan  membangun di Internet.

# Lisensi
<p>
Proyek ini dilisensikan di bawah <a href="./LICENSE">AGPLv3</a>.
</p>
