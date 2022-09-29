# nc-gui

## Build Setup

```bash
# install dependencies
$ npm install

# serve with hot reload at localhost:3000
$ npm run dev

# build for production and launch server
$ npm run build
$ npm run start

# generate static project
$ npm run generate
```

For detailed explanation on how things work, check out [Nuxt.js docs](https://nuxtjs.org).


# APIs required 

- DB Operations
    - Table list 
    - Column list
    - View list
    - Function list
    - Query execution
    - Trigger, relation list
- Project Operation
    - API Client Metadata operations
    - Theme options
- Migration 
    - Migration Up
    - Migration Down
    - Migration List


- First page
    - With DB URL
        - Get Started(P) - /xc/start : Welcome to NocoDB, Looks like you configured databases. Now it's time to setup an admin user. Or it's time to authenticate via Admin secret. No authentication configured access dashboard.
            - With Auth
                - Admin secret
                    - Take Admin Secret(P) - /xc/user/authentication/signup
                - JWT
                    - Create Admin User(P) - /xc/user/authentication/signup
            - Without Auth
        - Dashboard(P) - /xc/
    - Without DB URL
        - Get Started(P) - /xc/start - Welcome to NocoDB, Let's set up a new project by connecting to database.
            - Create Project(P) - - /xc/project/0
                - Admin secret
                    - Take Admin Secret(P) - /xc/user/authentication/signup
                - JWT
                    - Create Admin User(P) - /xc/user/authentication/signup
                - Disabled
            - Dashboard(P) - /xc/
    - With Config
        - Get started(P) - /xc/start - Welcome to NocoDB, Now it's time to setup an admin user. Or it's time to authenticate via Admin secret. No authentication configured access dashboard.
            - Dashboard(P) - /xc/


- Differentiate docker mvc and normal mvc project 

