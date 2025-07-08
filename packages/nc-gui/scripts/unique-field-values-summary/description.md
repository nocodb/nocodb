
This script helps you analyze any field in your NocoDB base by listing all **unique values** along with how many times each value appears.

<br>

#### 🧩 What it does

* Prompts you to select a table and a specific field.
* Scans all records in that field (including linked records, select fields, and text).
* Handles large datasets using pagination.
* Displays the results as a **sortable table** with each value and its count.
* Shows the **total number of records processed**.

<br>

#### ✅ Useful for

* Identifying data inconsistencies or duplicates
* Auditing field usage across records
* Quickly summarizing select or linked field values

<br>

#### ⚠️ Notes

* Empty/null values are included and labeled as `"null"` in the results.
