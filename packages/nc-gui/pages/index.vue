<template>
  <v-row
    class="welcome-page"
    style="min-height: 100vh"
    align="center"
    justify="center"
  >
    <template v-if="typed && moved">
      <v-col
        cols="12"
        sm="12"
        md="12"
        class="text-center "
      >
        <!--      <p class="text-center">
                <img src="~/assets/img/icons/256.png" width="70" class="mx-auto">
              </p>-->

        <h1 class="mt-8 mb-4 primary--text  mt-1  white--tex mb-0 text-h2 font-weight-black">
          NocoDB <br><span
            class="textColor--text text--lighten-1"
          >The Open Source<br>
            NoCode Database</span>
        </h1>
        <template v-if="!loading">
          <p class="grey--text text--darken-1 title normal" v-html="message" />
        </template>

        <!--      <div class="d-flex align-center body-2 justify-center grey&#45;&#45;text text&#45;&#45;darken-1 mt-1">-->
        <!--        Join-->
        <!--        <gh-btns-star-->
        <!--          reverse-->
        <!--          icon="mark-github" slug="nocodb/nocodb" show-count class="mr-1 align-self-center">-->
        <!--          Developers-->

        <!--        </gh-btns-star> building NoCode applications.-->
        <!--      </div>-->

        <v-btn
          x-large
          class="primary mt-7 px-10 py-8 font-weight-black title let-us-begin"
          :loading="loading"
          @click="navigate"
        >
          <img src="~/assets/img/icons/512x512-trans.png" width="30" class="mr-4">
          {{ loading ? 'Loading' : "Let's Begin" }}
        </v-btn>
      </v-col>
      <v-col cols="12">
        <p class="xc--text text--lighten-3 mt-15 mb-3 text-center">
          Supported Databases
        </p>
        <div class="d-flex logos justify-center">
          <img src="db/mysql.png.jpg">
          <img src="db/mssql.png.jpg">
          <img src="db/postgre.png.jpg">
          <img src="db/maria.png.jpg">
          <img src="db/aurora.png">
          <img src="db/sqlite.svg">
        </div>
      </v-col>
      <!--        <v-card class="elevation-12" width="100%">-->
      <!--          <v-toolbar-->
      <!--            color="primary"-->
      <!--            dark-->
      <!--            flat-->
      <!--          >-->
      <!--            <v-toolbar-title>Login form</v-toolbar-title>-->
      <!--            <v-spacer></v-spacer>-->
      <!--            <v-tooltip bottom>-->
      <!--              <template v-slot:activator="{ on }">-->
      <!--                <v-btn-->
      <!--                  :href="source"-->
      <!--                  icon-->
      <!--                  large-->
      <!--                  target="_blank"-->
      <!--                  v-on="on"-->
      <!--                >-->
      <!--                  <v-icon>mdi-code-tags</v-icon>-->
      <!--                </v-btn>-->
      <!--              </template>-->
      <!--              <span>Source</span>-->
      <!--            </v-tooltip>-->
      <!--          </v-toolbar>-->
      <!--          <v-card-text>-->

      <!--          </v-card-text>-->
      <!--          <v-card-actions>-->
      <!--            <v-spacer></v-spacer>-->
      <!--            <v-btn color="primary">Login</v-btn>-->
      <!--          </v-card-actions>-->
      <!--        </v-card>-->
    </template>
    <div v-else>
      <p class="display-4 text-center font-weight-bold textColor--text text--lighten-1 welcome-msg">
        <vue-typer
          :repeat="0"
          text="Every once in a while,
a revolutionary tech comes
 along that changes everything."
          @typed="typed = true; moved = false"
        />
      </p>

      <v-carousel
        v-show="typed"
        class="mt-14"
        hide-delimiters
        height="50"
        :show-arrows="false"
        cycle
        interval="1500"
      >
        <v-carousel-item
          v-for="(item,i) in carItems"
          :key="i"
        >
          <div class=" text-center title font-italic font-bold primary--text">
            - {{ item.text }}
          </div>
        </v-carousel-item>
      </v-carousel>
    </div>
  </v-row>
