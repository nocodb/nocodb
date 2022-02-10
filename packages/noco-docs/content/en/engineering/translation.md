---
title: "Language support"
description: "i18n: support for local/regional languages"
position: 2000
category: "Engineering"
menuTitle: "Localization: i18n"
---

NocoDB supports tool localization & relies on Google translation for first version. We understand, Google translation would not always provide correct transaltion for the context. We accept PR for subsequent corrections from Open source enthusiasts and contributors worldwide. Any such corrections over-ride Google translation & are recorded in Master i18n spreadsheet.

> **Resource Links**  
>  [Master i18n spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)  
>  [Google language code](https://developers.google.com/admin-sdk/directory/v1/languages)

## For Application User

### 1. Changing `existing language` translation text

Your help in identifying language translation anomalies & helping it fix helps in big way building/scaling NocoDB to next level. Please follow below simple procedure to request corrections to existing translation errors.

-   Make a copy of [Google spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
    <img width="995" alt="Screenshot 2022-02-10 at 1 47 06 PM" src="https://user-images.githubusercontent.com/86527202/153368423-d1d898ef-bdcb-48c4-a772-b75e2c66566d.png">

-   Find your language code [here](https://developers.google.com/admin-sdk/directory/v1/languages)
-   Go to the column containing your language code derived above. Make changes as you find appropriate for various items listed. Origin text in ENGLISH can be found in `Column B` of master spreadsheet.
-   Download spreadsheet as .csv (`File > Download > Comma-seperated values (.csv)`).  
    <img width="995" alt="Screenshot 2022-02-10 at 1 45 05 PM" src="https://user-images.githubusercontent.com/86527202/153368518-8e51ad7b-2577-4756-82f3-d9ad6683ad5e.png">

-   Create new [issue](https://github.com/nocodb/nocodb/issues/new?assignees=dstala&labels=i18n+translation&template=i18n-translation-request.md&title=%5Bi18n%5D+Language+support+extension-+%3Clanguage+code%3E) request with a link to your spreadsheet from Step-1 (for us to verify & update master spreadsheet).

### 2. Requesting support for a `new language`

Your native language not in list, we will be glad to support with your help! Please follow below steps

-   Make a copy of [Google spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
    <img width="995" alt="Screenshot 2022-02-10 at 1 47 06 PM" src="https://user-images.githubusercontent.com/86527202/153368423-d1d898ef-bdcb-48c4-a772-b75e2c66566d.png">

-   Find your language code [here](https://developers.google.com/admin-sdk/directory/v1/languages)
-   Replace cell $AB$1 (rightmost, containing text `en`) with language code obtained above.
-   Google will generate first version translation in column AB. Review. Make changes as you find appropriate for various items listed. Origin text in ENGLISH can be found in `Column B` of master spreadsheet.
-   Download spreadsheet as .csv (`File > Download > Comma-seperated values (.csv)`).  
    <img width="995" alt="Screenshot 2022-02-10 at 1 45 05 PM" src="https://user-images.githubusercontent.com/86527202/153368518-8e51ad7b-2577-4756-82f3-d9ad6683ad5e.png">

-   Create new [issue](https://github.com/nocodb/nocodb/issues/new?assignees=dstala&labels=i18n+translation&template=i18n-translation-request.md&title=%5Bi18n%5D+Language+support+extension-+%3Clanguage+code%3E) request with a link to your spreadsheet from Step-1 (for us to verify & update master spreadsheet).

---

## For NocoDB Moderators

> **_This is exclusive to NocoDB team members/ moderators only_**

### 1. Adding/ updating KEY.STRING

-   Open master [Spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
-   For the string/ text under consideration, look-up in existing sheet if it exists already
-   [New string already exists] Consider re-using it; align string key if required
-   [New string need to be inserted] Insert a new record into appropriate categories as defined below
-   Download spreadsheet as .csv (File > Download > Comma-seperated values (.csv, current sheet)
-   Use noco-i18n-from-cli to generate new language JSON file
-   Copy respective i18n/\*.json files to `nocodb/packages/nc-gui/lang`

### 2. String KEY Categories

-   **General**: simple & common tokens (save, cancel, submit, open, close, home, and such)
-   **Objects**: objects from NocoDB POV (project, table, field, column, view, page, and such)
-   **Title**: screen headers (compact) (menu headers, modal headers)
-   **Lables**: text box/ radio/ field headers (few words) (Labels over textbox, radio buttons, and such)
-   **Activity**/ actions: work items (few words) (Create Project, Delete Table, Add Row, and such)
-   **Tooltip**: additional information associated with work items (usually lengthy) (Additional information provided for activity)
-   **Placeholder**: placeholders associated with various textboxes (Text placeholders)
-   **Msg**
    -   Info: general/success category for everything
    -   Error: warnings & errors
    -   Toast: pop-up toast messages

> Note: Mark String KEY name in `camelCase`. Use above list as priority order in case of ambiguity.
