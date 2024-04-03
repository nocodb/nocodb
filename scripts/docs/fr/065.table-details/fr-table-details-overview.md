***

title: 'Aperçu des détails du tableau'
description: 'Aperçu des détails du tableau'
balises : \['Détails du tableau', 'Tableau', 'Aperçu']
mots-clés : \['détails du tableau', 'aperçu du tableau', 'tableau']
-------------------------------------------------------------------

`Table Details`La section abrite divers outils et utilitaires pour gérer et travailler avec votre schéma et vos données de table. Il s'agit essentiellement d'un endroit permettant aux « créateurs » de créer et de gérer rapidement leurs tables.`Details`La section est accessible via le`Data-Details`basculez le commutateur dans la barre de navigation supérieure.

![image](/img/v2/table-details/details-tab.png)

Cette section est divisée en 4 parties :

## Des champs

Fields est un éditeur de schéma de table multi-champs qui vous permet d'ajouter, de modifier, de supprimer et de réorganiser les champs rapidement et facilement à partir d'un seul endroit. Des détails supplémentaires sur l'éditeur multi-champs peuvent être trouvés[ici](/fields/multi-fields-editor)

![image](/img/v2/table-details/details-field-editor.png)

## Rapports

[//]: # "Table will have relations with other tables. As the schema gets bigger, it becomes difficult to keep track of all the relations. This section provides a quick overview of all the relations that a table has using a visual graph as `Entity Relationship Diagram`. "

Les relations sont vitales pour gérer les connexions de données dans une base de données. Dans un schéma complexe, il est essentiel de bien comprendre ces connexions car elles :

1. Maintenir l’exactitude des données.
2. Améliorez l’efficacité des requêtes.
3. Aide à la conception de schémas logiques.
4. Prise en charge de l'analyse des données.
5. Permettre le développement approprié d’applications.

Visualizing these relations through an Entity Relationship Diagram (ERD) simplifies their comprehension and management, especially as the database grows in complexity.

![image](/img/v2/table-details/details-relations.png)

:::note
Vous pouvez faire glisser les tableaux pour les réorganiser dans le diagramme. Notez que cette réorganisation ne persistera pas d’une session à l’autre.
:::

## Extrait d'API

NocoDB fournit un accès programmatique à vos données via les API REST. Les extraits d'API de NocoDB offrent des exemples de code prêts à l'emploi dans divers langages de programmation, simplifiant ainsi le processus d'intégration de vos données avec des applications externes. Ces extraits permettent d'économiser du temps et des efforts en fournissant une référence rapide et simple aux développeurs, leur permettant d'interagir avec votre base de données NocoDB par programmation sans avoir besoin d'écrire du code à partir de zéro.

Des extraits rapides pour différents scripts et langages sont répertoriés dans cette section.

![image](/img/v2/table-details/details-api-snippet.png)

### Exemples d'extraits

<Tabs>
<TabItem value="Shell" label="Shell">

```bash
curl --request GET \
  --url 'http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=' \
  --header 'xc-auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU'
```

</TabItem>
<TabItem value="Javascript" label="Javascript">

```bash
import axios from "axios";

const options = {
  method: 'GET',
  url: 'http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer',
  params: {offset: '0', limit: '25', where: ''},
  headers: {
    'xc-auth': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU'
  }
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

</TabItem>
<TabItem value="Node" label="Node">

```bash
var axios = require("axios").default;

var options = {
  method: 'GET',
  url: 'http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer',
  params: {offset: '0', limit: '25', where: ''},
  headers: {
    'xc-auth': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU'
  }
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```

</TabItem>
<TabItem value="NocoDB SDK" label="NocoDB SDK">

```bash
import { Api } from "nocodb-sdk";
const api = new Api({
  baseURL: "http://localhost:8080",
  headers: {
    "xc-auth": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU"
  }
})

api.dbViewRow.list(
  "noco",
  "ExternalDB",
  "Customer",
  "Customer", {
    "offset": 0,
    "limit": 25,
    "where": ""
}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});
```

</TabItem>
<TabItem value="PHP" label="PHP">

```bash
<?php

$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_PORT => "8080",
  CURLOPT_URL => "http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "GET",
  CURLOPT_HTTPHEADER => [
    "xc-auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU"
  ],
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
}
```

</TabItem>
<TabItem value="Python" label="Python">

```bash
import http.client

