<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/icons/512x512.png" width="80" alt="NocoDB लोगो" />
            <br>
            NocoDB
        </a>
    </div>
    ओपन सोर्स एयरटेबल विकल्प <br>
</h1>

<p align="center">
NocoDB ऑनलाइन डेटाबेस बनाने का सबसे तेज और आसान तरीका है।
</p>

<p align="center">
    <a href="http://www.nocodb.com"><b>वेबसाइट</b></a> •
    <a href="https://discord.gg/c7GEYrvFtT"><b>डिस्कॉर्ड</b></a> •
    <a href="https://community.nocodb.com/"><b>समुदाय</b></a> •
    <a href="https://twitter.com/nocodb"><b>ट्विटर</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>रेडिट</b></a> •
    <a href="https://docs.nocodb.com/"><b>दस्तावेज़ीकरण</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

<p align="center"><a href="markdown/readme/languages/README.md"><b>अन्य भाषाएँ देखें »</b></a></p>

# हमारे समुदाय में शामिल हों

<a href="https://discord.gg/c7GEYrvFtT" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

# स्थापना

## SQLite के साथ डॉकर

```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
  ```

## PG के साथ डॉकर

```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
  ```

## ऑटो-अपस्टाल

ऑटो-अपस्टाल एक एकल कमांड है जो उत्पादन उपयोग के लिए सर्वर पर NocoDB सेट करता है।
इसके पीछे यह आपके लिए ऑटो-जनरेट डॉकर-कंपोज़ करता है।

