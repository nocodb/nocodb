# NocoDB i18n translations

![image](https://user-images.githubusercontent.com/35857179/136654196-162a316c-adde-431b-8316-139168298278.png)

# Contribution Guide 

1. Our i18n translations are in google spreadsheet - make a [copy of it](https://docs.google.com/spreadsheets/d/1kGp92yLwhs1l7lwwgeor3oN1dFl7JZWuQOa4WSeZ0TE/edit?usp=sharing). Create a shareable link from your spreadsheet.

2. Make necessary changes for the required language column (eg. fr)

3. Download the sheet as .csv file

4. Visit [NocoDB i18n CSV Converter](https://i18n.nocodb.com/)

5. Upload the CSV file. 

6. Select the language for which you are translating (same as in step 2)

    NocoDB i18n CSV Converter will  
  
    - automatically copy the translated values to clipboard.
    - automatically show the respective file to open and edit in our github. Example: [fr.json](https://github.com/nocodb/nocodb/edit/master/packages/nc-gui/lang/fr.json).
    - Github will ask you to fork the repo - please do so if you haven't forked the repository and then paste the values from clipboard to the file. Alternatively you can just paste the updated JSON value to corresponding files

7. Submit PR with a link to your spreadsheet from step 1


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