conn = http.client.HTTPConnection("localhost:8080")

headers = { 'xc-auth': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU" }

conn.request("GET", "/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=", headers=headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
```

</TabItem>
<TabItem value="Ruby" label="Ruby">

```bash
require 'uri'
require 'net/http'

url = URI("http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=")

http = Net::HTTP.new(url.host, url.port)

request = Net::HTTP::Get.new(url)
request["xc-auth"] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU'

response = http.request(request)
puts response.read_body
```

</TabItem>
<TabItem value="Java" label="Java">

```bash
HttpResponse<String> response = Unirest.get("http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=")
  .header("xc-auth", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU")
  .asString();
```

</TabItem>
<TabItem value="C" label="C">

```bash
CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "GET");
curl_easy_setopt(hnd, CURLOPT_URL, "http://localhost:8080/api/v1/db/data/noco/p18h72lcfwzpsvu/Customer/views/Customer?offset=0&limit=25&where=");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "xc-auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImRpc3BsYXlfbmFtZSI6IlJpY2hhcmQiLCJhdmF0YXIiOm51bGwsInVzZXJfbmFtZSI6bnVsbCwiaWQiOiJ1c3ExbGNpeWp4ejh5bzY4Iiwicm9sZXMiOnsib3JnLWxldmVsLXZpZXdlciI6dHJ1ZX0sInRva2VuX3ZlcnNpb24iOiI0ZjUyOTUxZGQwOTZmMTVjMTY0Y2U5MDM1OTk1YzlmMDE1MTJjMGNjOThkYmRiMDU2ZmFhM2JhZWE1OWY4Y2QzMTcyN2FjOWZkMTJjNDA2ZiIsImlhdCI6MTY5NTk5MTg0NywiZXhwIjoxNjk2MDI3ODQ3fQ.I7P5caoiDSO4j_3D032XxWxxXwyEju6pL5y3Mnu_MNU");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

CURLcode ret = curl_easy_perform(hnd);
```

</TabItem>
</Tabs>

## Extrait pris en charge

### Coquille

* boucle
* wget

### Javascript

* Axios
* Aller chercher
* jQuery
* XHR

### Nœud

* Axios
* Aller chercher
* Demande
* Indigène
* Il était uni

### Kit de développement logiciel NocoDB

* Javascript
* Nœud

### PHP

### Python

* http.client
* demande

### Rubis

### Java

### C

## Webhook

Les webhooks sont essentiels pour la communication et l'automatisation en temps réel entre NocoDB et les systèmes externes. Ils remplissent plusieurs objectifs cruciaux :

1. **Instant Notifications:**Les webhooks permettent des notifications immédiates en cas de modifications dans votre base de données NocoDB. Ces informations en temps réel peuvent être cruciales pour réagir rapidement aux événements importants, tels que les nouvelles entrées de données, les mises à jour ou les suppressions.

2. **Automatisation:**Ils facilitent l'automatisation des processus en déclenchant des actions dans des systèmes externes en fonction des événements de la base de données. Par exemple, vous pouvez automatiser des tâches telles que l'envoi d'e-mails, la mise à jour de feuilles de calcul ou la synchronisation de données avec d'autres applications en réponse aux modifications apportées à NocoDB.

3. **L'intégration:**Les webhooks vous permettent d'intégrer de manière transparente NocoDB à d'autres outils et services, améliorant ainsi la fonctionnalité globale de votre base de données. Cette intégration peut rationaliser les flux de travail, améliorer la cohérence des données et réduire la saisie manuelle des données.

4. **Opérations groupées :**La prise en charge par NocoDB des webhooks dans les points de terminaison en masse permet de gérer efficacement plusieurs enregistrements simultanément. Ceci est particulièrement utile lorsque vous traitez de grands ensembles de données ou lorsque vous devez effectuer des opérations par lots dans des systèmes externes.

En résumé, les webhooks de NocoDB vous permettent de créer des flux de travail dynamiques, réactifs et interconnectés en gardant les systèmes externes synchronisés avec les activités de votre base de données.

![image](/img/v2/table-details/details-webhook.png)

Notez que les Webhooks sont actuellement spécifiques à la table associée. Des détails de procédure supplémentaires sur les webhooks peuvent être trouvés[ici](/automation/webhook/webhook-overview)