```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

ऑटो-अपस्टाल निम्नलिखित करता है : 🕊

- 🐳 स्वचालित रूप से सभी पूर्व-आवश्यकताओं को स्थापित करता है जैसे डॉकर, डॉकर-कंपोज़
- 🚀 डॉकर-कंपोज़ का उपयोग करके PostgreSQL, Redis, Minio, Traefik गेटवे के साथ स्वचालित रूप से NocoDB स्थापित करता है। 🐘 🗄️ 🌐
- 🔄 जब आप कमांड को फिर से चलाते हैं तो स्वचालित रूप से NocoDB को नवीनतम संस्करण में अपग्रेड करता है।
- 🔒 स्वचालित रूप से SSL सेट करता है और इसे नवीनीकरण भी करता है। स्थापना के दौरान इनपुट के रूप में एक डोमेन या उपडोमेन की आवश्यकता होती है।
  > install.nocodb.com/noco.sh स्क्रिप्ट [यहाँ हमारे गिटहब में](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh) पाई जा सकती है।

## अन्य तरीके

> बाइनरी केवल स्थानीय रूप से त्वरित परीक्षण के लिए हैं।

| स्थापना विधि                  | स्थापना के लिए कमांड                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| 🍏 MacOS arm64 <br>(बाइनरी)   | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`          |
| 🍏 MacOS x64 <br>(बाइनरी)     | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`            |
| 🐧 Linux arm64 <br>(बाइनरी)   | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`          |
| 🐧 Linux x64 <br>(बाइनरी)     | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`            |
| 🪟 Windows arm64 <br>(बाइनरी) | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe` |
| 🪟 Windows x64 <br>(बाइनरी)   | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`       |

> स्थानीय रूप से चलाते समय nocodb तक पहुँचने के लिए जाएँ: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

अधिक स्थापना विधियों के लिए, कृपया [हमारी डॉक्यूमेंटेशन](https://docs.nocodb.com/category/installation) देखें

# स्क्रीनशॉट

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

# विशेषताएँ

### समृद्ध स्प्रेडशीट इंटरफ़ेस

- ⚡ &nbsp;बुनियादी संचालन: तालिकाएँ, कॉलम और पंक्तियाँ बनाना, पढ़ना, अपडेट करना और हटाना
- ⚡ &nbsp;फील्ड संचालन: कॉलम को क्रमबद्ध, फ़िल्टर, समूहित, छिपाना / अनछिपाना
- ⚡ &nbsp;एकाधिक दृश्य प्रकार: ग्रिड (डिफ़ॉल्ट), गैलरी, फ़ॉर्म, कानबन और कैलेंडर दृश्य
- ⚡ &nbsp;दृश्य अनुमतियों के प्रकार: सहयोगी दृश्य और लॉक किए गए दृश्य
- ⚡ &nbsp;बेस / दृश्य साझा करें: या तो सार्वजनिक या निजी (पासवर्ड सुरक्षा के साथ)
- ⚡ &nbsp;विभिन्न प्रकार की सेल: आईडी, लिंक, लुकअप, रोलअप, सिंगललाइनटेक्स्ट, अटैचमेंट, मुद्रा, फॉर्मूला, उपयोगकर्ता, आदि
- ⚡ &nbsp;भूमिकाओं के साथ पहुँच नियंत्रण: विभिन्न स्तरों पर बारीक पहुँच नियंत्रण
- ⚡ &nbsp;और अधिक ...

### कार्यप्रवाह स्वचालन के लिए ऐप स्टोर

हम तीन मुख्य श्रेणियों में विभिन्न एकीकरण प्रदान करते हैं। विवरण के लिए <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">ऐप स्टोर</a> देखें।

- ⚡ &nbsp;चैट: स्लैक, डिस्कॉर्ड, मैटरमोस्ट, आदि
- ⚡ &nbsp;ईमेल: AWS SES, SMTP, मेलरसेन्ड, आदि
- ⚡ &nbsp;स्टोरेज: AWS S3, गूगल क्लाउड स्टोरेज, मिनियो, आदि

### प्रोग्रामेटिक एक्सेस

हम उपयोगकर्ताओं को प्रोग्रामेटिक रूप से क्रियाएँ करने के लिए निम्नलिखित तरीके प्रदान करते हैं। आप NocoDB के लिए प्राधिकरण के लिए अपने अनुरोधों पर हस्ताक्षर करने के लिए एक टोकन (या तो JWT या सोशल ऑथ) का उपयोग कर सकते हैं।

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

# योगदान

कृपया [योगदान गाइड](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md) देखें।

# हम यह क्यों बना रहे हैं?

अधिकांश इंटरनेट व्यवसाय अपनी व्यावसायिक आवश्यकताओं को हल करने के लिए या तो स्प्रेडशीट या डेटाबेस से लैस होते हैं। स्प्रेडशीट्स का उपयोग हर दिन एक अरब+ लोग सामूहिक रूप से करते हैं। हालाँकि, हम डेटाबेस पर समान गति से काम करने से बहुत दूर हैं, जो कि कंप्यूटिंग के मामले में बहुत अधिक शक्तिशाली उपकरण हैं। इस समस्या को SaaS पेशकशों के माध्यम से हल करने के प्रयासों ने भयानक पहुंच नियंत्रण, विक्रेता में लॉक-इन, डेटा में लॉक-इन, अचानक मूल्य परिवर्तन और सबसे महत्वपूर्ण बात, भविष्य में संभावनाओं पर एक कांच की छत का मतलब रखा है।

# हमारा मिशन

हमारा मिशन दुनिया के हर एक इंटरनेट व्यवसाय के लिए सबसे शक्तिशाली नो-कोड इंटरफेस प्रदान करना है जो ओपन-सोर्स है। यह न केवल शक्तिशाली कंप्यूटिंग टूल तक पहुंच को लोकतांत्रिक करेगा, बल्कि एक अरब+ लोगों को भी लाएगा जिनके पास इंटरनेट पर क्रांतिकारी tinkering-and-building क्षमताएँ होंगी।

# लाइसेंस

<p>
यह परियोजना <a href="./LICENSE">AGPLv3</a> के तहत लाइसेंस प्राप्त है।
</p>

# योगदानकर्ता

आपके योगदान के लिए धन्यवाद! हम समुदाय से सभी योगदानों की सराहना करते हैं।

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" alt="NocoDB योगदानकर्ता"/>
</a>
