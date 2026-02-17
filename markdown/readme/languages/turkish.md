<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/brand/nocodb-full.png" height="80" />
            <br>
    Açık Kaynak Kodlu Airtable Alternatifi 
        </a>
        <br>
    </div>
</h1>

<p align="center">
NocoDB online veritabanı oluşturmanın en hızlı ve kolay yoludur.
</p>


<p align="center">
    <a href="http://www.nocodb.com"><b>Web sitesi</b></a> •
    <a href="https://discord.gg/c7GEYrvFtT"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Topluluk</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Dokümantasyon</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

# Topluluğumuza Katılın

<a href="https://discord.gg/c7GEYrvFtT" target="_blank">
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

## Docker ile PG
```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
```

## Auto-upstall
Auto-upstall, NocoDB'yi production (canlı) ortamı için hazırlayan bir komuttur. Arka planda docker-compose dosyasını sizin için otomatik olarak oluşturur.

```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

Auto-upstall şunları yapar: 🕊
- 🐳 Docker ve Docker Compose gibi tüm ön gereksinimleri otomatik olarak yükler.
- 🚀 Docker Compose kullanarak NocoDB ile birlikte PostgreSQL, Redis, Minio ve Traefik gateway servislerini otomatik olarak kurar. 🐘 🗄️ 🌐
- 🔄 Komutu tekrar çalıştırdığınızda NocoDB'yi otomatik olarak en son sürüme günceller.
- 🔒 SSL sertifikasını otomatik olarak kurar ve yeniler. Kurulum sırasında bir alan adı (domain) veya alt alan adı (subdomain) girmeniz gerekir.
>  [install.nocodb.com/noco.sh](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh) script'ini GitHub sayfamızda bulabilirsiniz. 


## Diğer Yöntemler

> Binary dosyaları sadece yerel ortamda hızlı test amaçlıdır.

| Kurulum Yöntemi               | Kurulum Komudu                                                                                                                                                                                                                                                                                                                                                        |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 🍏 MacOS arm64 <br>(Binary)   | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🍏 MacOS x64 <br>(Binary)     | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🐧 Linux arm64 <br>(Binary)   | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🐧 Linux x64 <br>(Binary)     | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🪟 Windows arm64 <br>(Binary) | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe`                                                                                                                                                                                                                                                                              |
| 🪟 Windows x64 <br>(Binary)   | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`                                                                                                                                                                                                                                                                                    |


> Lokalde çalışırken NocoDB'ye [http://localhost:8080/dashboard](http://localhost:8080/dashboard) adresinden erişebilirsiniz. 

Diğer kurulum yöntemleri için [dokümanlarımızı](https://docs.nocodb.com/category/installation) inceleyebilirsiniz.

# Ekran Görüntüleri
![2](https://github.com/user-attachments/assets/ffcabc8a-9b3b-48f1-9d04-16859878540e)
![3](https://github.com/user-attachments/assets/13a58c7a-2305-4289-af19-3382c1b759f5)
![4](https://github.com/user-attachments/assets/c2e5415e-389e-49a4-b6d4-289d6b3bf4fc)
![5](https://github.com/user-attachments/assets/c15b72c5-6108-4c3b-b29a-2c295f722d45)

![5](https://github.com/user-attachments/assets/7a5469db-a65a-4414-8e28-e8e640131163)
![7](https://github.com/user-attachments/assets/4ea1398e-bfea-44f4-bfb7-02ae6b936b89)
![8](https://github.com/user-attachments/assets/730bd343-a296-43f5-8c4c-35ffe8a88852)

![8](https://github.com/user-attachments/assets/7bd64315-45e6-4953-9c20-5bfc45955293)
![9](https://github.com/user-attachments/assets/a92edcc6-2412-4eaa-b99a-e01c0b16f6af)
![10](https://github.com/user-attachments/assets/9d5dbebc-4288-4057-9fcd-cf4289dcc22e)
![11](https://github.com/user-attachments/assets/e7ab0a5d-8869-4874-8d65-bdb5bf114fd1)
![12](https://github.com/user-attachments/assets/1a5b5674-51b4-48fc-af48-1c7bac4b484a)

# Özellikler

### Zengin E-Tablo Arayüzü

- ⚡ &nbsp;Temel İşlemler: Tablo, Sütun ve Satır Oluşturma, Okuma, Güncelleme ve Silme
- ⚡ &nbsp;Veri İşlemleri: Sıralama, Filtreleme, Gruplama, Sütun Gizleme / Gösterme
- ⚡ &nbsp;Çoklu Görünüm Türleri: Izgara (Varsayılan), Galeri, Form, Kanban ve Takvim Görünümü
- ⚡ &nbsp;Görünüm İzin Türleri: Ortak Çalışma Görünümleri ve Kilitli Görünümler
- ⚡ &nbsp;Paylaşım Seçenekleri: Herkese Açık ya da Özel (Parola Korumalı)
- ⚡ &nbsp;Zengin Veri Türleri: ID, Bağlantı, Lookup, Rollup, Tek Satırlı Metin, Dosya Eki, Para Birimi, Formül, Kullanıcı vb.
- ⚡ &nbsp;Rol Tabanlı Erişim Kontrolü: Farklı seviyelerde detaylı erişim denetimi
- ⚡ &nbsp;ve daha fazlası ...

### İş Akışı Otomasyonları için Uygulama Mağazası

Üç ana kategoride çeşitli entegrasyonlar sunuyoruz. Detaylar için <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">Uygulama Mağazası</a>'na göz atabilirsiniz.

- ⚡ &nbsp;Sohbet: Slack, Discord, Mattermost, and etc
- ⚡ &nbsp;E-posta: AWS SES, SMTP, MailerSend, and etc
- ⚡ &nbsp;Depolama: AWS S3, Google Cloud Storage, Minio, and etc

### Programatik Erişim

Kullanıcıların işlemleri programatik olarak tetikleyebilmesi için aşağıdaki yöntemleri sunuyoruz. İsteklerinizi NocoDB’ye yetkilendirmek için bir token (JWT veya Sosyal Kimlik Doğrulama / Social Auth) kullanabilirsiniz.

- ⚡ &nbsp;REST API'ler
- ⚡ &nbsp;NocoDB SDK

# Katkıda Bulunma

[Katkı Rehberi](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md)'ni inceleyebilirsiniz..

# Neden bunu geliştiriyoruz?

Çoğu internet girişimi, ihtiyaçlarını çözmek için ya E-Tablolarını (spreadsheet) ya da veritabanlarını kullanıyor. Bu noktada E-Tabloları her gün bir milyardan fazla insan tarafından kullanılıyor. Ancak işlem gücü bakımından çok daha üstün olan veritabanlarında, maalesef aynı hız ve kolaylıkla çalışılamıyor.
 
Bu sorunu SaaS çözümleriyle aşma girişimleri; yetersiz erişim kontrolleri, sağlayıcıya bağımlılık, verilerin hapsedilmesi ve ani fiyat artışları gibi sorunlar yaratmakla kalmayıp, gelecekte yapılabileceklerin önüne çekilen 'görünmez bir duvar' olmaktan öteye gidemedi.

# Misyonumuz

Misyonumuz, dünyadaki her bir internet girişimine, veritabanları için en güçlü açık kaynaklı no-code arayüzünü sunmaktır. 

Bu sayede sadece güçlü bir teknolojik araca erişimi demokratikleştirmekle kalmayıp, aynı zamanda internet üzerinde radikal üretim ve geliştirme yeteneklerine sahip milyarlarca insanın da önünü açıyoruz.

# Lisans

<p>
Bu proje <a href="./LICENSE">AGPLv3</a> ile lisanslanmıştır.
</p>

# Katkıda Bulunanlar

Katkılarınız için teşekkür ederiz! Topluluktan gelen tüm katkılar bizim için çok değerli.

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>
