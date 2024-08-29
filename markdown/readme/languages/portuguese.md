<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
      ✨ Alternativa do Airtable em código aberto ✨ 
    <br>
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

# Comece rapidamente

### Usando o Docker.

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```
- NocoDB precisa de um banco de dados como entrada : Veja [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Se a entrada não existir, nós voltamos para o SQLite. Para que SQLite também persista, você pode monta-lo em `/usr/app/data/`. 

  Exemplo:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```


### GUI

Acesse o painel usando: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Junte-se a nossa comunidade

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Screenshots (Capturas de Tela)

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

### Rica Interface de Planilha

- ⚡ Operações básicas: Criar, Ler, Atualizar e Deletar Tabelas, Colunas e Linhas<i>(Rows)</i>
- ⚡ Operação de campos: Sort, Filtro, Esconder / Mostrar Colunas
- ⚡ Multíplos tipos de visualização: Grade (Por padrão), Galeria, Visualização por Formulário e Visualização por Kanban
- ⚡ Visualização por tipos de permissão: Colabarativo e Bloqueados
- ⚡ Bases de compartilhamento / Visualizaç~eos: Tantao pública, quanto privada (com proteção por senha)
- ⚡ Variantes por tipos de células: D, LinkToAnotherRecord, Lookup, Rollup, SingleLineText, Attachment, Currency, Formula, etc
- ⚡ Controle de Acesso por Funções: controle de acesso detalhado em diferentes níveis
- ⚡ E mais...

### App Store para fluxo de automoção:
Nós fornecemos difernetes tipos de integração na árvore principal de categórias. Veja [AppStore](https://docs.nocodb.com/account-settings/oss-specific-details/#app-store) para mais detalhes.

- ⚡ Bate-papo: Discord, Mattermost e outros
- ⚡ Email: AWS SES, SMTP, MailerSend e outros
- ⚡ Armazenamento: AWS S3, Google Cloud Storage, Minio e outros

### Acesso Pragmático:
Nós forncemos as seguintes formas de deixar pragmaticamente seus usuários executar ações. Você pode usar um <i>token</i> (tanto JWT ou Autenticação por Rede Social) para assinar suas requisições de autorização para o NocoDB.

- ⚡ APIs Rest
- ⚡ NocoDB SDK

# Configuração de ambiente de Produção

Por padrão, o SQLite é usado para armazenar metadados(metadata). Todavia, você pode específicar seu banco de dados. Os parametros de conexão com o banco de dados podem serem feitas usando a variável de ambiente `NC_DB`. E também disponibilizamos variáveis de ambientes para configuração.

## Docker

#### Example Postgres

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

## Variáveis de Ambiente

Por favor, consultar em [Variáveis de Ambiente](https://docs.nocodb.com/getting-started/self-hosted/environment-variables)

# Configuração de Ambiente de Desenvolvimento

Por favor, consultar em [Ambiente de Desenvolvimento](https://docs.nocodb.com/engineering/development-setup)

# Guia de Contribuição

Por favor, consultar em [Guia de Contribuição](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Por que estamos construindo isso?

A maioria das empresas da internet equipam-se tanto com panilhas ou banco de dados para solucionar as necessidades de seus negócios.
Planilhas são usadas por mais de bilhões de humanos colaborativamente todos os dias.<br/> Contudo, nós estamos alguns passos atrás de atingir velocidades similares em bancos de dados - que são ferramentas poderosas - quando se trata de computação.
As tentaivas de solucionar isto oferecendo um SaaS vem significando controles de acesso horríveis, <i>vendor lock-in</i>, <i>data lock-in</i>, preços abruptos que mudam e o mais importante, um teto de vidro sobre o que é o possível futuro.

# Nossa missão

Nossa missão é fornecer uma ferramenta com uma interface <i>no-code</i> poderosa e com banco de dados que é código aberto para todos os tipos de negócios no mundo.<br/>
Isto não somente para democratizar o acesso para uma computação poderosa, mas também trazer mais de quatro bilhões de pessoas que têm habilidades mais radicais em <i>"consertar e construir"</i> na internet.

# Licença

Este projeto está sobre a licença de [AGPLv3](https://github.com/nocodb/nocodb/blob/develop/LICENSE).