<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ La alternativa open-source de Airtable ✨ <br>

</h1>
<p align="center">
Convierte cualquier MySQL, PostgreSQL, SQL Server, SQLite y Mariadb en una hoja de cálculo inteligente. 
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
    <a href="https://docs.nocodb.com/"><b>Documentación</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# Prueba rápida

### Usando docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB necesita de una base de datos previamente creada: Leer [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Para habilitar datos no efímeros se puede usar `/usr/app/data/`.

  Ejemplo:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Usando npx.

```
npx create-nocodb-app
```

### Usando git.

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Para accesar al dashboard: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Únete a nuestra comunidad

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Capturas de pantalla

![1](https://user-images.githubusercontent.com/86527202/136071158-4eaf1670-085e-435b-a2ef-cd7a90241ad4.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136071168-eb20d405-0b98-43ed-9033-510fbe8d87ab.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136071175-d28d33a1-4ffe-4d50-ad22-cf4787d98ae1.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136071177-911285df-f0ea-4b52-a17b-63421c6d2129.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136071180-99c3400b-9674-4124-9618-3273c4099d59.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136071183-40005b11-727f-4f11-b6b5-402900e33d14.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136071185-3ee9c9ad-b6e9-4579-aad8-55a76c2eb1b3.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136071188-61fc67a0-56bb-48a0-8984-f3860d52d572.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136071193-7b7da5cd-c0b3-4258-81c6-35c485cd69da.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136071197-6914e6ef-4a27-49a8-be27-72abae5c595b.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136071198-ea7994a7-82ca-4d2a-9026-71cdc38883b4.png)
<br>

# Características

### Atractiva interfaz de hoja de cálculo

- ⚡ Operaciones Básicas: Crear, Leer, Actualizar y Borrar en Tablas, Columnas y Filas
- ⚡ Operaciones en Celdas: Ordenar, Filtrar, Ocultar / Mostrar Columnas
- ⚡ Multiples Tipos de Vistas: Cuadrícula (Por defecto), Galería y Forma
- ⚡ Tipos de Permisos para Ver: Vistas Colaborativas y Vistas Privadas
- ⚡ Comparte Bases / Vistas: Públicas o Privadas (Protegidas con contraseña)
- ⚡ Variaciones de Tipos de Celda: ID, Acceso a otra celda, Búsqueda, Acumulación, Texto de una sola línea, Archivo adjunto, Divisa, Fórmula, etc.
- ⚡ Control de acceso con Roles: Control de acceso granular en diferentes niveles
- ⚡ y más ...

### App Store para Automatización de Flujos de Trabajo:
Proveemos diferentes integraciones en tres categorías principales. Ver <a href="https://docs.nocodb.com/setup-and-usages/app-store" target="_blank">App Store</a> para más detalles.

- ⚡ Chat: Slack, Discord, Mattermost, etc.
- ⚡ Correo electrónico: AWS SES, SMTP, MailerSend, etc.
- ⚡ Almacenamiento: AWS S3, Google Cloud Storage, Minio, etc.

### Acceso Programático
Proveemos las siguientes maneras para dejar que los usuarios puedan invocar acciones a través de la programación. Puedes usar un token (JWT o Auth Social) para firmar tus solicitudes de autorización a NocoDB.

- ⚡ REST APIs
- ⚡ NocoDB SDK

# Configruación para Entorno de Producción:

Nocodb requiere una base de datos para almacenar metadatos de vistas a las hojas de cálculo y bases de datos externas. Y los parámetros de conexión para esta base de datos se pueden especificar en la variable de entorno NC_DB.

## Docker

#### Ejemplo MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Ejemplo Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Ejemplo SQL Server

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

## Variables de entorno

Por favor diríjase a [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)

# Configuración de desarollo

Por favor diríjase a [Development Setup](https://github.com/nocodb/nocodb/tree/master#development-setup)

# Contribuciones

Por favor diríjase a [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Por qué estamos construyendo esto?

La mayoría de las empresas de Internet emplean una hoja de cálculo o una base de datos para resolver sus necesidades comerciales. Las hojas de cálculo son utilizadas por billones de personas o más de manera colaborativa todos los días. Sin embargo, estamos lejos de trabajar a velocidades similares en bases de datos, ya que son herramientas computacionalmente más poderosas. Los intentos de resolver esto con soluciones SaaS han significado horribles controles de acceso, dependencia de un proveedor, dependencia de datos, cambios abruptos de precios y lo que es más importante, un techo de cristal sobre lo que es posible en el futuro."

# Nuestra misión

Nuestra misión es proporcionar la interfaz sin-código más potente para bases de datos, la cual es open-source para negocios de Internet en el mundo. Esto no solo democratizaría el acceso a una poderosa herramienta de computación, sino que también producirá a billones de personas o más con habilidades radicales de perfección y construcción en Internet."
