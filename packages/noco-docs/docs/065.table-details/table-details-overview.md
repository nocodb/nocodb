---
title: 'Table details overview'
description: 'Table details overview'
tags: ['Table details', 'Table', 'Overview']
keywords: ['table details', 'table overview', 'table']
---

`Table Details` section houses various tools & utilities to manage & work with your table schema & data. This essentially is a place for 'Creators' to build & manage their tables quickly. `Details` section is accessible using the `Data-Details` toggle switcher in the top navbar. 

![image](/img/v2/table-details/details-tab.png)

This section is divided into 4 parts:

## Fields
Fields is a multi-field table schema editor that allows you to add, edit, delete and reorder fields quickly & easily from one place. Additional details about multi-field editor can be found [here](/fields/multi-fields-editor)

![image](/img/v2/table-details/details-field-editor.png)

## Relations

[//]: # (Table will have relations with other tables. As the schema gets bigger, it becomes difficult to keep track of all the relations. This section provides a quick overview of all the relations that a table has using a visual graph as `Entity Relationship Diagram`. )

Relations are vital for managing data connections in a database. In a complex schema, it's essential to have a clear understanding of these connections because they:

1. Maintain data accuracy.
2. Enhance query efficiency.
3. Aid in logical schema design.
4. Support data analysis.
5. Enable proper application development.

Visualizing these relations through an Entity Relationship Diagram (ERD) simplifies their comprehension and management, especially as the database grows in complexity.

![image](/img/v2/table-details/details-relations.png)

:::note
You can drag drop the tables to rearrange them in the diagram. Note that, such reordering will not persist across sessions.
:::


## API Snippet

NocoDB provides programmatic access to your data via REST APIs. API snippets in NocoDB offer ready-made code examples in various programming languages, simplifying the process of integrating your data with external applications. These snippets save time and effort by providing a quick and easy reference for developers, enabling them to interact with your NocoDB database programmatically without the need to write code from scratch.

A quick snippet for different scripts & languages is listed in this section.

![image](/img/v2/table-details/details-api-snippet.png)

### Sample snippets

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


## Supported Snippet

### Shell
- cURL
- wget

### Javascript
- Axios
- Fetch
- jQuery
- XHR

### Node
- Axios
- Fetch
- Request
- Native
- Unirest

### NocoDB SDK
- Javascript
- Node

### PHP
### Python
- http.client
- request

### Ruby
### Java
### C

## Webhook

Webhooks are essential for real-time communication and automation between NocoDB and external systems. They serve several crucial purposes:

1. **Instant Notifications:** Webhooks enable immediate notifications when there are changes in your NocoDB database. This real-time information can be crucial for timely responses to important events, such as new data entries, updates, or deletions.

2. **Automation:** They facilitate the automation of processes by triggering actions in external systems based on database events. For example, you can automate tasks like sending emails, updating spreadsheets, or syncing data with other applications in response to changes in NocoDB.

3. **Integration:** Webhooks allow you to seamlessly integrate NocoDB with other tools and services, enhancing the overall functionality of your database. This integration can streamline workflows, improve data consistency, and reduce manual data entry.

4. **Bulk Operations:** NocoDB's support for webhooks in bulk endpoints makes it efficient to handle multiple records simultaneously. This is especially useful when dealing with large datasets or when you need to perform batch operations in external systems.

In summary, webhooks in NocoDB empower you to create dynamic, responsive, and interconnected workflows by keeping external systems in sync with your database's activities.

![image](/img/v2/table-details/details-webhook.png)

Note that, Webhooks currently are specific for associated table. Additional procedural details about webhooks can be found [here](/automation/webhook/webhook-overview)

