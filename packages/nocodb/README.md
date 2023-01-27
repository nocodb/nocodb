# Nocodb

## Running locally

Even though this package is a backend project, you can still visit the dashboard as it includes ``nc-lib-gui``. 

```sh
npm install
npm run watch:run
# open localhost:8080/dashboard in browser
```

As ``nc-lib-gui`` is hosted in the npm registry, for local development, you should run ``nc-gui`` separately. 

If you wish to combine the frontend and backend together in your local development environment, you may use ``packages/nc-lib-gui`` as a local dependency by updating the ``packages/nocodb/package.json`` to 

```json
"nc-lib-gui": "file:../nc-lib-gui"
```

In this case, whenever there are any changes made in the frontend, you need to run ``npm run build:copy`` under ``packages/nc-gui/``.

