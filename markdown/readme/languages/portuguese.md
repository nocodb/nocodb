<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ A alternativa de opção de fonte aberta✨ <br>

</h1>
<p align="center">
Transforma qualquer MySQL, PostgreSQL, SQL Server, Sqlite e MariaDB em uma planilha inteligente. 
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

# Experimente rápida

### Usando o Docker.

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- If this input is absent, we fallback to SQLite. In order too persist sqlite, you can mount `/usr/app/data/`. 

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Usando npx.

```
npx create-nocodb-app
```

### Usando o git.

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Acessar o painel usando: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Junte-se a nossa comunidade

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Screenshots

![1](https://user-images.githubusercontent.com/86527202/136070349-cacc406d-9efe-406f-9aa2-1b81564332a7.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136070360-706a4976-c4c9-4fde-b66c-73b54199799a.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136070372-08c34b1a-9ecf-4486-b6db-23b2dc135afa.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136070375-337a5d77-7b97-496d-9634-e8d86014b357.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136070379-159bb1b7-0f36-46c6-a6ea-b1f8a3cb0568.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136070385-de1c34b3-0ecd-4127-8706-32fbd8675cb2.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136070398-24abb3d4-a76f-4c45-979e-9ef93691bc7f.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136070405-5809d0c9-9280-4935-8d98-105f37f898a7.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136070410-09ae3f18-95d0-40f1-b525-b05f888573ff.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136070414-0ea0890f-734c-473c-977b-bbf46a812557.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136070417-7fd60c3b-8dd2-4cdb-a6dd-1eec80e636ac.png)
<br>

# Recursos

### Interface de planilha rica

- ⚡ Pesquisar, classificar, filtrar, esconder colunas com uber facilidade
- ⚡ Criar visualizações: Grade, Galeria, Kanban, Formulário
- ⚡ Compartilhar Visualizações: Public & Senha Protegido
- ⚡ Vistas pessoais e bloqueadas
- ⚡ Carregar imagens para as células (funciona com S3, Minio, GCP, Azure, Digitalocean, Linodo, OVH, Backblaze) !!
- ⚡ Funções: proprietário, criador, editor, comentarista, visualizador, comentador, funções personalizadas.
- ⚡ Controle de acesso: controle de acesso fino, mesmo no banco de dados, no nível da tabela e da coluna.

### App Store for Workflow Automations:

- ⚡ Bate-papo: Equipes Microsoft, folga, discórdia, material
- ⚡ Email: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ whatsapp.
- ⚡ Qualquer APIs da 3ª parte

### Acesso programático da API via:

- ⚡ repouso APIs (Swagger)
- ⚡ APIs GraphQl.
- ⚡ Inclui autenticação JWT e autenticação social
- ⚡ Tokens de API para integrar com Zapier, integromat.

# Production Setup

O NOCODB requer um banco de dados para armazenar metadados de exibições de planilhas e bancos de dados externos. E parâmetros de conexão para este banco de dados podem ser especificados na variável de ambiente NC_DB.

## Docker

#### Example MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example SQL Server

```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose

```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## Environment variables

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)

# Development setup

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup)

# Contributing

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Por que estamos construindo isso?

A maioria das empresas da Internet equipar-se com a planilha ou um banco de dados para resolver suas necessidades de negócios. Planilhas são usadas por um bilhão de seres humanos colaborativamente todos os dias. No entanto, estamos longe de trabalhar em velocidades semelhantes em bancos de dados que são muito mais poderosas ferramentas quando se trata de computação. As tentativas de resolver isso com ofertas de SaaS significam controles de acesso horríveis, lockin do fornecedor, lockin de dados, alterações abruptas de preços e mais importante, um teto de vidro no futuro.

# Nossa missão

Nossa missão é fornecer a mais poderosa interface de código para bancos de dados que é fonte aberta para cada negócio de Internet no mundo. Isso não apenas democratizaria o acesso a uma poderosa ferramenta de computação, mas também produzirá um bilhão de pessoas que terão habilidades radicais de corda e construção na Internet."
