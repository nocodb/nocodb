# Install & setup


# API Reference
**Kind**: global class  
**Extends**: <code>SqlMigrator</code>  

* [KnexMigrator](#KnexMigrator) ⇐ <code>SqlMigrator</code>
    * [new KnexMigrator()](#new_KnexMigrator_new)
    * _instance_
        * [.init(args)](#KnexMigrator+init)
        * [.sync()](#KnexMigrator+sync)
        * [.clean(args)](#KnexMigrator+clean)
        * [.migrationsCreate(args)](#KnexMigrator+migrationsCreate) ⇒ <code>object</code> \| <code>String</code> \| <code>String</code>
        * [.migrationsDelete(args)](#KnexMigrator+migrationsDelete) ⇒ <code>String</code> \| <code>String</code>
        * [.migrationsUp(args)](#KnexMigrator+migrationsUp)
        * [.migrationsDown(args)](#KnexMigrator+migrationsDown)
        * [.migrationsWrite(args)](#KnexMigrator+migrationsWrite)
        * [.migrationsList(args)](#KnexMigrator+migrationsList) ⇒ <code>Object</code> \| <code>Object</code> \| <code>Object</code> \| <code>String</code> \| <code>String</code>
        * [.migrationsToSql(args)](#KnexMigrator+migrationsToSql) ⇒ <code>Object</code> \| <code>Object</code> \| <code>Object</code> \| <code>String</code> \| <code>String</code>
        * [.migrationsSquash(args)](#KnexMigrator+migrationsSquash)
        * [.migrationsCreateManually(args)](#KnexMigrator+migrationsCreateManually)
        * [.migrationsRenameProjectKey(args)](#KnexMigrator+migrationsRenameProjectKey) ⇒ <code>Result</code>
        * [.migrationsCreateEnv(args)](#KnexMigrator+migrationsCreateEnv) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.migrationsDeleteEnv(args)](#KnexMigrator+migrationsDeleteEnv) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.migrationsCreateEnvDb(args)](#KnexMigrator+migrationsCreateEnvDb) ⇒ <code>Result</code>
    * _static_
        * [.KnexMigrator](#KnexMigrator.KnexMigrator)
            * [new KnexMigrator()](#new_KnexMigrator.KnexMigrator_new)

<a name="new_KnexMigrator_new"></a>

### new KnexMigrator()
Class to create an instance of KnexMigrator

<a name="KnexMigrator+init"></a>

### knexMigrator.init(args)
Initialises migration project
Creates project json file in pwd of where command is run.
Creates xmigrator folder in pwd, within which migrations for all dbs will be sored

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>object</code> |  |
| args.type | <code>String</code> | type of database (mysql | pg | oracle | mssql | sqlite) |
| args.title | <code>String</code> | Name of Project |
| args.folder | <code>String</code> | Project Dir |

<a name="KnexMigrator+sync"></a>

### knexMigrator.sync()
Sync is called after init() or any change to config.xc.json file
This initialises databases and migration tables within each connection of config.xc.json

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  
<a name="KnexMigrator+clean"></a>

### knexMigrator.clean(args)
**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args | <code>Object</code> | 
| args.env | <code>Object</code> | 
| args.dbAlias | <code>Object</code> | 
| args.json | <code>Object</code> | 

<a name="KnexMigrator+migrationsCreate"></a>

### knexMigrator.migrationsCreate(args) ⇒ <code>object</code> \| <code>String</code> \| <code>String</code>
Creates up and down migration files within migration folders

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  
**Returns**: <code>object</code> - files<code>String</code> - files.up<code>String</code> - files.down  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>object</code> |  |
| args.dbAlias | <code>String</code> | Database alias within environment |

<a name="KnexMigrator+migrationsDelete"></a>

### knexMigrator.migrationsDelete(args) ⇒ <code>String</code> \| <code>String</code>
Creates up and down migration files within migration folders

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  
**Returns**: <code>String</code> - files.up<code>String</code> - files.down  

| Param | Type |
| --- | --- |
| args | <code>object</code> | 
| args.env | <code>String</code> | 
| args.dbAlias | <code>String</code> | 

<a name="KnexMigrator+migrationsUp"></a>

### knexMigrator.migrationsUp(args)
migrationsUp

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>object</code> |  |
| args.env | <code>String</code> |  |
| args.dbAlias | <code>String</code> |  |
| args.folder | <code>String</code> |  |
| args.steps | <code>Number</code> | number of steps to migrate |
| args.file | <code>String</code> | till which file to migration |
| args.sqlContentMigrate | <code>Number</code> | defaults to 1 ,                  on zero sqlContent is ignored                  and only filenames are migrated to _evolution table |

<a name="KnexMigrator+migrationsDown"></a>

### knexMigrator.migrationsDown(args)
migrationsDown

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>object</code> |  |
| args.env | <code>String</code> |  |
| args.dbAlias | <code>String</code> |  |
| args.folder | <code>String</code> |  |
| args.steps | <code>Number</code> | number of steps to migrate |
| args.file | <code>String</code> | till which file to migration |
| args.sqlContentMigrate | <code>Number</code> | defaults to 1 ,                  on zero sqlContent is ignored                  and only filenames are migrated to _evolution table |

<a name="KnexMigrator+migrationsWrite"></a>

### knexMigrator.migrationsWrite(args)
Migrations write

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>\*</code> |  |
| args.env | <code>String</code> |  |
| args.dbAlias | <code>String</code> |  |
| args.folder | <code>String</code> |  |
| args.upStatement | <code>Array.&lt;Object&gt;</code> | array of sql statements in obj |
| args.upStatement[].sql | <code>String</code> | sql statements without ';' |
| args.downStatement | <code>Array.&lt;Object&gt;</code> |  |
| args.downStatement[].sql | <code>String</code> | sql statements without ';' |
| args.up | <code>String</code> | up filename - up filename (only name not entire path) |
| args.down | <code>String</code> | down filename - down filename (only name not entire path) |

<a name="KnexMigrator+migrationsList"></a>

### knexMigrator.migrationsList(args) ⇒ <code>Object</code> \| <code>Object</code> \| <code>Object</code> \| <code>String</code> \| <code>String</code>
Migrations List

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  
**Returns**: <code>Object</code> - Result<code>Object</code> - Result.data<code>Object</code> - Result.data.object<code>String</code> - Result.data.object.list<code>String</code> - Result.data.object.pending  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>object</code> |  |
| args.env | <code>String</code> |  |
| args.dbAlias | <code>String</code> |  |
| args.steps | <code>Number</code> | number of steps to migrate |
| args.file | <code>String</code> | till which file to migration |

<a name="KnexMigrator+migrationsToSql"></a>

### knexMigrator.migrationsToSql(args) ⇒ <code>Object</code> \| <code>Object</code> \| <code>Object</code> \| <code>String</code> \| <code>String</code>
Migrations to SQL

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  
**Returns**: <code>Object</code> - Result<code>Object</code> - Result.data<code>Object</code> - Result.data.object<code>String</code> - Result.data.object.up<code>String</code> - Result.data.object.down  

| Param | Type |
| --- | --- |
| args | <code>\*</code> | 
| args.env | <code>String</code> | 
| args.dbAlias | <code>String</code> | 
| args.folder | <code>String</code> | 

<a name="KnexMigrator+migrationsSquash"></a>

### knexMigrator.migrationsSquash(args)
Migrations Squash

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args | <code>\*</code> | 
| args.env | <code>String</code> | 
| args.dbAlias | <code>String</code> | 
| args.folder | <code>String</code> | 
| args.file | <code>String</code> | 
| args.steps | <code>String</code> | 
| args.up | <code>String</code> | 
| args.down | <code>String</code> | 

<a name="KnexMigrator+migrationsCreateManually"></a>

### knexMigrator.migrationsCreateManually(args)
Migrations Create Manual

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args | <code>\*</code> | 
| args.env | <code>String</code> | 
| args.dbAlias | <code>String</code> | 
| args.folder | <code>String</code> | 
| args.file | <code>String</code> | 
| args.steps | <code>String</code> | 
| args.up | <code>String</code> | 
| args.down | <code>String</code> | 

<a name="KnexMigrator+migrationsRenameProjectKey"></a>

### knexMigrator.migrationsRenameProjectKey(args) ⇒ <code>Result</code>
**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type | Description |
| --- | --- | --- |
| args |  |  |
| args.folder | <code>String</code> | defaults to process.cwd() |
| args.key | <code>String</code> |  |
| args.value | <code>String</code> |  |

<a name="KnexMigrator+migrationsCreateEnv"></a>

### knexMigrator.migrationsCreateEnv(args) ⇒ <code>Promise.&lt;void&gt;</code>
update json
update sqlite
project reopen

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args |  | 
| args.folder | <code>String</code> | 
| args.env | <code>String</code> | 
| args.envValue | <code>String</code> | 

<a name="KnexMigrator+migrationsDeleteEnv"></a>

### knexMigrator.migrationsDeleteEnv(args) ⇒ <code>Promise.&lt;void&gt;</code>
update json
update sqlite
project reopen

**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args |  | 
| args.folder | <code>String</code> | 
| args.env | <code>String</code> | 

<a name="KnexMigrator+migrationsCreateEnvDb"></a>

### knexMigrator.migrationsCreateEnvDb(args) ⇒ <code>Result</code>
**Kind**: instance method of [<code>KnexMigrator</code>](#KnexMigrator)  

| Param | Type |
| --- | --- |
| args |  | 
| args.folder | <code>String</code> | 
| args.env | <code>String</code> | 
| args.db | <code>String</code> | 

<a name="KnexMigrator.KnexMigrator"></a>

### KnexMigrator.KnexMigrator
**Kind**: static class of [<code>KnexMigrator</code>](#KnexMigrator)  
<a name="new_KnexMigrator.KnexMigrator_new"></a>

#### new KnexMigrator()
Creates an instance of KnexMigrator.



test




