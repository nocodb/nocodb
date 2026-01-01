<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/brand/nocodb-full.png" height="80" />
            <br>
    Açık Kaynak Airtable Alternatifi
        </a>
        <br>
    </div>
</h1>

<p align="center">
NocoDB, çevrimiçi veritabanları oluşturmanın en hızlı ve en kolay yoludur.
</p>


<p align="center">
    <a href="http://www.nocodb.com"><b>Web Sitesi</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Topluluk</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Dokümantasyon</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

<p align="center"><a href="../../README.md"><b>Diğer dilleri gör »</b></a></p>

# Topluluğumuza Katılın

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](http://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# Kurulum

## Docker ile SQLite

```bash 
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
```

## Docker ile PostgreSQL
```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
```

## Otomatik Kurulum (Auto-upstall)
Auto-upstall, NocoDB'yi production kullanımı için sunucuya kuran tek komutlu bir çözümdür.
Arka planda sizin için otomatik olarak docker-compose oluşturur.

```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

Auto-upstall şunları yapar: 🕊
- 🐳 Docker ve docker-compose gibi tüm gereksinimleri otomatik olarak kurar
- 🚀 Docker Compose kullanarak PostgreSQL, Redis, Minio ve Traefik gateway ile NocoDB'yi otomatik kurar 🐘 🗄️ 🌐
- 🔄 Komutu tekrar çalıştırdığınızda NocoDB'yi otomatik olarak en son sürüme günceller
- 🔒 SSL'i otomatik kurar ve yeniler. Kurulum sırasında bir domain veya subdomain gerektirir
> install.nocodb.com/noco.sh betiği [GitHub'da burada](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh) bulunabilir


## Diğer Yöntemler

> Binary dosyaları yalnızca yerel olarak hızlı test için kullanılmalıdır.

| Kurulum Yöntemi                 | Kurulum Komutu                                                                                                                                                                                          |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 🍏 MacOS arm64 <br>(Binary)     | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                    |
| 🍏 MacOS x64 <br>(Binary)       | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                      |
| 🐧 Linux arm64 <br>(Binary)     | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                    |
| 🐧 Linux x64 <br>(Binary)       | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                      |
| 🪟 Windows arm64 <br>(Binary)   | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe`                                                                                                           |
| 🪟 Windows x64 <br>(Binary)     | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`                                                                                                                 |


> Yerel olarak çalıştırırken NocoDB'ye şu adresten erişin: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

Daha fazla kurulum yöntemi için [dokümantasyonumuza](https://docs.nocodb.com/category/installation) bakın.

# Ekran Görüntüleri
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

# Özellikler

### Zengin Elektronik Tablo Arayüzü

- ⚡ &nbsp;Temel İşlemler: Tablo, Sütun ve Satır Oluşturma, Okuma, Güncelleme ve Silme
- ⚡ &nbsp;Alan İşlemleri: Sıralama, Filtreleme, Gruplama, Sütunları Gizleme / Gösterme
- ⚡ &nbsp;Birden Fazla Görünüm Türü: Izgara (Varsayılan), Galeri, Form, Kanban ve Takvim Görünümü
- ⚡ &nbsp;Görünüm İzin Türleri: İşbirlikçi Görünümler ve Kilitli Görünümler
- ⚡ &nbsp;Base / Görünüm Paylaşımı: Herkese Açık veya Özel (Şifre Korumalı)
- ⚡ &nbsp;Çeşitli Hücre Türleri: ID, Bağlantılar, Lookup, Rollup, Tek Satır Metin, Ek, Para Birimi, Formül, Kullanıcı, vb.
- ⚡ &nbsp;Rol Tabanlı Erişim Kontrolü: Farklı seviyelerde detaylı erişim kontrolü
- ⚡ &nbsp;ve daha fazlası ...

### İş Akışı Otomasyonları için Uygulama Mağazası

Üç ana kategoride farklı entegrasyonlar sunuyoruz. Detaylar için <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">Uygulama Mağazası</a>'na bakın.

- ⚡ &nbsp;Sohbet: Slack, Discord, Mattermost, vb.
- ⚡ &nbsp;E-posta: AWS SES, SMTP, MailerSend, vb.
- ⚡ &nbsp;Depolama: AWS S3, Google Cloud Storage, Minio, vb.

### Programatik Erişim

Kullanıcıların programatik olarak işlem yapmasına olanak tanıyan aşağıdaki yolları sunuyoruz. NocoDB'ye yetkilendirme için isteklerinizi imzalamak üzere bir token (JWT veya Social Auth) kullanabilirsiniz.

- ⚡ &nbsp;REST API'ler
- ⚡ &nbsp;NocoDB SDK

# Katkıda Bulunma

Lütfen [Katkıda Bulunma Rehberi](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md)'ne bakın.

# Bunu Neden Yapıyoruz?

Çoğu internet işletmesi, iş ihtiyaçlarını çözmek için elektronik tablo veya veritabanı kullanır. Elektronik tablolar, her gün milyarlarca insan tarafından işbirliği içinde kullanılmaktadır. Ancak, hesaplama söz konusu olduğunda çok daha güçlü araçlar olan veritabanlarında benzer hızlarda çalışmaktan çok uzağız. SaaS teklifleriyle bu sorunu çözme girişimleri, korkunç erişim kontrolleri, satıcıya bağımlılık, veri kilitleme, ani fiyat değişiklikleri ve en önemlisi gelecekte neyin mümkün olduğuna dair cam bir tavan anlamına gelmiştir.

# Misyonumuz

Misyonumuz, dünyadaki her internet işletmesine açık kaynak olarak veritabanları için en güçlü no-code arayüzünü sağlamaktır. Bu sadece güçlü bir hesaplama aracına erişimi demokratikleştirmekle kalmayacak, aynı zamanda internette radikal oynama ve oluşturma yeteneklerine sahip milyarlarca insanı ortaya çıkaracaktır.

# Lisans

<p>
Bu proje <a href="./LICENSE">AGPLv3</a> altında lisanslanmıştır.
</p>

# Katkıda Bulunanlar

Katkılarınız için teşekkür ederiz! Topluluğun tüm katkılarını takdir ediyoruz.

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>
