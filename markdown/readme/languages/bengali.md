<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/brand/nocodb-full.png" height="80" />
            <br>
    Airtable এর ওপেন সোর্স বিকল্প 
        </a>
        <br>
    </div>
</h1>

<p align="center">
NocoDB হচ্ছে অনলাইনে ডেটাবেস তৈরির সবচেয়ে দ্রুত এবং সহজ উপায়।
</p>


<p align="center">
    <a href="http://www.nocodb.com"><b>ওয়েবসাইট</b></a> •
    <a href="https://discord.gg/c7GEYrvFtT"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>কমিউনিটি</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>ডকুমেন্টেশন</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# আমাদের কমিউনিটিতে যোগ দিন

<a href="https://discord.gg/c7GEYrvFtT" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](http://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# ইনস্টলেশন

## Docker এর সাথে SQLite

```bash 
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
  ```

## Docker এর সাথে PostgreSQL
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
Auto-upstall হলো একটি কমান্ড যা সার্ভারে NocoDB সেটআপ করে প্রোডাকশনে ব্যবহার করার জন্য।
বিহাইন্ড দ্য সিন এটি আপনার জন্য স্বয়ংক্রিয়ভাবে docker-compose তৈরি করে।

```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

Auto-upstall নিম্নলিখিত কাজগুলো করে: 🕊
- 🐳 স্বয়ংক্রিয়ভাবে docker, docker-compose এর মতো সকল প্রয়োজনীয় জিনিসপত্র ইনস্টল করে
- 🚀 স্বয়ংক্রিয়ভাবে Docker Compose ব্যবহার করে PostgreSQL, Redis, Minio, Traefik gateway সহ NocoDB ইনস্টল করে। 🐘 🗄️ 🌐
- 🔄 আবার যখন আপনি কমান্ডটি চালাবেন তখন স্বয়ংক্রিয়ভাবে NocoDB এর সর্বশেষ ভার্সনে আপগ্রেড করে।
- 🔒 স্বয়ংক্রিয়ভাবে SSL সেটআপ করে এবং এর নবায়নও করে। ইনস্টলেশনের সময় একটি ডোমেইন বা সাবডোমেইন ইনপুট হিসেবে প্রয়োজন।
> install.nocodb.com/noco.sh স্ক্রিপ্টটি পাওয়া যাবে [আমাদের github এ](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh)


## অন্যান্য পদ্ধতি

> বাইনারি ফাইলগুলো শুধুমাত্র লোকালি দ্রুত টেস্ট জন্য।

| ইনস্টলেশন পদ্ধতি                | ইনস্টলেশন কমান্ড                                                                                                                                                                                                                                                                                                                                                         |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 🍏 MacOS arm64 <br>(Binary)   | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🍏 MacOS x64 <br>(Binary)     | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🐧 Linux arm64 <br>(Binary)   | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                       |
| 🐧 Linux x64 <br>(Binary)     | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`                                                                                                                                                                                                                                                                                         |
| 🪟 Windows arm64 <br>(Binary) | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe`                                                                                                                                                                                                                                                                              |
| 🪟 Windows x64 <br>(Binary)   | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`                                                                                                                                                                                                                                                                                    |


> লোকালি চালানোর সময় nocodb অ্যাক্সেস করতে ভিজিট করুন: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

আরও ইনস্টলেশন পদ্ধতির জন্য, অনুগ্রহ করে [আমাদের ডকস](https://docs.nocodb.com/category/installation) দেখুন

# স্ক্রিনশট
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

# ফিচারসমূহ

### রিচ স্প্রেডশিট ইন্টারফেস

- ⚡ &nbsp;বেসিক অপারেশন: টেবিল, কলাম এবং রো তৈরি, রিড, আপডেট এবং মুছে ফেলা
- ⚡ &nbsp;ফিল্ড অপারেশন: সাজানো, ফিল্টার, গ্রুপ, কলাম লুকানো / দেখানো
- ⚡ &nbsp;একাধিক ভিউ টাইপ: গ্রিড (ডিফল্ট), গ্যালারি, ফর্ম, কানবান এবং ক্যালেন্ডার ভিউ
- ⚡ &nbsp;ভিউ অনুমতির ধরন: কোলাবোরেটিভ ভিউ এবং লক করা ভিউ
- ⚡ &nbsp;বেস / ভিউ শেয়ার: পাবলিক বা প্রাইভেট (পাসওয়ার্ড দ্বারা সুরক্ষিত)
- ⚡ &nbsp;বিভিন্ন সেল টাইপ: ID, Links, Lookup, Rollup, SingleLineText, Attachment, Currency, Formula, User, ইত্যাদি
- ⚡ &nbsp;রোলের মাধ্যমে অ্যাক্সেস নিয়ন্ত্রণ: বিভিন্ন স্তরে সূক্ষ্ম অ্যাক্সেস নিয়ন্ত্রণ
- ⚡ &nbsp;এবং আরো অনেক কিছু...

### ওয়ার্কফ্লো অটোমেশনের জন্য অ্যাপ স্টোর

আমরা প্রধানত তিনটি বিভাগে বিভিন্ন অনেক ধরনের প্রদান করি। বিস্তারিত জানতে <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">অ্যাপ স্টোর</a> দেখুন।

- ⚡ &nbsp;চ্যাট: Slack, Discord, Mattermost, এবং আরো
- ⚡ &nbsp;ইমেইল: AWS SES, SMTP, MailerSend, এবং আরো
- ⚡ &nbsp;স্টোরেজ: AWS S3, Google Cloud Storage, Minio, এবং আরো

### প্রোগ্রামেটিক অ্যাক্সেস

আমরা ইউজারদের প্রোগ্রামেটিকভাবে অ্যাকশন চালানোর জন্য নিম্নলিখিত উপায় প্রদান করি। NocoDB-তে অথোরাইজেশন জন্য আপনি একটি টোকেন (JWT বা Social Auth) ব্যবহার করে আপনার রিকোয়েস্ট করতে পারেন।

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

# কন্ট্রিবিউশন

অনুগ্রহ করে [কন্ট্রিবিউশন গাইড](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md) দেখুন।

# কেন আমরা এটি তৈরি করছি?

বেশিরভাগ ইন্টারনেট ব্যবসা তাদের ব্যবসায়িক প্রয়োজন এর জন্য স্প্রেডশিট বা ডেটাবেস ব্যবহার করে থাকে। স্প্রেডশিট প্রতিদিন এক বিলিয়নেরও বেশি মানুষ সহযোগিতামূলকভাবে ব্যবহার করে। তবে, কম্পিউটিং অনেক বেশি শক্তিশালী টুল হওয়া সত্ত্বেও আমরা ডেটাবেসের অনুরূপ গতিতে কাজ করার থেকে অনেক পিছিয়ে আছি। SaaS মাধ্যমে এই সমস্যা সমাধানের প্রচেষ্টার ফলে ভয়াবহ অ্যাক্সেস নিয়ন্ত্রণ, ভেন্ডর লক-ইন, ডেটা লক-ইন, আকস্মিক মূল্য পরিবর্তন এবং সবচেয়ে গুরুত্বপূর্ণ বিষয় হল ভবিষ্যতে কী হবে তার উপর একটি ভঙ্গুর সীমা তৈরি হয়েছে।

# আমাদের মিশন

আমাদের মিশন হল বিশ্বের প্রতিটি ইন্টারনেট ব্যবসার জন্য ওপেন সোর্স ডেটাবেসের সবচেয়ে শক্তিশালী নো-কোড ইন্টারফেস প্রদান করা। এটি কেবল একটি শক্তিশালী কম্পিউটিং টুলের অ্যাক্সেসকে গণতান্ত্রিক করবে না বরং বিলিয়নেরও বেশি মানুষকে এগিয়ে নিয়ে যাবে ইন্টারনেটে যাদের আছে নির্মাণ ক্ষমতা আছে।

# লাইসেন্স

<p>
এই প্রজেক্টটি <a href="./LICENSE">AGPLv3</a> এর অধীনে লাইসেন্সপ্রাপ্ত।
</p>

