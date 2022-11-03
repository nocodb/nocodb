import path from 'path';
import shell from 'shelljs';

class Util {
  public static getShortVersion(args) {
    const shortVersion = JSON.parse(JSON.stringify(args));

    if (shortVersion._.length) {
      shortVersion._[0] = shortVersion._[0]
        .split('.')
        .map(a => a[0])
        .join('');
    }
    return shortVersion;
  }

  public static isProjectGraphql() {
    const currentProjectJson = require(path.join(
      process.cwd(),
      'config.xc.json'
    ));
    return currentProjectJson.meta.projectType.toLowerCase() === 'graphql';
  }

  public static showHelp(_args) {
    console.log(`
Usage: xc [commands]

Man page :
    man <command>               Outputs a man page for the command

Commands:
    new                         Creates a new project by taking database credentials as input

`);
  }

  public static manNew() {
    return `
${'COMMAND : '.bold}
  ${
    'xc new'.bold
  } - Creates new projects and creates APIs instantly for database inputted.

${'SYNOPSIS : '.bold}
  ${'xc new'.bold} ${'<projectName>'.bold}

${'ARGS :'.bold}

  The following are arguments available for new:

  ${'projectName'.bold} new project name

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc new airbnb'.bold}
        - Takes in database credentials and API type as input
        - Database can be new or existing database
        - Creates a new folder by name 'airbnb'
`;
  }

  public static manDocker() {
    return `
${'COMMAND : '.bold}
  ${'xc docker'.bold} -  Accepts DB credentials and creates a Docker file.

${'SYNOPSIS : '.bold}
  ${'xc docker'.bold}

${'ARGS :'.bold}
  None

${'VARIATIONS :'.bold}
  None

  ${'Examples with notes : '.bold}
        ${'xc docker'.bold}
        - Takes in database credentials and API type as input
        - Database can be new or existing database
        - Scaffolds REST/GraphQL/gRPC APIs for the database specified
        - These database can be already existing or new databases.
`;
  }

  public static manGenApisRest() {
    return `
${'COMMAND : '.bold}
  ${
    'xc gen.apis.graphql'.bold
  } - generates REST APIs for an existing/new databases of a project.

${'SYNOPSIS : '.bold}
  ${'xc gen.apis.rest'.bold} [${'-u'.bold} DatabaseURL(s)]

${'VARIATIONS :'.bold}

  The following variations are available:

  ${'<>'.bold}    If ${
      'no'.bold
    } option is passed, this generates REST APIs for databases current project
        that are within project file config.xc.json

  ${'-u'.bold}    ${
      '<Database URLs>'.bold
    } Creates a new project for an existing/new database
        For mysql : mysql://localhost:3306?u=root&p=password&d=ecommerce
        For pg    : pg://localhost:5432?u=postgres&p=password&d=ecommerce
        For mssql : mssql://localhost:1433?u=sa&p=Password123.&d=ecommerce

  ${'Examples with notes : '.bold}
        ${
          'xc gen.apis.rest -u mysql://localhost:3306?u=root&p=password&d=ecommerce'
            .bold
        }
        - Generates REST apis for a mysql database 'ecommerce'
        - Uses current directory as project name
        - If database exists - REST APIs will be created for the tables within it.
        - If database doesnt exist - it will be created.

        ${
          'xc gen.apis.rest -u pg://localhost:5432?u=postgres&p=password&d=ecommerce'
            .bold
        }
        - Generates REST apis for a postgres database 'ecommerce'

        ${
          'xc gen.apis.rest -u mssql://localhost:1433?u=sa&p=Password123.&d=ecommerce'
            .bold
        }
        - Generates REST apis for a mssql database 'ecommerce'

        ${
          `xc gen.apis.rest -u mysql://localhost:3306?u=root&p=password&d=ecommerce
                         -u pg://localhost:5432?u=postgres&p=password&d=crm`
            .bold
        }
        - Generates REST apis for multiple databases 'ecommerce' & 'crm'.
        - These database can be already existing or new databases.
`;
  }

  public static manGenApisGraphql() {
    return `
${'COMMAND : '.bold}
  ${
    'xc gen.apis.graphql'.bold
  } - generates GraphQL APIs for an existing/new databases of a project.

${'SYNOPSIS : '.bold}
  ${'xc gen.apis.graphql'.bold} [${'-u'.bold} DatabaseURL(s)]

${'VARIATIONS :'.bold}

