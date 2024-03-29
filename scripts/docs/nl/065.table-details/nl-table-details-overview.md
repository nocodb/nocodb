***

title: 'Overzicht tabeldetails'
omschrijving: 'Overzicht tabeldetails'
tags: \['Tabeldetails', 'Tabel', 'Overzicht']
trefwoorden: \['tabeldetails', 'tabeloverzicht', 'tabel']
---------------------------------------------------------

`Table Details`sectie bevat verschillende tools en hulpprogramma's om uw tabelschema en gegevens te beheren en ermee te werken. Dit is in wezen een plek voor 'Creators' om hun tabellen snel te bouwen en te beheren.`Details`sectie is toegankelijk via de`Data-Details`tuimelschakelaar in de bovenste navigatiebalk.

![image](/img/v2/table-details/details-tab.png)

Dit gedeelte is verdeeld in 4 delen:

## Velden

Fields is een tabelschema-editor met meerdere velden waarmee u velden snel en eenvoudig vanaf één plek kunt toevoegen, bewerken, verwijderen en opnieuw ordenen. Aanvullende details over de multi-veldeditor zijn te vinden[hier](/fields/multi-fields-editor)

![image](/img/v2/table-details/details-field-editor.png)

## Relaties

[//]: # "Table will have relations with other tables. As the schema gets bigger, it becomes difficult to keep track of all the relations. This section provides a quick overview of all the relations that a table has using a visual graph as `Entity Relationship Diagram`. "

Relaties zijn essentieel voor het beheren van gegevensverbindingen in een database. In een complex schema is het essentieel om een ​​duidelijk inzicht te hebben in deze verbanden, omdat ze:

1. Handhaaf de nauwkeurigheid van de gegevens.
2. Verbeter de efficiëntie van zoekopdrachten.
3. Hulp bij logisch schemaontwerp.
4. Ondersteuning van data-analyse.
5. Zorg voor een goede applicatieontwikkeling.

Het visualiseren van deze relaties via een Entity Relationship Diagram (ERD) vereenvoudigt het begrip en het beheer ervan, vooral naarmate de database steeds complexer wordt.

![image](/img/v2/table-details/details-relations.png)

:::opmerking
U kunt de tabellen slepen en neerzetten om ze opnieuw in het diagram te rangschikken. Houd er rekening mee dat een dergelijke herschikking niet tussen sessies zal blijven bestaan.
:::

## API-fragment

NocoDB biedt programmatische toegang tot uw gegevens via REST API's. API-fragmenten in NocoDB bieden kant-en-klare codevoorbeelden in verschillende programmeertalen, waardoor het proces van het integreren van uw gegevens met externe applicaties wordt vereenvoudigd. Deze fragmenten besparen tijd en moeite door ontwikkelaars een snelle en gemakkelijke referentie te bieden, waardoor ze programmatisch met uw NocoDB-database kunnen communiceren zonder dat ze helemaal opnieuw code hoeven te schrijven.

In deze sectie vindt u korte fragmenten voor verschillende scripts en talen.

![image](/img/v2/table-details/details-api-snippet.png)

### Voorbeeldfragmenten

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

## Ondersteund fragment

### Schelp

* Krul
* wget

### Javascript

* Axios
* Ophalen
* jQuery
* XHR

### Knooppunt

* Axios
* Ophalen
* Verzoek
* Oorspronkelijk
* Hij was verenigd

### NocoDB-SDK

* Javascript
* Knooppunt

### PHP

### Python

* http.client
* verzoek

### Robijn

### Java

### C

## Webhook

Webhooks zijn essentieel voor realtime communicatie en automatisering tussen NocoDB en externe systemen. Ze dienen verschillende cruciale doelen:

1. **Directe meldingen:**Webhooks maken directe meldingen mogelijk wanneer er wijzigingen plaatsvinden in uw NocoDB-database. Deze realtime informatie kan van cruciaal belang zijn voor tijdige reacties op belangrijke gebeurtenissen, zoals nieuwe gegevensinvoer, updates of verwijderingen.

2. **Automatisering:**Ze vergemakkelijken de automatisering van processen door acties in externe systemen te activeren op basis van databasegebeurtenissen. U kunt bijvoorbeeld taken automatiseren zoals het verzenden van e-mails, het bijwerken van spreadsheets of het synchroniseren van gegevens met andere applicaties als reactie op wijzigingen in NocoDB.

3. **Integratie:**Met Webhooks kunt u NocoDB naadloos integreren met andere tools en services, waardoor de algehele functionaliteit van uw database wordt verbeterd. Deze integratie kan workflows stroomlijnen, de gegevensconsistentie verbeteren en handmatige gegevensinvoer verminderen.

4. **Bulkoperaties:**De ondersteuning van NocoDB voor webhooks in bulkeindpunten maakt het efficiënt om meerdere records tegelijkertijd te verwerken. Dit is vooral handig als u met grote gegevenssets werkt of als u batchbewerkingen in externe systemen moet uitvoeren.

Samenvattend stellen webhooks in NocoDB u in staat dynamische, responsieve en onderling verbonden workflows te creëren door externe systemen gesynchroniseerd te houden met de activiteiten van uw database.

![image](/img/v2/table-details/details-webhook.png)

Houd er rekening mee dat webhooks momenteel specifiek zijn voor de bijbehorende tabel. Aanvullende procedurele details over webhooks zijn te vinden[hier](/automation/webhook/webhook-overview)
