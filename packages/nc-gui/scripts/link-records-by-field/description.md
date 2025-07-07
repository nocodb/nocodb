
### 🔗 Link Records by Field  
  
This script links records between two NocoDB tables by matching values in selected fields. It allows users to:

1. Select a **source table** and a **target table**.
2. Choose a **matching field** from each table.
3. Choose a **linked record field** in the source table that connects to the target.  
  
  
For each record in the source table, the script searches for a record in the target table with a **matching value**. If a match is found, the linked record field in the source table is updated to point to that record in the target table.

---

### ⚠️ Behavior in Edge Cases  
  
* **Missing in Target:**
  If no matching record is found in the target table for a source record, that record is skipped (no link is created).

* **Missing in Source:**
  Records in the target table that have no corresponding match in the source are ignored (no action taken).

* **Duplicate Values in Source:**
  All source records with the same matching value will link to the same corresponding record in the target table.

* **Duplicate Values in Target:**
  Only the **first match found** will be used. Remaining duplicates are ignored.

* **Blank or Null Values:**
  Records with empty or missing values in the matching field are skipped.

---