  The following variations are available:

  ${'<>'.bold}    If ${
      'no'.bold
    } option is passed, this generates GraphQL APIs for databases current project
        that are within project file config.xc.json

  ${'-u'.bold}    ${
      '<Database URLs>'.bold
    } Creates a new project for an existing/new database
        For mysql : mysql://localhost:3306?u=root&p=password&d=ecommerce
        For pg    : pg://localhost:5432?u=postgres&p=password&d=ecommerce
        For mssql : mssql://localhost:1433?u=sa&p=Password123.&d=ecommerce

  ${'Examples with notes : '.bold}
        ${
          'xc gen.apis.graphql -u mysql://localhost:3306?u=root&p=password&d=ecommerce'
            .bold
        }
        - Generates GraphQL apis for a mysql database 'ecommerce'
        - Uses current directory as project name
        - If database exists - GraphQL APIs will be created for the tables within it.
        - If database doesnt exist - it will be created.

        ${
          'xc gen.apis.graphql -u pg://localhost:5432?u=postgres&p=password&d=ecommerce'
            .bold
        }
        - Generates GraphQL apis for a postgres database 'ecommerce'

        ${
          'xc gen.apis.graphql -u mssql://localhost:1433?u=sa&p=Password123.&d=ecommerce'
            .bold
        }
        - Generates GraphQL apis for a mssql database 'ecommerce'

        ${
          `xc gen.apis.graphql -u mysql://localhost:3306?u=root&p=password&d=ecommerce
                            -u pg://localhost:5432?u=postgres&p=password&d=crm`
            .bold
        }
        - Generates GraphQL apis for multiple databases 'ecommerce' & 'crm'.
        - These database can be already existing or new databases.
`;
  }

  public static manGenModule() {
    return `
${'COMMAND : '.bold}
  ${
    'xc gen.module'.bold
  } - Creates a table and scaffolds the respective module files
                  In REST project    - (router, service, middleware, policy, model, meta)
                  In GraphQL project - (resolver, service, middleware, policy, model, meta)

${'SYNOPSIS : '.bold}
  ${'xc gen.module'.bold} ${
      'module(s)'.bold
    } [--nomodel] [--router] [--service] [--dbAlias]

${'OPTIONS :'.bold}

  The following options are available:

  ${
    '--nomodel'.bold
  }  Scaffolds module without creating table and model, meta files.
        For mysql : mysql://localhost:3306?u=root&p=password&d=ecommerce
        For pg    : pg://localhost:5432?u=postgres&p=password&d=ecommerce
        For mssql : mssql://localhost:1433?u=sa&p=Password123.&d=ecommerce

  ${
    '--dbAlias'.bold
  }  Defaults to 'db'(primary) database if not provided to create the table
  ${
    '--router'.bold
  }   Will create router with model - service file will be skipped //todo
  ${
    '--service'.bold
  }  Will create service with model - router file will be skipped //todo

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc gen.module blog'.bold}
        - Creates blog table in primary database and scaffolds files \n\t  (router/resolver,middleware,policy,service,model,meta) files
        - Uses current directory as project name
        - If database exists - GraphQL APIs will be created for the tables within it.
        - If database doesnt exist - it will be created.

        ${'xc gen.module blog.comment'.bold}
        - Multiple tables can be created with '.' seperated files
        - Creates blog and comment table in primary database with all component files

        ${'xc gen.module blog --dbAlias secondary'.bold}
        - Creates table and module for secondary database

        ${'xc gen.module blog --nomodel'.bold}
        - Creates blog model without creating table
        - All folder/files in respective components will be created in parent table of primary table


`;
  }

  public static manDbMigrateInit() {
    return `
${'COMMAND : '.bold}
  ${
    'xc db.migrate.init'.bold
  } - Initialises a database migration project freshly - only necessary files are created
                     - This is a legacy command and will not be required in developer flow
                     - Instead use ${'xc new'.bold}
                     - After running this command - edit config.xc.json and run xc db.migrate.sync

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.init'.bold} ${'--type mysql|pg|mssql|sqlite3'.bold}

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.init --type mysql'.bold}
        - Creates migration project of type mysql
        - xc db.migrate.sync has to be run after command
`;
  }

  public static manDbMigrateSync() {
    return `
${'COMMAND : '.bold}
  ${
    'xc db.migrate.sync'.bold
  } - Initialises migrations in the databases of project
                     - Creates _evolutions table for database if it doesn't exists

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.sync'.bold} [${'--env'.bold} <environment>]  [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Defaults to 'dev' environment if not provided
  ${
    '--dbAlias'.bold
  }  If not provided all databases within environment are initialised

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.sync'.bold}
        - Initialises migration for all databases within 'dev' environment