</template>

<script>
// ES6
import { VueTyper } from 'vue-typer'

// import('animate.css/animate.min.css')

export default {
  name: 'Start',
  components: {
    VueTyper
  },
  layout: 'empty',
  data: () => ({
    carItems: [{ text: 'It\'s phenomenal !' },
      { text: 'It is Open Source !' },
      { text: 'And it works like magic !' }
    ],
    showAnimText: 0,
    moved: false,
    typed: false,
    xc_ee: process.env.EE,
    defaultMessage: 'Looks like you configured databases.<br> Now it\'s time to setup an admin user.',
    loading: true,

    /* Converted from : https://smodin.me/translate-one-text-into-multiple-languages
     * Enter database host name || Choose SQL Database type || Enter database username || Enter database password || Enter database port number || Enter database/schema name || Enter API type to generate || How do you want to run it
     * */
    lang: [{
      language: 'English',
      symbol: 'en',
      text: 'Enter database host name || Choose SQL Database type || Enter database username || Enter database password || Enter database port number || Enter database/schema name || Enter API type to generate || How do you want to run it'
    }, {
      language: 'Arabic',
      symbol: 'ar',
      text: 'أدخل اسم مضيف قاعدة البيانات || اختر نوع قاعدة بيانات SQL || أدخل اسم مستخدم قاعدة البيانات || أدخل كلمة مرور قاعدة البيانات || أدخل رقم منفذ قاعدة البيانات || أدخل اسم قاعدة البيانات / المخطط || أدخل نوع API لإنشاء || كيف تريد تشغيله'
    },
    {
      language: 'Dutch',
      symbol: 'nl',
      text: 'Voer de hostnaam van de database || in Kies SQL-databasetype || Voer de database-gebruikersnaam in || Voer het databasewachtwoord in || Voer het poortnummer van de database in || Voer de database- / schemanaam in || Voer het API-type in om || te genereren Hoe wil je het uitvoeren?'
    },
    {
      language: 'French',
      symbol: 'fr',
      text: "Entrez le nom d'hôte de la base de données || Choisissez le type de base de données SQL || Entrez le nom d'utilisateur de la base de données || Entrez le mot de passe de la base de données || Entrez le numéro de port de la base de données || Entrez le nom de la base de données / du schéma || Entrez le type d'API à générer || Comment voulez-vous l'exécuter"
    },
    {
      language: 'German',
      symbol: 'de',
      text: 'Geben Sie den Datenbank-Hostnamen || ein Wählen Sie den SQL-Datenbanktyp || Geben Sie den Datenbank-Benutzernamen || ein Geben Sie das Datenbankkennwort || ein Geben Sie die Datenbankportnummer || ein Geben Sie den Datenbank- / Schemanamen || ein Geben Sie den zu generierenden API-Typ || ein Wie möchten Sie es ausführen?'
    },
    {
      language: 'Italian',
      symbol: 'it',
      text: 'Immettere il nome host del database || Scegli il tipo di database SQL || Immettere il nome utente del database || Immettere la password del database || Immettere il numero di porta del database || Immettere il nome del database / schema || Inserisci il tipo di API da generare || Come vuoi eseguirlo'
    },
    {
      language: 'Japanese',
      symbol: 'ja',
      text: 'データベースのホスト名を入力してください|| SQLデータベースタイプを選択||データベースのユーザー名を入力してください||データベースのパスワードを入力してください||データベースのポート番号を入力してください||データベース/スキーマ名を入力してください||生成するAPIタイプを入力してください||どのように実行しますか'
    },
    {
      language: 'Russian',
      symbol: 'ru',
      text: 'Введите имя хоста базы данных || Выберите тип базы данных SQL || Введите имя пользователя базы данных || Введите пароль базы данных || Введите номер порта базы данных || Введите имя базы данных / схемы || Введите тип API для генерации || Как ты хочешь запустить это'
    },
    {
      language: 'Spanish',
      symbol: 'es',
      text: 'Ingrese el nombre de host de la base de datos || Elija el tipo de base de datos SQL || Ingrese el nombre de usuario de la base de datos || Ingrese la contraseña de la base de datos || Ingrese el número de puerto de la base de datos || Ingrese el nombre de la base de datos / esquema || Ingrese el tipo de API para generar || ¿Cómo quieres ejecutarlo?'
    },
    {
      language: 'Catalan',
      symbol: 'ca',
      text: "Introduïu el nom de l'amfitrió de la base de dades || Trieu el tipus de base de dades SQL || Introduïu el nom d'usuari de la base de dades || Introduïu la contrasenya de la base de dades || Introduïu el número de port de la base de dades || Introduïu el nom de la base de dades / esquema || Introduïu el tipus d'API per generar || Com voleu executar-lo"
    },
    {
      language: 'Czech',
      symbol: 'cs',
      text: 'Zadejte název hostitele databáze || Vyberte typ databáze SQL || Zadejte uživatelské jméno databáze || Zadejte heslo do databáze || Zadejte číslo portu databáze || Zadejte název databáze / schématu || Zadejte typ API pro generování || Jak to chcete spustit?'
    },
    {
      language: 'Estonian',
      symbol: 'et',
      text: 'Sisestage andmebaasi hosti nimi || Valige SQL-i andmebaasi tüüp || Sisestage andmebaasi kasutajanimi || Sisestage andmebaasi parool || Sisestage andmebaasi pordi number || Sisestage andmebaasi / skeemi nimi || Sisestage genereerimiseks API tüüp || Kuidas soovite seda käivitada'
    },
    {
      language: 'Lithuanian',
      symbol: 'lt',
      text: 'Įveskite duomenų bazės pavadinimą || Pasirinkite SQL duomenų bazės tipą || Įveskite duomenų bazės vartotojo vardą || Įveskite duomenų bazės slaptažodį || Įveskite duomenų bazės prievado numerį || Įveskite duomenų bazės / schemos pavadinimą || Norėdami sugeneruoti įveskite API tipą Kaip norite jį paleisti'
    },
    {
      language: 'Norwegian',
      symbol: 'no',
      text: 'Skriv inn databasens vertsnavn || Velg SQL Database type || Skriv inn brukernavn for databasen || Skriv inn databasepassordet || Skriv inn databaseportnummer || Skriv inn navnet på databasen / skjemaet || Angi API-type for å generere || Hvordan vil du kjøre den'
    },
    {
      language: 'Telugu',
      symbol: 'te',
      text: 'డేటాబేస్ హోస్ట్ పేరును నమోదు చేయండి || SQL డేటాబేస్ రకాన్ని ఎంచుకోండి || డేటాబేస్ వినియోగదారు పేరును నమోదు చేయండి || డేటాబేస్ పాస్వర్డ్ను నమోదు చేయండి || డేటాబేస్ పోర్ట్ సంఖ్యను నమోదు చేయండి || డేటాబేస్ / స్కీమా పేరును నమోదు చేయండి || ఉత్పత్తి చేయడానికి API రకాన్ని నమోదు చేయండి || మీరు దీన్ని ఎలా అమలు చేయాలనుకుంటున్నారు'
    },
    {
      language: 'Urdu',
      symbol: 'ur',
      text: 'ڈیٹا بیس کے میزبان کا نام درج کریں || ایس کیو ایل ڈیٹا بیس کی قسم منتخب کریں || ڈیٹا بیس کا صارف نام داخل کریں || ڈیٹا بیس پاس ورڈ درج کریں || ڈیٹا بیس پورٹ نمبر درج کریں || ڈیٹا بیس / اسکیمہ کا نام درج کریں || پیدا کرنے کے لئے API کی قسم درج کریں || آپ اسے کیسے چلانا چاہتے ہیں؟'
    },
    {
      language: 'Chinese Simplified',
      symbol: 'zh-cn',
      text: '输入数据库主机名||选择SQL数据库类型||输入数据库用户名||输入数据库密码||输入数据库端口号||输入数据库/方案名称||输入API类型以生成||您想如何运行它'
    },
    {
      language: 'Danish',
      symbol: 'da',
      text: 'Indtast databasens værtsnavn || Vælg SQL-databasetype || Indtast database brugernavn || Indtast adgangskode til databasen || Indtast databaseportnummer || Indtast database / skema navn || Indtast API-type for at generere || Hvordan vil du køre det'
    },
    {
      language: 'Filipino',
      symbol: 'tl',
      text: 'Ipasok ang pangalan ng host ng database || Piliin ang uri ng SQL Database || Ipasok ang username ng database || Ipasok ang database ng password || Ipasok ang numero ng port ng database || Ipasok ang pangalan ng database / schema || Ipasok ang uri ng API upang makabuo || Paano mo ito nais patakbuhin'
    },
    {
      language: 'Greek',
      symbol: 'el',
      text: 'Εισαγάγετε το όνομα κεντρικού υπολογιστή βάσης δεδομένων || Επιλέξτε τύπο βάσης δεδομένων SQL || Εισαγάγετε το όνομα χρήστη της βάσης δεδομένων || Εισαγάγετε τον κωδικό πρόσβασης βάσης δεδομένων || Εισαγάγετε τον αριθμό θύρας βάσης δεδομένων || Εισαγάγετε όνομα βάσης δεδομένων / σχήματος || Εισαγάγετε τον τύπο API για δημιουργία || Πώς θέλετε να το εκτελέσετε'
    },
    {
      language: 'Malay',
      symbol: 'ms',
      text: 'Masukkan nama host pangkalan data || Pilih jenis Pangkalan Data SQL || Masukkan nama pengguna pangkalan data || Masukkan kata laluan pangkalan data || Masukkan nombor port pangkalan data || Masukkan nama pangkalan data / skema || Masukkan jenis API untuk menghasilkan || Bagaimana anda mahu menjalankannya'
    },
    {
      language: 'Polish',
      symbol: 'pl',
      text: 'Wpisz nazwę hosta bazy danych || Wybierz typ bazy danych SQL || Wpisz nazwę użytkownika bazy danych || Wprowadź hasło do bazy danych || Wpisz numer portu bazy danych || Wpisz nazwę bazy danych / schematu || Wpisz typ API do wygenerowania || Jak chcesz to uruchomić'
    },
    {
      language: 'Serbian',
      symbol: 'sr',
      text: 'Унесите име хоста базе података || Изаберите тип базе података СКЛ || Унесите корисничко име базе података || Унесите лозинку базе података || Унесите број порта базе података || Унесите име базе података / шеме || Унесите тип АПИ-ја за генерисање || Како желите да га покренете'
    },
    {
      language: 'Swedish',
      symbol: 'sv',
      text: 'Ange databasvärdnamn || Välj SQL-databastyp || Ange databasens användarnamn || Ange databaslösenord || Ange databasportnummer || Ange databas / schemans namn || Ange API-typ för att generera || Hur vill du köra den'
    },
    {
      language: 'Thai',
      symbol: 'th',
      text: 'ป้อนชื่อโฮสต์ฐานข้อมูล || เลือกประเภทฐานข้อมูล SQL || ป้อนชื่อผู้ใช้ฐานข้อมูล || ป้อนรหัสผ่านฐานข้อมูล || ป้อนหมายเลขพอร์ตฐานข้อมูล || ป้อนฐานข้อมูล / ชื่อสคีมา || ป้อนประเภท API เพื่อสร้าง || คุณต้องการเรียกใช้อย่างไร'
    },
    {
      language: 'Bengali',
      symbol: 'bn',
      text: 'ডাটাবেস হোস্টের নাম প্রবেশ করান || এসকিউএল ডাটাবেস টাইপ চয়ন করুন || ডাটাবেস ব্যবহারকারীর নাম লিখুন || ডাটাবেস পাসওয়ার্ড প্রবেশ করান || ডাটাবেস পোর্ট নম্বর লিখুন || ডাটাবেস / স্কিমা নাম প্রবেশ করান || উত্পন্ন করতে এপিআই টাইপ লিখুন || আপনি এটি চালাতে চান কিভাবে'
    },
    {
      language: 'Chinese Traditional',
      symbol: 'zh-tw',
      text: '輸入數據庫主機名||選擇SQL數據庫類型||輸入數據庫用戶名||輸入數據庫密碼||輸入數據庫端口號||輸入數據庫/方案名稱||輸入API類型以生成||您想如何運行它'
    },
    {
      language: 'Finnish',
      symbol: 'fi',
      text: 'Syötä tietokannan isäntänimi || Valitse SQL-tietokannan tyyppi || Syötä tietokannan käyttäjänimi || Syötä tietokannan salasana || Syötä tietokannan porttinumero || Syötä tietokannan / skeeman nimi || Syötä API-tyyppi luodaksesi || Kuinka haluat suorittaa sen'
    },
    {
      language: 'Korean',
      symbol: 'ko',
      text: '데이터베이스 호스트 이름 입력 || SQL 데이터베이스 유형 선택 || 데이터베이스 사용자 이름 입력 || 데이터베이스 비밀번호를 입력하세요 || 데이터베이스 포트 번호를 입력하세요 || 데이터베이스 / 스키마 이름 입력 || 생성 할 API 유형을 입력하세요 || 어떻게 실행 하시겠습니까'
    },
    {
      language: 'Hebrew',
      symbol: 'iw',
      text: 'הזן את שם מארח מסד הנתונים || בחר סוג מסד נתונים של SQL || הזן את שם המשתמש של מסד הנתונים || הזן סיסמת מסד נתונים || הזן מספר יציאת מסד נתונים || הזן שם מסד נתונים / סכמה || הזן סוג API ליצירת || איך אתה רוצה להפעיל אותו'
    },
    {
      language: 'Malayalam',
      symbol: 'ml',
      text: 'ഡാറ്റാബേസ് ഹോസ്റ്റ് നാമം നൽകുക || SQL ഡാറ്റാബേസ് തരം തിരഞ്ഞെടുക്കുക || ഡാറ്റാബേസ് ഉപയോക്തൃനാമം നൽകുക || ഡാറ്റാബേസ് പാസ്‌വേഡ് നൽകുക || ഡാറ്റാബേസ് പോർട്ട് നമ്പർ നൽകുക || ഡാറ്റാബേസ് / സ്കീമ നാമം നൽകുക || ജനറേറ്റുചെയ്യാൻ API തരം നൽകുക || ഇത് എങ്ങനെ പ്രവർത്തിപ്പിക്കാൻ നിങ്ങൾ ആഗ്രഹിക്കുന്നു'
    },
    {
      language: 'Portuguese',
      symbol: 'pt',
      text: 'Insira o nome do host do banco de dados || Escolha o tipo de banco de dados SQL || Digite o nome de usuário do banco de dados || Digite a senha do banco de dados || Insira o número da porta do banco de dados || Insira o nome do banco de dados / esquema || Digite o tipo de API para gerar || Como você deseja executá-lo?'
    },
    {
      language: 'Slovak',
      symbol: 'sk',
      text: 'Zadajte názov hostiteľa databázy || Vyberte typ databázy SQL || Zadajte užívateľské meno databázy || Zadajte heslo do databázy || Zadajte číslo portu databázy || Zadajte názov databázy / schémy || Zadajte typ API na vygenerovanie || Ako to chcete spustiť'
    },
    {
      language: 'Tajik',
      symbol: 'tg',
      text: 'Номи ҳости пойгоҳи додаҳоро ворид кунед || Намуди пойгоҳи SQL-ро интихоб кунед || Номи корбари пойгоҳи додаҳоро ворид кунед || Пароли махзани маълумотро ворид кунед || Рақами порти базаи маълумотро ворид кунед || Номи пойгоҳи додаҳо / схемаро ворид кунед || Барои тавлиди || навъи API -ро ворид кунед Чӣ гуна шумо мехоҳед онро иҷро кунед'
    },
    {
      language: 'Turkish',
      symbol: 'tr',
      text: 'Veritabanı ana bilgisayar adını girin || SQL Veritabanı türünü seçin || Veritabanı kullanıcı adını girin || Veritabanı şifresini girin || Veritabanı port numarasını girin || Veritabanı / şema adını girin || Oluşturmak için API türünü girin || Onu nasıl çalıştırmak istersin'
    },
    {
      language: 'Vietnamese',
      symbol: 'vi',
      text: 'Nhập tên máy chủ cơ sở dữ liệu || Chọn kiểu cơ sở dữ liệu SQL || Nhập tên người dùng cơ sở dữ liệu || Nhập mật khẩu cơ sở dữ liệu || Nhập số cổng cơ sở dữ liệu || Nhập tên cơ sở dữ liệu / lược đồ || Nhập loại API để tạo || Bạn muốn chạy nó như thế nào'
    },
    {
      language: 'Bulgarian',
      symbol: 'bg',
      text: 'Въведете име на хост на базата данни || Изберете тип база данни на SQL || Въведете потребителско име на базата данни || Въведете парола за база данни || Въведете номера на порта на базата данни || Въведете име на база данни / схема || Въведете API тип, за да генерирате || Как искате да го стартирате'
    },
    {
      language: 'Croatian',
      symbol: 'hr',
      text: 'Unesite ime hosta baze podataka || Odaberite vrstu baze podataka SQL || Unesite korisničko ime baze podataka || Unesite lozinku baze podataka || Unesite broj porta baze podataka || Unesite naziv baze podataka / sheme || Unesite vrstu API-ja za generiranje || Kako to želite pokrenuti'
    },
    {
      language: 'Esperanto',
      symbol: 'eo',
      text: 'Enigu datumbazan gastigantan nomon || Elektu SQL-Datumbazan tipon || Enigu datumbazan uzantnomon || Enigu datumbazan pasvorton || Enigu datuman datumportan numeron || Enigu datumbazon / skeman nomon || Enigu API-tipon por generi || Kiel vi volas funkciigi ĝin'
    },
    {
      language: 'Indonesian',
      symbol: 'id',
      text: 'Masukkan nama host database || Pilih tipe Database SQL || Masukkan nama pengguna database || Masukkan kata sandi basis data || Masukkan nomor port database || Masukkan nama database / skema || Masukkan jenis API untuk menghasilkan || Bagaimana Anda ingin menjalankannya'
    },
    {
      language: 'Latvian',
      symbol: 'lv',
      text: 'Ievadiet datubāzes resursdatora nosaukumu || Izvēlieties SQL datu bāzes tipu || Ievadiet datubāzes lietotājvārdu || Ievadiet datu bāzes paroli || Ievadiet datubāzes porta numuru || Ievadiet datu bāzes / shēmas nosaukumu || Ievadiet API veidu, lai izveidotu || Kā jūs vēlaties to vadīt'
    },
    {
      language: 'Marathi',
      symbol: 'mr',
      text: 'डेटाबेस होस्ट नाव प्रविष्ट करा || एसक्यूएल डेटाबेस प्रकार निवडा || डेटाबेस वापरकर्तानाव प्रविष्ट करा || डेटाबेस संकेतशब्द प्रविष्ट करा || डेटाबेस पोर्ट क्रमांक प्रविष्ट करा || डेटाबेस / स्कीमा नाव प्रविष्ट करा || व्युत्पन्न करण्यासाठी एपीआय प्रकार प्रविष्ट करा || आपल्याला ते कसे चालवायचे आहे'
    },
    {
      language: 'Romanian',
      symbol: 'ro',
      text: 'Introduceți numele gazdei bazei de date || Alegeți tipul bazei de date SQL || Introduceți numele de utilizator al bazei de date || Introduceți parola bazei de date || Introduceți numărul portului bazei de date || Introduceți numele bazei de date / schemei || Introduceți tipul API pentru a genera || Cum vrei să-l rulezi'
    },
    {
      language: 'Slovenian',
      symbol: 'sl',
      text: 'Vnesite ime gostitelja baze podatkov || Izberite vrsto zbirke podatkov SQL || Vnesite uporabniško ime baze podatkov || Vnesite geslo baze podatkov || Vnesite številko vrat baze podatkov || Vnesite ime baze podatkov / sheme || Vnesite vrsto API-ja za ustvarjanje || Kako ga želite zagnati'
    },
    {
      language: 'Tamil',
      symbol: 'ta',
      text: 'தரவுத்தள ஹோஸ்ட் பெயரை உள்ளிடவும் || SQL தரவுத்தள வகையைத் தேர்வுசெய்க || தரவுத்தள பயனர்பெயரை உள்ளிடவும் || தரவுத்தள கடவுச்சொல்லை உள்ளிடவும் || தரவுத்தள போர்ட் எண்ணை உள்ளிடவும் || தரவுத்தளம் / ஸ்கீமா பெயரை உள்ளிடவும் || உருவாக்க API வகையை உள்ளிடவும் || அதை எவ்வாறு இயக்க விரும்புகிறீர்கள்'
    },
    {
      language: 'Ukrainian',
      symbol: 'uk',
      text: "Введіть ім'я хоста бази даних || Виберіть тип бази даних SQL || Введіть ім'я користувача бази даних || Введіть пароль бази даних || Введіть номер порту бази даних || Введіть назву бази даних / схеми || Введіть тип API для створення || Як ви хочете його запустити"
    },
    {
      language: 'Kannada',
      symbol: 'kn',
      text: 'ಡೇಟಾಬೇಸ್ ಹೋಸ್ಟ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ || SQL ಡೇಟಾಬೇಸ್ ಪ್ರಕಾರವನ್ನು ಆರಿಸಿ || ಡೇಟಾಬೇಸ್ ಬಳಕೆದಾರಹೆಸರನ್ನು ನಮೂದಿಸಿ || ಡೇಟಾಬೇಸ್ ಪಾಸ್ವರ್ಡ್ ಅನ್ನು ನಮೂದಿಸಿ || ಡೇಟಾಬೇಸ್ ಪೋರ್ಟ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ || ಡೇಟಾಬೇಸ್ / ಸ್ಕೀಮಾ ಹೆಸರನ್ನು ನಮೂದಿಸಿ || ಉತ್ಪಾದಿಸಲು API ಪ್ರಕಾರವನ್ನು ನಮೂದಿಸಿ || ನೀವು ಅದನ್ನು ಹೇಗೆ ಚಲಾಯಿಸಲು ಬಯಸುತ್ತೀರಿ'
    },
    {
      language: 'Hindi',
      symbol: 'hi',
      text: 'डेटाबेस होस्ट नाम दर्ज करें || SQL डेटाबेस प्रकार चुनें || डेटाबेस उपयोगकर्ता नाम दर्ज करें || डेटाबेस पासवर्ड दर्ज करें || डेटाबेस पोर्ट नंबर दर्ज करें || डेटाबेस / स्कीमा नाम दर्ज करें || बनाने के लिए एपीआई प्रकार दर्ज करें || आप इसे कैसे चलाना चाहते हैं'
    }]
  }),
  computed: {
    text() {
      const text = this.lang.find(it => it.symbol === this.$store.state.windows.language)
      return text ? text.text : 'default'
    },
    projectInfo() {
      return this.$store.state.project.projectInfo
    },
    message() {
      let message = this.defaultMessage

      if (this.projectInfo) {
        switch (this.projectInfo.authType) {
          case 'jwt':
            /* if (this.projectInfo.projectHasDb) { */
            message = // 'The Open Source Airtable alternative. <br/>' +
              'Turns any database into an Airtable like collaborative spreadsheet. <br/>'
            // +
            // 'Supports MySQL, PostgreSQL, MSSQL, SQLIte & MariaDB.';
            /*    } else {
                  message = 'Instantly generate REST APIs / GraphQL APIs / gRPC<br/> by connecting to any SQL database.'
                } */
            break
          /*          case 'masterKey':
                      if (this.projectInfo.projectHasDb) {
                        message = 'Looks like you configured databases. <br> Now it\'s time to authenticate via Master Key.';
                      } else {
                        message = 'Instantly generate REST APIs / GraphQL APIs / gRPC<br/> by connecting to any SQL database.'
                      }
                      break;
                    case 'none':
                      if (this.projectInfo.projectHasDb) {
                        message = 'Looks like you configured databases. <br> No authentication configured access dashboard.';
                      } else {
                        message = 'Instantly generate REST APIs / GraphQL APIs / gRPC<br/> by connecting to any SQL database.'
                      }
                      break; */
          default:
            break
        }
      }

      return message// `${message} <br><span class="caption">(Current Environment : ${this.projectInfo ? this.projectInfo.env : ''})</span>`;
    }
  },
  created() {
    const projectInfo = this.$store.state.project.projectInfo
    if (projectInfo) {
      if (this.$store.state.users.token || (projectInfo && projectInfo.authType === 'none')) {
        this.$router.replace('/projects')
        return
      } else if (projectInfo && projectInfo.projectHasAdmin) {
        this.$router.replace('/user/authentication/signin')
        return
      }
    }
    this.loading = false
  },
  mounted() {
    const handler = () => {
      this.moved = true
      if (this.typed && !/\bcode=/.test(window.location.search)) {
        document.removeEventListener('mousemove', handler)
        this.simpleAnim()
        // const int = setInterval(() => {
        //   if (++this.showAnimText === 3) clearInterval(int)
        // },2000) f
      }
    }
    document.addEventListener('mousemove', handler)
  },
  methods: {
    simpleAnim() {
      const count = 200
      const defaults = {
        origin: { y: 0.7 }
      }

      function fire(particleRatio, opts) {
        window.confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }))
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55
      })
      fire(0.2, {
        spread: 60
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45
      })
    },

    navigate() {
      if (this.projectInfo) {
        // if (!this.projectInfo.projectHasDb) {
        //   this.$router.push('/project/0')
        // } else
        if (this.projectInfo.projectHasAdmin === false) {
          return this.$router.push('/user/authentication/signup')
        }
      }
      this.$router.push('/projects')
    }
  }
}
</script>

<style scoped>

/deep/ .gh-button-container a {
  color: var(--v-grey-darken-1);
}

.text-h2 {
  line-height: 5rem;
}

.logos img {
  height: 40px;
  margin: 0 20px;
  /*filter: grayscale(1);*/
}

@keyframes wave {
  0% {
    margin-top: 0;
  }
  50% {
    margin-top: -20px;
  }
  100% {
    margin-top: 0px;
  }
}

.logos {
  min-height: 60px;
  padding-top: 20px;

}

.logos img {
  animation: wave 3s infinite;
}

.logos img:nth-child(2) {
  animation-delay: .3s;
}

.logos img:nth-child(3) {
  animation-delay: .6s;
}

.logos img:nth-child(4) {
  animation-delay: .9s;
}

.logos img:nth-child(5) {
  animation-delay: 1.2s;
}

.logos img:nth-child(6) {
  animation-delay: 1.5s;
}

/deep/ .typed {
  color: var(--v-textColor--lighten-1);
}

.welcome-msg {
  line-height: 7rem;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
