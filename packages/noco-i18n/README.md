# NocoDB : i18n Contribution Guide

We 've made it simple to accept new translations

1. Our i18n translations are in google spreadsheet 
    - Make a [copy of it](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit?usp=sharing). ( file > make a copy )
    - Create a shareable link from your spreadsheet. ( share > get link > change to anyone with link )

2. Make necessary changes for the required language column (eg. fr)

3. Download the sheet as .csv file ( file > download > csv )

4. Visit [https://i18n.nocodb.com/](https://i18n.nocodb.com/)

5. Upload the CSV file (from step 3). 

6. Select the language for which you are translating (same as in step 2)

    https://i18n.nocodb.com will  
  
    - Automatically copy the translated values to clipboard.
    - Automatically show the respective file to open and edit in our github. Example: [fr.json](https://github.com/nocodb/nocodb/edit/master/packages/nc-gui/lang/fr.json).
    - Github will ask you to fork the repo - please do so if you haven't forked the repository and then paste the values from clipboard to the file. Alternatively you can just paste the updated JSON value to corresponding files

7. Submit PR with a link to your spreadsheet (from step 1)

- - - - 

### Sample screenshot of https://i18n.nocodb.com

![image](https://user-images.githubusercontent.com/35857179/136654196-162a316c-adde-431b-8316-139168298278.png)

- - - - 

# Development setup

You need vue cli in order to start the application

```
npm install -g @vue/cli
```

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

