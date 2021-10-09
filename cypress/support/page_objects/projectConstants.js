
export const defaultDbParams = {
    databaseType: 0, // MySQL
    hostAddress: 'localhost',
    portNumber: '3306',
    username: 'root',
    password: 'password',
    databaseName: 'sakila'
}

// database
//      validation details
//          advSettings: left navigation bar (audit, metadata, auth, transient view modes)
//          editSchema: create table, add/update/delete column
//          editData: add/ update/ delete row, cell contents
//          editComment: add comment
//          shareView: right navigation bar (share options)
export const roles = {
    owner: {
        name: 'owner',
        credentials: { username: 'user@nocodb.com', password: 'Password123.' },
        validations: { advSettings: true, editSchema: true, editData: true, editComment: true, shareView: true }
    },
    creator: {
        name: 'creator',
        credentials: { username: 'creator@nocodb.com', password: 'Password123.' },
        validations: { advSettings: true, editSchema: true, editData: true, editComment: true, shareView: true }
    },
    editor: {
        name: 'editor',
        credentials: { username: 'editor@nocodb.com', password: 'Password123.' },
        validations: { advSettings: false, editSchema: false, editData: true, editComment: true, shareView: false }
    },
    commenter: {
        name: 'commenter',
        credentials: { username: 'commenter@nocodb.com', password: 'Password123.' },
        validations: { advSettings: false, editSchema: false, editData: false, editComment: true, shareView: false }
    },
    viewer: {
        name: 'viewer',
        credentials: { username: 'viewer@nocodb.com', password: 'Password123.' },
        validations: { advSettings: false, editSchema: false, editData: false, editComment: false, shareView: false }
    }
}

// default projects
//
export const staticProjects = {
    sampleREST: {
        basic: { dbType: 'none', apiType: 'REST', name: 'sampleREST' }, 
        config: {}
    },
    sampleGQL: {
        basic: { dbType: 'none', apiType: 'GQL', name: 'sampleGQL' }, 
        config: {}
    },
    externalREST: {
        basic: { dbType: 'external', apiType: 'REST', name: 'externalREST' }, 
        config: defaultDbParams
    },
    externalGQL: {
        basic: { dbType: 'external', apiType: 'GQL', name: 'externalGQL' }, 
        config: defaultDbParams
    }
}

// return TRUE if test suite specified is activated from env-variables
//
export const isTestSuiteActive = (type, xcdb) => {
    const env = Cypress.env('testMode')
    if( !xcdb ) {
        switch( type ) {
            case 'rest': return env.includes('extREST')?true:false;
            case 'graphql': return env.includes('extGQL')?true:false;
        }
    } else {
        switch( type ) {
            case 'rest': return env.includes('xcdbREST')?true:false;
            case 'graphql': return env.includes('xcdbGQL')?true:false;
        }
    }
}

// expecting different modes to be seperated by a .
export const getPrimarySuite = () => {
    const env = Cypress.env('testMode').split('.')
    switch(env[0]) {
        case 'extREST': return staticProjects.externalREST;
        case 'extGQL': return staticProjects.externalGQL;
        case 'xcdbREST': return staticProjects.sampleREST;
        case 'xcdbGQL': return staticProjects.sampleGQL;
    }
}

export const isSecondarySuite = (proj, xcdb) => {
    if(!isTestSuiteActive(proj, xcdb))
        return false;
    
    const env = Cypress.env('testMode').split('.')
   
    switch(env[0]) {
        case 'extREST': return (proj=='rest' && !xcdb)?false:true;
        case 'extGQL': return (proj=='graphql' && !xcdb)?false:true;
        case 'xcdbREST': return (proj=='rest' && xcdb)?false:true;
        case 'xcdbGQL': return (proj=='graphql' && xcdb)?false:true;
    }    
}