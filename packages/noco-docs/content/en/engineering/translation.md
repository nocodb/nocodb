---
title: "i18n translation"
description: "Contribute to NocoDB's i18n translation"
position: 3400
category: "Engineering"
menuTitle: "i18n translation"
---

NocoDB supports many foreign languages & we welcome community contributions via an easy to use [google-spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172).
Your help in fixing i18n goes a long way supporting NocoDB. Please follow below simple procedure to request corrections to existing translation errors.

## How to contribute ? (for community members)

### 1. How to change a string value ?
- Make a copy of [Google spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
  <img width="995" alt="Screenshot 2022-02-10 at 1 47 06 PM" src="https://user-images.githubusercontent.com/86527202/153368423-d1d898ef-bdcb-48c4-a772-b75e2c66566d.png">
- Find your language code [here](https://developers.google.com/admin-sdk/directory/v1/languages)
- Go to the column containing your language code. Make necessary changes. Origin text in ENGLISH can be found in `Column B` of master spreadsheet.
- Create a new [issue in Github](https://github.com/nocodb/nocodb/issues/new?assignees=dstala&labels=i18n+translation&template=i18n-translation-request.md&title=%5Bi18n%5D+Language+support+extension-+%3Clanguage+code%3E) request with a link to your spreadsheet from Step-1 (for us to verify & update master spreadsheet). 
- NocoDB Maintainers will take changes and merge it.
- It's that simple!




### 2. How to add a new language ?

Your native language not in list, we will be glad to support with your help! Please follow below steps

- Make a copy of [Google spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
  <img width="995" alt="Screenshot 2022-02-10 at 1 47 06 PM" src="https://user-images.githubusercontent.com/86527202/153368423-d1d898ef-bdcb-48c4-a772-b75e2c66566d.png">
- Find your language code [here](https://developers.google.com/admin-sdk/directory/v1/languages)
- Replace cell $AB$1 (rightmost, containing text `en`) with language code obtained above.
- Google will generate first version translation in column AB. Review. Make changes as you find appropriate for various items listed. Origin text in ENGLISH can be found in `Column B` of master spreadsheet.
- Create new [issue](https://github.com/nocodb/nocodb/issues/new?assignees=dstala&labels=i18n+translation&template=i18n-translation-request.md&title=%5Bi18n%5D+Language+support+extension-+%3Clanguage+code%3E) request with a link to your spreadsheet from Step-1 (for us to verify & update master spreadsheet).

---

## How to accept i18n contributions ? (for NocoDB maintainers)

> _This is exclusive to NocoDB maintainers only_

### 1. Adding / Updating a string
- Open master [Spreadsheet](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit#gid=2076107172)
- For the string/ text under consideration, look-up in existing sheet if it exists already
- [New string already exists] Consider re-using it; align string key if required
- [New string need to be inserted] Insert a new record into appropriate categories as defined below
- Download spreadsheet as .csv (File > Download > Comma-seperated values (.csv, current sheet)
- Use noco-i18n-from-cli to generate new language JSON file
- Copy respective i18n/\*.json files to `nocodb/packages/nc-gui/lang`

### 2. String Categories
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

> Note: string name should be in camelCase. Use above list as priority order in case of ambiguity.
