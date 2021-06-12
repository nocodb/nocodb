# nocodb

## Running locally

Even though this package is a backend project, you can still visit the dashboard as it includes ``nc-lib-gui``. 

```
npm install
npm run watch:run
# open localhost:8080/dashboard in browser
```

As ``nc-lib-gui`` is hosted in npm registry, for local development, you should run ``nc-gui`` separately. 

If you wish to combine the frontend and backend together in your local devlopment environment, you may use ``packages/nc-lib-gui`` as a local depenedency by updating the ``packages/nocodb/package.json`` to 

```json
"nc-lib-gui": "file:../nc-lib-gui"
```

In this case, whenever there is any changes made in frontend, you need to run ``npm run build:copy`` under ``packages/nc-gui/``.