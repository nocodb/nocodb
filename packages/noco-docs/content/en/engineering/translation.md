---
title: "i18n translation"
description: "Contribute to NocoDB's i18n translation"
position: 3400
category: "Engineering"
menuTitle: "i18n translation"
---

NocoDB supports many foreign languages & community contributions are now simplified via [Crowdin](https://crowdin.com/)
Your help in fixing i18n goes a long way supporting NocoDB. Please follow below simple procedure to request corrections to existing translation errors.

# Public Contributions

### 1. How to add translation corrections (to existing languages)?

- Setup [Crowdin](https://crowdin.com) account
- Join [NocoDB](https://crowdin.com/project/nocodb) project
  
![Screenshot 2022-09-08 at 10 26 23 PM](https://user-images.githubusercontent.com/86527202/189181511-51b8671e-bee8-45d5-8216-a4a031bc6309.png)

- Click the language that you wish to contribute
  
![Screenshot 2022-09-08 at 10 29 56 PM](https://user-images.githubusercontent.com/86527202/189182132-0eed7d5a-eaa1-43e1-929d-688f375763c1.png)

- Click the `Translate` button; this opens up `Crowdin Online Editor`
  
![Screenshot 2022-09-08 at 10 32 17 PM](https://user-images.githubusercontent.com/86527202/189182450-999124e8-566c-40af-9d3c-731a11c1b6aa.png)

- Select string in `English` on the left-hand menu bar [1]
- Propose changes [2]
- Save [3]
Note: Crowdin provides translation recommendation's as in [4]. Click directly if it's apt
  
![Screenshot 2022-09-08 at 10 37 38 PM](https://user-images.githubusercontent.com/86527202/189184278-69d688ed-4e5a-4d5a-b629-9f6d10d79346.png)

A GitHub Pull Request will be automatically triggered (periodicity- 6 hours). We will follup on remaining integration work items.

---


#### Reference
  
Refer following articles to get additional details about Crowdin Portal usage
- [Translator Introduction](https://support.crowdin.com/crowdin-intro/)
- [Volunteer Translation Introduction](https://support.crowdin.com/for-volunteer-translators/)
- [Online Editor](https://support.crowdin.com/online-editor/) 

---


### 2. How to add a new language ?
  
Your native language not in list, we will be glad to support with your help! Request for it [here](https://github.com/nocodb/nocodb/issues/new?assignees=dstala&labels=i18n+translation&template=i18n-translation-request.md&title=%5Bi18n%5D+Language+support+extension-+%3Clanguage+code%3E). We will be glad to take your help to set up translations


---

# Engineering Contributions (for NocoDB developers & maintainers)

> _This is exclusive to NocoDB developers & maintainers only_

### 1. Adding / Updating a string
### Add / update key-value
  - [en] make changes directly to `en.json` & commit to `develop`
  - [any other language] add changes using `crowdin` portal; procedure described below

### Add a new language
#### GitHub changes
- Update enumeration in `enums.ts` [packages/nc-gui/lib/enums.ts]
- Map JSON path in `a.i18n.ts` [packages/nc-gui/plugins/a.i18n.ts]
- Update array in `6d_language_validation.js` [scripts/cypress/integration/common/6d_language_validation.js]
#### Crowdin changes [admin only]
- Open `NocoDB` project
- Click on `Language` on the home tab
- Select target language, `Update`
  
  
![Screenshot 2022-09-08 at 10 52 59 PM](https://user-images.githubusercontent.com/86527202/189186570-5c1c7cad-6d3f-4937-ab4d-fa7ebe022cb1.png)
  
  
![Screenshot 2022-09-08 at 10 54 04 PM](https://user-images.githubusercontent.com/86527202/189186632-0b9f5f55-0550-4d8f-a8ae-7e9b9076774e.png)
  
---

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
