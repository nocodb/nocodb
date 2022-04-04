# Setup

#### Setting up dev environment

- Clone `nocodb/nocodb` GitHub repo and checkout to `feat/v2` branch
  ```sh
  git clone https://github.com/nocodb/nc
  cd nocodb
  ```
  
- Navigate to `nocodb-sdk` package folder, install and build the package
  ```sh
  cd packages/nocodb-sdk
  npm install
  npm run build
  ```

#### Running backend  

```sh
# Navigate to `nocodb` package and install dependencies
cd packages/nocodb
npm install

# requires sqlite3

npm run watch:run

# if you have mysql on localhost (set its password as password)
# npm run watch:run:mysql
```

#### Running frontend

```sh
# Navigate to `nc-gui` package and install dependencies
cd packages/nc-gui
npm install
npm run dev
```


