# Storage

> Part of **nocodb**

---

## `POST` /api/v1/db/storage/upload

> Attachment Upload


Upload attachment


**Operation ID:** `storage-upload`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `path` | **query** |  (string) | ✅ Yes | Target File Path |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `scope` | **query** |  (string) | ❌ No | The scope of the attachment |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|


---
## `POST` /api/v1/db/storage/upload-by-url

> Attachment Upload by URL


Upload attachment by URL. Used in Airtable Migration.


**Operation ID:** `storage-upload-by-url`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `path` | **query** |  (string) | ✅ Yes | Target File Path |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `scope` | **query** |  (string) | ❌ No | The scope of the attachment |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|


---
