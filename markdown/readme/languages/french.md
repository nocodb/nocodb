<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ L'alternative Open Source Airtable ✨ <br>

</h1>
<p align="center">
Transformez n'importe quel MySQL, PostgreSQL, SQL Server, SQLite & Mariadb en un tableur intelligent. 
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


# Essayez rapidement

### Utilisez Docker
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB a besoin d'une base de données en entrée : Voir [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Si cette entrée est absente, nous utiliserons SQLite. Afin de conserver Sqlite, vous pouvez rentrer l'information `/usr/app/data/`. 

  Exemple:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```
> Pour conserver les données, vous pouvez installer le volume dans `/usr/app/data/`.

### En utilisant git
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Accès au tableau de bord en utilisant : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# Rejoignez notre communauté
<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Captures d'écran

![1](https://user-images.githubusercontent.com/86527202/136067515-bafd7adb-3d2e-4754-8b74-6c57d1b04f8f.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136067525-e5a1efa2-89f1-47ff-96d0-02277918a06f.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136067548-417c2c79-bd25-4285-8f00-5aed432a8f9e.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136067552-8f92faae-fb77-45bb-9623-ef0958d36d99.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136067564-16506f90-6e6c-44fb-9d51-385f68f4c815.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136067570-cced6754-014d-4d3d-95e8-419a2d4c6b61.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136067579-4709a787-8649-4d5d-8318-0f867e80a2f3.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136067581-f6887c21-4daa-44c8-aaac-9408bb29858c.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136067584-cfd45081-79f3-44e1-979f-1408c9f1aee5.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136067590-95ba64fd-3dfb-4d0b-9a6f-8906128f0455.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136067593-dcf7d768-4f4e-4841-8384-629a35daa356.png)
<br>

# Caractéristiques
### Interface de feuille de calcul riche

- ⚡ Recherche, trier, filtrer, masquer les colonnes avec facilité
- ⚡ Créer des vues: grille, galerie, kanban, forme
- ⚡ Partager des vues: Publique ou Protégé par mot de passe 
- ⚡ Vues personnelles et verrouillées 
- ⚡ Télécharger des images sur les cellules (fonctionne avec S3, Minio, GCP, Azure, DigitalOcean, Linode, Ovh, Backblaze) !!
- ⚡ Rôles: propriétaire, créateur, éditeur, commentateur, spectateur, commentateur, rôles personnalisés.
- ⚡ Contrôle d'accès: contrôle d'accès à grain fin, même à la base de données, au niveau de la table et de la colonne.

### App Store for Workflow Automation

Nous proposons différentes intégrations dans trois catégories principales. Voir <a href="https://docs.nocodb.com/setup-and-usages/app-store" target="_blank">l'App Store</a> pour plus de détails.

- ⚡ Chat: Slack, Discord, Mattermost, Microsoft Teams, WhatsApp, etc
- ⚡ Email: AWS SES, SMTP, MailerSend, etc
- ⚡ SMS: Twilio
- ⚡ Stockage : AWS S3, Google Cloud Storage, Minio, etc

### Accès à l'API via

Nous proposons les moyens suivants pour permettre aux utilisateurs d'invoquer des actions de manière programmée. Vous pouvez utiliser un jeton (soit JWT ou Social Auth) pour valider vos demandes d'autorisation à NocoDB. 

- ⚡ REST API
- ⚡ NocoDB SDK

# Configuration de la production 
NocoDB nécessite une base de données pour stocker les métadonnées des vues des feuilles de calcul et des bases de données externes. Et les paramètres de connexion pour cette base de données peuvent être spécifiés dans la variable d'environnement `NC_DB`. 

## Docker 


#### Exemple Postgres
```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```


## Docker Compose
```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd pg 
docker-compose up -d
```

## Variables d'environnement

Veuillez vous référer aux [Variables d'environnement](https://docs.nocodb.com/getting-started/self-hosted/environment-variables)

# Paramétrage du développement

Veuillez vous référer au [Paramétrage du développement](https://docs.nocodb.com/engineering/development-setup)

# Contribuer

Veuillez vous référer au [Guide des contributions](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Pourquoi construisons-nous cela?
La plupart des entreprises Internet s'équipent d'un tableur ou d'une base de données pour répondre à leurs besoins commerciaux. Les feuilles de calcul sont utilisées par plus d'un milliard d'humains en collaboration chaque jour. Cependant, nous sommes loin de travailler à des vitesses similaires sur des bases de données qui sont des outils beaucoup plus puissants en matière de calcul. Les tentatives pour résoudre ce problème avec les offres SaaS ont entraîné des contrôles d'accès horribles, le verrouillage des fournisseurs, le verrouillage des données, des changements de prix brusques et, surtout, un plafond de verre sur ce qui est possible à l'avenir.

# Notre mission
Notre mission est de fournir l'interface sans code la plus puissante pour les bases de données qui soit open source pour chaque entreprise Internet dans le monde. Cela démocratiserait non seulement l'accès à un outil informatique puissant, mais ferait également émerger plus d'un milliard de personnes qui auront des capacités radicales de bricolage et de construction sur Internet. 