        ${'xc db.migrate.sync --env production'.bold}
        - Initialises migration for all databases within 'production' environment

        ${'xc db.migrate.sync --env production --dbAlias secondary'.bold}
        - Initialises migration for 'db2'(secondary) database within 'production' environment
`;
  }

  public static manDbMigrateList() {
    return `
${'COMMAND : '.bold}
  ${'xc db.migrate.list'.bold} - Lists all the migrations

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.list'.bold} [${'--env'.bold} <environment>]  [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Defaults to 'dev' environment if not provided
  ${'--dbAlias'.bold}  Defaults to 'db'(primary) environment if not provided
  ${'--all'.bold}      List all migrations instead of just pending //todo

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.list'.bold}
        - Lists all migrations within 'dev' environment and 'db'(primary) database

        ${'xc db.migrate.list --env production'.bold}
        - Lists all migrations within 'production' environment and 'db'(primary) database

        ${'xc db.migrate.list --env production --dbAlias secondary'.bold}
        - Lists all migrations within 'production' environment and 'db2'(secondary) database
`;
  }

  public static manDbMigrateCreate() {
    return `
${'COMMAND : '.bold}
  ${
    'xc db.migrate.create'.bold
  } - Creates an empty migration for environment and dbAlias

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.create'.bold} [${'--env'.bold} <environment>]  [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Defaults to 'dev' environment if not provided
  ${'--dbAlias'.bold}  Defaults to 'db'(primary) environment if not provided

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.create'.bold}
        - Creates a migration within 'dev' environment and 'db'(primary) database

        ${'xc db.migrate.create --env production'.bold}
        - Creates a migration within 'production' environment and 'db'(primary) database

