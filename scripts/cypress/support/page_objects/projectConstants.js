export const defaultDbParams = {
    databaseType: 0, // MySQL
    hostAddress: "localhost",
    portNumber: "3306",
    username: "root",
    password: "password",
    databaseName: "sakila",
};

export const defaultPgDbParams = {
    databaseType: 1, // Postgres
    hostAddress: "localhost",
    portNumber: "5432",
    username: "postgres",
    password: "password",
    databaseName: "postgres",
};

// database
//      validation details
//          advSettings: left navigation bar (audit, metadata, auth, transient view modes)
//          editSchema: create table, add/update/delete column
//          editData: add/ update/ delete row, cell contents
//          editComment: add comment
//          shareView: right navigation bar (share options)
export const roles = {
    owner: {
        name: "owner",
        credentials: { username: "user@nocodb.com", password: "Password123." },
        validations: {
            advSettings: true,
            editSchema: true,
            editData: true,
            editComment: true,
            shareView: true,
        },
    },
    creator: {
        name: "creator",
        credentials: {
            username: "creator@nocodb.com",
            password: "Password123.",
        },
        validations: {
            advSettings: true,
            editSchema: true,
            editData: true,
            editComment: true,
            shareView: true,
        },
    },
    editor: {
        name: "editor",
        credentials: {
            username: "editor@nocodb.com",
            password: "Password123.",
        },
        validations: {
            advSettings: false,
            editSchema: false,
            editData: true,
            editComment: true,
            shareView: false,
        },
    },
    commenter: {
        name: "commenter",
        credentials: {
            username: "commenter@nocodb.com",
            password: "Password123.",
        },
        validations: {
            advSettings: false,
            editSchema: false,
            editData: false,
            editComment: true,
            shareView: false,
        },
    },
    viewer: {
        name: "viewer",
        credentials: {
            username: "viewer@nocodb.com",
            password: "Password123.",
        },
        validations: {
            advSettings: false,
            editSchema: false,
            editData: false,
            editComment: false,
            shareView: false,
        },
    },
};

// default projects
//
export const staticProjects = {
    sampleREST: {
        basic: { dbType: "none", apiType: "REST", name: "sampleREST" },
        config: {},
    },
    sampleGQL: {
        basic: { dbType: "none", apiType: "GQL", name: "sampleGQL" },
        config: {},
    },
    externalREST: {
        basic: { dbType: "external", apiType: "REST", name: "externalREST" },
        config: defaultDbParams,
    },
    externalGQL: {
        basic: { dbType: "external", apiType: "GQL", name: "externalGQL" },
        config: defaultDbParams,
    },
    pgExternalREST: {
        basic: { dbType: "external", apiType: "REST", name: "pgExtREST" },
        config: defaultPgDbParams,
    },
    pgExternalGQL: {
        basic: { dbType: "external", apiType: "GQL", name: "pgExternalGQL" },
        config: defaultPgDbParams,
    },
};

// return TRUE if test suite specified is activated from env-variables
//
export const isTestSuiteActive = (apiType, dbType) => {
    const env = Cypress.env("testMode");
    return env.some(
        (element) => element.apiType === apiType && element.dbType === dbType
    );
};

let currentTestMode = { apiType: null, dbType: null };
let xcdbProjectString = ``;
export function setCurrentMode(apiType, dbType) {
    currentTestMode = { apiType: apiType, dbType: dbType };
}

export function getCurrentMode() {
    return currentTestMode;
}

export function isXcdb() {
    return currentTestMode.dbType === "xcdb";
}

export function isPostgres() {
    return currentTestMode.dbType === "postgres";
}

export function setProjectString(projStr) {
    xcdbProjectString = projStr;
}

export function getProjectString() {
    return xcdbProjectString;
}

const sakilaTables = [
    'actor', 'address', 'category', 'city', 'country', 'customer', 'film', 'film_text', 'language', 'payment', 'rental', 'staff'
]

const sakilaSqlViews = [
    'actor_info', 'customer_list', 'film_list', 'nicer_but_slower_film_list', 'sales_by_film_category', 'sales_by_store', 'staff_list'
]

export { sakilaTables, sakilaSqlViews }