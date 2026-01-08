<!-- Description  -->

Dedupe helps you quickly identify and merge duplicate records in your tables using a single field for grouping.

**Current Limitations:**
- Supports duplicate detection based on **one field only** (single field grouping)
- **Undo/Redo functionality is not currently supported** - merged records cannot be reverted
- **Minimum 2 matching records required** - groups with only 1 record are not shown as duplicates

### Supported Field Types for Grouping

**✅ Supported for duplicate detection:**
- Text, LongText, SingleLineText
- Number, Decimal, Currency, Percent, Duration, Rating
- Date, DateTime, Time, Year
- Phone, Email, URL
- SingleSelect, MultiSelect
- Checkbox, 
- JSON, Geometry
- User

**❌ Not supported for grouping:**
- System columns (created_at, updated_at, id, etc.)
- Virtual columns (Barcode, QRCode, Formula, Rollup, Lookup, Links, LTAR)
- Attachment 

### Field Behavior During Merge

**Fields shown in merge interface:**
- All fields except the grouping field itself and system columns
- You can select values from different duplicate records for each field
- Virtual columns (Formula, Lookup, Rollup) are displayed but **cannot be modified** during merge

**Merge process notes:**
- Primary record retains its structure and primary key
- Selected field values from other records are copied to the primary record
- Duplicate records are permanently deleted after merge
- Excluded records are preserved and not merged or deleted

**Group review options:**
- **Skip**: Move to the next duplicate group without making any changes to the current group
- **Reset**: Clear all selections for the current group (primary record, field selections, and exclusions) and start fresh
- You can skip groups before selecting a primary record, or reset your selections even after making choices

With just a few steps, you can:
- Select any Table you want to scan for duplicates.
- Filter records using a specific view.
- Choose **a single field** to determine how duplicates are detected (e.g., email, phone number, etc.).
- Review detected duplicate groups where the selected field has matching values.
- **Skip groups** you don't want to merge, or **reset** your selections for the current group if needed.
- Select a primary record and pick the best field values from other duplicates.
- Merge selected values into the primary record and automatically delete the duplicate records.

This makes it easy to keep your data clean, accurate, and up-to-date—no manual comparison needed.
</br></br>

<!-- Docs link  -->
<a href="https://nocodb.com/docs/product-docs/extensions/dedupe" target="_blank" rel="noopener noreferrer" class="!no-underline !hover:underline inline-flex items-center gap-2 ">
    Learn more 
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333" stroke="#374151" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 2H14V6" stroke="#374151" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6.66669 9.33333L14 2" stroke="#374151" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
</a>

</br></br>

<!-- Todo: Add images after completion  -->
<div class="flex gap-5">
    <img src="#" class="w-[calc(50%_-_10px)] object-contain rounded-xl"/>
    <img src="#" class="w-[calc(50%_-_10px)] object-contain rounded-xl"/>
</div>
<br/>
<div>
 <img src="#" width="100%" class="object-contain rounded-xl"/>
</div>
