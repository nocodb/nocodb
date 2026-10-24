<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/brand/nocodb-full.png" height="80" />
            <br>
            ตัวเลือกทดแทน Airtable
        </a>
        <br>
    </div>
</h1>

<p align="center">
NocoDB คือเครื่องมือที่เร็วและง่ายที่สุดในการสร้างฐานข้อมูลออนไลน์
</p>


<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Community</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

<div align="center">

[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263434-75fe793d-42af-49e4-b964-d70920e41655.png">](markdown/readme/languages/chinese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263474-787d71e7-3a87-42a8-92a8-be1d1f55413d.png">](markdown/readme/languages/french.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263531-fae58600-6616-4b43-95a0-5891019dd35d.png">](markdown/readme/languages/german.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263589-3dbeda9a-0d2e-4bbd-b1fc-691404bb74fb.png">](markdown/readme/languages/spanish.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263669-f567196a-d4e8-4143-a80a-93d3be32ba90.png">](markdown/readme/languages/portuguese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263707-ba4e04a4-268a-4626-91b8-048e572fd9f6.png">](markdown/readme/languages/italian.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263770-38e3e79d-11d4-472e-ac27-ae0f17cf65c4.png">](markdown/readme/languages/japanese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263822-28fce9de-915a-44dc-962d-7a61d340e91d.png">](markdown/readme/languages/korean.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263888-151d4ad1-7084-4943-97c9-56f28cd40b80.png">](markdown/readme/languages/russian.md)

</div>

<p align="center"><a href="markdown/readme/languages/README.md"><b>ดูภาษาอื่น »</b></a></p>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# เข้าร่วมชุมชน

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](http://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# วิธีการติดตั้ง

## ด้วย Docker กับ SQLite

```bash 
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
  ```

## ด้วย Docker กับ PG
```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
```

## Nix

```
nix run github:nocodb/nocodb
```

## NixOS
To use NocoDB as a NixOS module, a flake.nix would be as follows:

```
{
  description = "Bane's NixOS configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nocodb.url = "github:nocodb/nocodb";
  };

  outputs = inputs@{ nixpkgs, nocodb, ... }: {
    nixosConfigurations = {
      hostname = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./configuration.nix
          nocodb.nixosModules.nocodb

          {
            services.nocodb.enable = true;
          }
        ];
      };
    };
  };
}
```

## Auto-upstall
Auto-upstall เป็นคำสั่งเดียวที่ติดตั้ง NocoDB บนเซิร์ฟเวอร์สำหรับการใช้งานในการใช้งานจริง โดยเบื้องหลังจะสร้าง docker-compose ให้คุณโดยอัตโนมัติ


```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

Auto-upstall ทำงานต่อไปนี้: 🕊
- 🐳 ติดตั้งซอฟต์แวร์ที่จำเป็นเช่น docker, docker-compose โดยอัตโนมัติ
- 🚀 ติดตั้ง NocoDB กับ PostgreSQL, Redis, Minio, Traefik gateway ด้วย Docker Compose แบบอัตโนมัติ 🐘 🗄️ 🌐
- 🔄 อัพเดต NocoDB เป็นเวอร์ชันล่าสุดเมื่อรันอีกครั้ง
- 🔒 อัตเดตและตั้งค่า SSL แบบอัตโนมัติ แต่ต้องมีโดเมนหรือซับโดเมนขณะติดตั้ง
> สคริป Auto-upstall หาได้จาก install.nocodb.com/noco.sh [หรือใน github](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh)


## วิธีการติดตั้งอื่น ๆ

> ไฟล์ Binary เหมาะสำหรับการทดสอบในเครื่องเท่านั้น

| วิธีติดตั้ง               | คำสั่ง                                                                                                                                                                                                                                                                                                                                                         |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 🍏 MacOS arm64 <br>(Binary)   | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🍏 MacOS x64 <br>(Binary)     | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🐧 Linux arm64 <br>(Binary)   | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🐧 Linux x64 <br>(Binary)     | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🪟 Windows arm64 <br>(Binary) | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe`                                                                                                                                                                                                                                                                              |
| 🪟 Windows x64 <br>(Binary)   | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`                                                                                                                                                                                                                                                                                    |


> เมื่อรัน nocodb ในเครื่องสามารถเข้าสู่เว็บไซต์ผ่าน: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

วิธีการติดตั้งแบบอื่นสามารถดูได้่ที่ [เอกสารของเรา](https://docs.nocodb.com/category/installation)

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

# คุณสมบัติหลัก

### Spreadsheet ที่มีคุณสมบัติครบครัน

- ⚡ &nbsp;การทำงานพื้นฐาน: สร้าง อ่าน อัปเดต และลบ ตาราง คอลัมน์ และแถว
- ⚡ &nbsp;การทำงานของฟิลต์: จัดเรียบเรียง, กรอง, กลุ่ม, ซ่อน / แสดงคอลัมน์
- ⚡ &nbsp;Multiple Views Types: Grid (By default), Gallery, Form, Kanban and Calendar View
- ⚡ &nbsp;มุมมองที่หลากหลาย: แบบกริด (ค่าเริ่มต้น), แกลเลอรี่, ฟอร์ม, แคนบัน และปฏิทิน
- ⚡ &nbsp;การอนุญาตการเข้าถึงมุมมอง: มุมมองที่ใช้ร่วมกัน และมุมมองที่ล็อคไว้
- ⚡ &nbsp;การใช้เบสร่วมกัน หรือมุมมอง: ทั้งแบบสาธารณะหรือส่วนตัว (ด้วยการป้องกันด้วยรหัสผ่าน)
- ⚡ &nbsp;ประเภทเซลล์ที่หลากหลาย: ID, ลิงก์, Lookup, Rollup, SingleLineText, Attachment, Currency, Formula, User และอื่น ๆ
- ⚡ &nbsp;Access Control with Roles: Fine-grained Access Control at different levels
- ⚡ &nbsp;การเข้าถึง และ การควบคุมสิทธิ์ด้วยบทบาท: การควบคุมสิทธิ์ที่ละเอียดในระดับต่าง ๆ
- ⚡ &nbsp;และอื่น ๆ ...

### App Store สำหรับการทำงานอัตโนมัติ

We provide different integrations in three main categories. See <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">App Store</a> for details.

เรามีความสามารถในการต่อกับซอฟต์แวร์อื่นในสามหมวดหมู่หลัก ดู <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">App Store</a> สำหรับรายละเอียด

- ⚡ &nbsp;แชท: Slack, Discord, Mattermost, และ อื่น ๆ
- ⚡ &nbsp;อีเมล์: AWS SES, SMTP, MailerSend, และ อื่น ๆ
- ⚡ &nbsp;การเก็บข้อมูล: AWS S3, Google Cloud Storage, Minio, และ อื่น ๆ

### เข้าถึงข้อมูลด้วย โปรแกรม

คุณสามารถใช้โทเค็น (JWT หรือ Social Auth) เพื่อเข้าใช้ NocoDB

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

# การสนับสนุน

โปรดดูที่ [วิธีการสนับสนุน](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md)

# ทำไมเราสร้างสิ่งนี้?

หลายๆธุรกิจบนอินเทอร์เน็ตใช้สเปรดชีตหรือฐานข้อมูลเพื่อแก้ปัญหาธุรกิจของตน สเปรดชีตถูกใช้โดยผู้คนมากกว่าพันล้านคนทุกวัน อย่างไรก็ตาม เราไม่สามารถทำงานได้อย่างรวดเร็วในฐานข้อมูลซึ่งเป็นเครื่องมือที่ทรงพลังมากกว่าเมื่อพูดถึงการคอมพิวเตอร์ ความพยายามในการแก้ปัญหานี้ด้วยบริการ SaaS ทำให้เกิดปัญหาเรื่องการควบคุมการเข้าถึงที่ไม่ดี การล็อคผู้ให้บริการ การล็อคข้อมูล การเปลี่ยนแปลงราคาอย่างกะทันหัน และที่สำคัญที่สุดคือการปิดกั้นในสิ่งที่เป็นไปได้ในอนาคต

# พันธกิจของเรา

Our mission is to provide the most powerful no-code interface for databases that is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on the internet.

พันธกิจของเราคือการสร้างเครื่องมือที่มีอินเตอร์เฟสที่ทรงพลังที่สุดสำหรับฐานข้อมูลที่เป็นโอเพนซอร์สแก่ธุรกิจอินเทอร์เน็ตทุกแห่งในโลก ซึ่งไม่เพียงแต่จะทำให้การเข้าถึงเครื่องมือคอมพิวเตอร์ที่ทรงพลังเป็นประชาธิปไตย
แต่ยังนำมาซึ่งผู้คนมากกว่าพันล้านคนที่มีความสามารถในการปรับแต่งและสร้างสรรค์บนอินเทอร์เน็ตอย่างกว้างขวาง

# ลิขสิทธิ์

<p>
โปรเจ็คนี้อยู่ใต้สัญญาแบบ <a href="./LICENSE">AGPLv3</a>.
</p>

# ผู้สนับสนุน

ขอบคุณสำหรับการสนับสนุนของคุณ! เราทุกคนขอขอบคุณทุกการมีส่วนร่วมจากชุมชน

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>