        ${'xc db.migrate.create --env production --dbAlias secondary'.bold}
        - Creates a migration within 'production' environment and 'db2'(secondary) database
`;
  }

  public static manDbMigrateUp() {
    return `
${'COMMAND : '.bold}
  ${'xc db.migrate.up'.bold} - Applies all pending migrations

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.up'.bold} [${'--env'.bold} <environment>] [${
      '--dbAlias'.bold
    } <databaseAlias>] \n\t\t\t[${'--steps'.bold} <number>]  [${
      '--file'.bold
    } <number>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--steps'.bold}    Number of pending migrations to apply
  ${'--file'.bold}     Filename till migrations has to be applied
  ${'--env'.bold}      Defaults to 'dev' environment if not provided
  ${'--dbAlias'.bold}  Defaults to 'db'(primary) environment if not provided
  ${'--sqlContentMigrate'.bold}  Defaults to 1
                       On '0' doesn't apply SQL contents
                            but updates _evolutions table that migration has been applied

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.up'.bold}
        - Applies all pending migrations

        ${'xc db.migrate.up --env production --steps 1'.bold}
        - Applies one pending migrations in 'production' environment

        ${
          'xc db.migrate.up --env production --dbAlias secondary --steps 1'.bold
        }
        - Applies one pending migrations in 'production' environment for 'db2'(secondary) database
`;
  }

  public static manDbMigrateDown() {
    return `
${'COMMAND : '.bold}
  ${
    'xc db.migrate.down'.bold
  } - Reverses all migrations or by steps or by till the filename

${'SYNOPSIS : '.bold}
  ${'xc db.migrate.down'.bold} [${'--env'.bold} <environment>] [${
      '--dbAlias'.bold
    } <databaseAlias>] \n\t\t\t[${'--steps'.bold} <number>]  [${
      '--file'.bold
    } <number>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--steps'.bold}    Number of applied migrations to apply
  ${'--file'.bold}     Filename till migrations has to be applied
  ${'--env'.bold}      Defaults to 'dev' environment if not provided
  ${'--dbAlias'.bold}  Defaults to 'db'(primary) environment if not provided
  ${'--sqlContentMigrate'.bold}  Defaults to 1
                     On '0' doesn't apply SQL contents
                          but updates _evolutions table that migration has been applied

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc db.migrate.down'.bold}
        - Reverses all applied migrations

        ${'xc db.migrate.down --env production --steps 1'.bold}
        - Reverses one applied migrations in 'production' environment

        ${
          'xc db.migrate.down --env production --dbAlias secondary --steps 1'
            .bold
        }
        - Reverses one applied migrations in 'production' environment for 'db2'(secondary) database
`;
  }

  public static manDbMigrateTerm() {
    return `
${'COMMAND : '.bold}
  ${
    'xc db.migrate.term'.bold
  } - Deprecated. Terminates all databases in environment.
`;
  }

  public static manComponentAdd() {
    return `
${'COMMAND : '.bold}
  ${
    'xc component.add'.bold
  } - Adds a new component in server/components directory by taking user input
                        on where to place the component in initialisation order.

${'SYNOPSIS : '.bold}
  ${'xc component.add'.bold} <componentName>

${'ARGS :'.bold}

  The following are arguments to function:
  ${'componentName'.bold}   Name of the new component

${'OPTIONS :'.bold}

  The following options are available:
    None

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc component.add cache'.bold}
        - Adds a cache component
`;
  }

  public static manAppInstall() {
    return `
${'COMMAND : '.bold}
  ${
    'xc app.install'.bold
  } - Download and starts xgenecloud desktop application installation

${'SYNOPSIS : '.bold}
  ${'xc app.install'.bold}

${'OPTIONS :'.bold}

  The following options are available:
    None

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc app.install'.bold}
`;
  }

  public static manAppOpen() {
    return `
${'COMMAND : '.bold}
  ${
    'xc app.open'.bold
  } - Opens the xgenecloud desktop application (mac and linux only)

${'SYNOPSIS : '.bold}
  ${'xc app.open'.bold}

${'OPTIONS :'.bold}

  The following options are available:
    None

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc app.open'.bold}
`;
  }

  public static manPermissionsSet() {
    return `
${'COMMAND : '.bold}
  ${'xc permissions.set'.bold} - Sets model(s) permission(s) for user role(s)

${'SYNOPSIS : '.bold}
  # For REST API project
  ${'xc permissions.set'.bold} [${'model(s)'.bold} | $] [${
      'userType(s)'.bold
    } | $] [${'read|write)'.bold} = 1 | 0]

  # For GraphQL API project
  ${'xc permissions.set'.bold} [${'model(s)'.bold} | $] [${
      'userType(s)'.bold
    } | $] [${'read|write|resolverFunction)'.bold} = 1 | 0]

${'ARGS :'.bold}

  The following are arguments to function:
  ${
    'model(s)'.bold
  }   Model name | Multiple models with dot seperated | $ - means all models
  ${
    'userType(s)'.bold
  }User role name | Multiple user role names with dot separated | $ - means all user models
  ${
    'permissions(s)'.bold
  }Permissions - read | write | get | post | put | delete | patch | resolverFunc | $ - means all permissions
${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc permissions.set blog guest read=1'.bold}
        - For 'blog' model 'guest' user type SET 'read' permission

        ${'xc permissions.set $ guest read=1'.bold}
        - For 'all' models 'guest' user type SET 'read' permission

        ${'xc permissions.set $ $ read=1'.bold}
        - For 'all' models 'all' user types SET 'read' permission

        ${'xc permissions.set $ $ read=1 write=1'.bold}
        - For 'all' models 'all' user types SET 'read' and 'write' permission
`;
  }

  // todo
  public static manPermissionsGet() {
    return `
${'COMMAND : '.bold}
  ${'xc permissions.get'.bold} - Gets model permission(s) for all the user roles

${'SYNOPSIS : '.bold}
  # For REST API project
  ${'xc permissions.get'.bold} [${'model'.bold}]

  # For GraphQL API project
  ${'xc permissions.get'.bold} [${'model(s)'.bold} ]

${'ARGS :'.bold}

  The following are arguments to function:
  ${'model'.bold}   Model name

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc permissions.get blog'.bold}
        - Get all permissions of blog model `;
  }

  public static manPermissionsUserAdd() {
    return `
${'COMMAND : '.bold}
  ${'xc permissions.role.add'.bold} - Add a new user role for all models
                  read is set default to 1
                  write is set default to 1

${'SYNOPSIS : '.bold}
  ${'xc permissions.role.add'.bold} ${'userRole'.bold} <userRole>

${'ARGS :'.bold}

  The following are the arguments :

  ${'userRole'.bold} new user role

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc permissions.role.add manager'.bold}
        - Adds user role 'manager' to all the models

`;
  }

  public static manPermissionsUserDelete() {
    return `
${'COMMAND : '.bold}
  ${'xc permissions.role.delete'.bold} - Delete user role from all models

${'SYNOPSIS : '.bold}
  ${'xc permissions.role.delete'.bold} <userRole>

${'ARGS :'.bold}

  The following are the arguments :

  ${'userRole'.bold} User role to be deleted

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc permissions.role.delete manager'.bold}
        - deletes user role 'manager' from all the models

`;
  }

  public static manPermissionsUserRename() {
    return `
${'COMMAND : '.bold}
  ${'xc permissions.role.rename'.bold} - renames an existing user role

${'SYNOPSIS : '.bold}
  ${'xc permissions.role.rename'.bold} <oldUserRoleName> <newUserRoleName>

${'ARGS :'.bold}

  The following are the arguments :

  ${'oldUserRoleName'.bold} old user role
  ${'newUserRoleName'.bold} new user role

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc permissions.role.rename manager StaffManager'.bold}
        - Renames user role from 'manager' to 'StaffManager' in all the models

`;
  }

  public static manProjectMetaExport() {
    return `
${'COMMAND : '.bold}
  ${
    'xc meta.export'.bold
  } - Exports all meta table data to project meta directory

${'SYNOPSIS : '.bold}
  ${'xc meta.export'.bold} ${'--env'.bold} <environment> [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Environment name to be exported 
  ${
    '--dbAlias'.bold
  }  dbAlias of database connection. If not provided then it will export metadata for all connections in the environment

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc meta.export --env dev'.bold}
        - Exports metadata for all databases in 'dev' environment

        ${'xc meta.export --env production --dbAlias db2'.bold}
        - Exports metadata for 'db2' database in 'production' environment
`;
  }

  public static manProjectMetaReset() {
    return `
${'COMMAND : '.bold}
  ${'xc meta.reset'.bold} - Clears all meta table data

${'SYNOPSIS : '.bold}
  ${'xc meta.reset'.bold} ${'--env'.bold} <environment> [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Environment name to be reset 
  ${
    '--dbAlias'.bold
  }  dbAlias of database connection. If not provided then it will clear metadata for all connections in the environment

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc meta.reset --env dev'.bold}
        - Clears metadata for all databases in 'dev' environment

        ${'xc meta.reset --env production --dbAlias db2'.bold}
        - Clears metadata for 'db2' database in 'production' environment
`;
  }

  public static manProjectMetaImport() {
    return `
${'COMMAND : '.bold}
  ${
    'xc meta.import'.bold
  } - Imports data from project meta folder to meta tables

${'SYNOPSIS : '.bold}
  ${'xc meta.import'.bold} ${'--env'.bold} <environment> [${
      '--dbAlias'.bold
    } <databaseAlias>]

${'OPTIONS :'.bold}

  The following options are available:
  ${'--env'.bold}      Environment name to be imported 
  ${
    '--dbAlias'.bold
  }  dbAlias of database connection. If not provided then it will import metadata to all connections in the environment

${'VARIATIONS :'.bold}

  None

  ${'Examples with notes : '.bold}
        ${'xc meta.import --env dev'.bold}
        - Imports metadata to all databases in 'dev' environment

        ${'xc meta.import --env production --dbAlias db2'.bold}
        - Imports metadata for 'db2' database in 'production' environment
`;
  }

  public static showHelpForCommand(args) {
    try {
      switch (args._[1]) {
        case 'new':
          console.log(Util.manNew());
          break;

        // case 'ga':
        // case 'gar':
        // case 'gen.apis':
        // case 'gen.apis.rest':
        //   console.log(Util.manGenApisRest());
        //   break;
        //
        // case 'gag':
        // case 'gen.apis.graphql':
        // case 'gen.apis.gql':
        //   console.log(Util.manGenApisGraphql());
        //   break;
        //
        // case 'gm':
        // case 'gen.module':
        //   console.log(Util.manGenModule());
        //   process.exit(0);
        //   break;
        //
        // /**************** START : permissions stuff ****************/
        // case 'permissions.set' :
        // case 'ps' :
        //   console.log(Util.manPermissionsSet());
        //   process.exit(0);
        //   break;
        //
        // case 'permissions.get' :
        // case 'pg' :
        //   console.log(Util.manPermissionsGet());
        //   process.exit(0);
        //   break;
        //
        // case 'permissions.role.add' :
        // case 'pra' :
        //   console.log(Util.manPermissionsUserAdd());
        //   process.exit(0);
        //   break;
        //
        // case 'permissions.role.rename' :
        // case 'prr' :
        //   console.log(Util.manPermissionsUserRename());
        //   process.exit(0);
        //   break;
        //
        // case 'permissions.role.delete' :
        // case 'prd' :
        //   console.log(Util.manPermissionsUserDelete());
        //   process.exit(0);
        //   break;
        //
        // /**************** END : permissions stuff ****************/
        //
        // /**************** START : Migration stuff ****************/
        // case 'db.migrate.init' :
        // case 'dmi' :
        //   console.log(Util.manDbMigrateInit());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.sync' :
        //   console.log(Util.manDbMigrateSync());
        //   break;
        // case 'dms' :
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.list' :
        // case 'dml' :
        //   console.log(Util.manDbMigrateList());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.create' :
        // case 'dmc' :
        //   console.log(Util.manDbMigrateCreate());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.up' :
        // case 'dmu' :
        //   console.log(Util.manDbMigrateUp());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.down' :
        // case 'dmd' :
        //   console.log(Util.manDbMigrateDown());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.term' :
        // case 'dmt' :
        //   console.log(Util.manDbMigrateTerm());
        //   process.exit(0);
        //   break;
        //
        // case 'db.migrate.sql.dump' :
        // case 'dmsd' :
        //   break;
        // /**************** END : Migration stuff ****************/
        // /**************** START : Project Meta stuff ****************/
        //
        // case 'meta.export' :
        // case 'me' :
        //   console.log(Util.manProjectMetaExport());
        //   process.exit(0);
        //   break;
        // case 'meta.import' :
        // case 'mi' :
        //   console.log(Util.manProjectMetaImport());
        //   process.exit(0);
        //   break;
        // case 'meta.reset' :
        // case 'mr' :
        //   console.log(Util.manProjectMetaReset());
        //   process.exit(0);
        //   break;
        // /**************** END : Project Meta stuff ****************/
        //
        //
        // /**************** START : app stuff ****************/
        // case 'app.install' :
        // case 'ai' :
        //   console.log(Util.manDbMigrateTerm());
        //   process.exit(0);
        //   break;
        //
        // case 'app.open' :
        // case 'ao' :
        //   console.log(Util.manDbMigrateTerm());
        //   process.exit(0);
        //   break;
        //
        // /**************** END : app stuff ****************/
        //
        // /**************** START : Component stuff ****************/
        // case 'component.add' :
        // case 'ca' :
        //   console.log(Util.manComponentAdd());
        //   process.exit(0);
        //   break;
        //
        // /**************** END : Component stuff ****************/
        //
        //
        // /**************** START : Docker ****************/
        // case 'docker' :
        // case 'd' :
        //   console.log(Util.manDocker());
        //   process.exit(0);
        //   break;
        //
        // /**************** END : Docker ****************/

        default:
          break;
      }
    } catch (e) {
      throw e;
    }
  }

  public static async runCmd(str) {
    shell.echo(`\nNow, executing command : ${str}\n\n`.blue);
    if (shell.exec(str).code !== 0) {
      shell.echo(`\n\nError running command internally\n\n\t"${str}"`.red);
      shell.echo(`\nExiting...`.red);
      shell.exit(1);
    }
  }

  public static escapeShellArg(cmd) {
    return '"' + cmd.replace(/(["'$`\\])/g, '\\$1') + '"';
  }

  public async play(sound) {
    switch (sound) {
      case -1:
        break;

      case 'fun':
        break;
    }
  }
}

export default Util;
