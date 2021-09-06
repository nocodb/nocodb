/**
 *  file: navigation.js
 *  purpose: signUp/ projects page navigation options
 *  author: raju udava
 *  date: 06 Sep 2020
 *
 **/


///////////////////////////////////////////////////////////
// Sign in/ Sign up page


// list of hard-wired URL that can be used by nocodb
// suffix to baseUrl needs to be defined here
//
const urlPool = {
    ncUrlBase: "/",
    ncUrlSignUp: "#/user/authentication/signup",
    ncUrlSignIn: "#/user/authentication/signin"
}

export class _loginPage {

    // prefix: baseUrl
    go(urlKey) {
        cy.visit(urlKey)
    }

    // visit SignIn URL, enter credentials passed as parameters
    //
    signIn(userCredentials) {
        this.go(urlPool.ncUrlSignIn)

        cy.get('input[type="text"]').type(userCredentials.username)
        cy.get('input[type="password"]').type(userCredentials.password)
        cy.get('button:contains("SIGN IN")').click()

        this.waitProjectPageLoad()
    }

    // visit SignUp URL, enter credentials passed as parameters
    //
    signUp(userCredentials) {
        this.go(urlPool.ncUrlSignUp)

        cy.get('input[type="text"]').type(userCredentials.username)
        cy.get('input[type="password"]').type(userCredentials.password)
        cy.get('button:contains("SIGN UP")').click()

        this.waitProjectPageLoad()
    }

    // delay/ wait utility routines
    //
    waitProjectPageLoad() {
        cy.url({ timeout: 6000 }).should('contain', '#/project')
        cy.wait(1000)
    }
}


///////////////////////////////////////////////////////////
// Projects page

// DB type
const NC_DB_NONE = 0
const NC_DB_EXISTING = 1

// API type
const NC_REST = 0
const NC_GQL = 1


export class _projectsPage {

    // Project creation options
    //

    // {dbType, apiType, name}

    // Open existing project
    // TODO: add projectName validation
    // 
    openProject(projectName) {
        cy.get('tbody').contains('tr', projectName).click()

        // takes a while to load project
        this.waitHomePageLoad()
    }

    // Create new project
    // Input: {dbType, apiType, name}
    // Returns: projectName
    // 
    createProject(projectData) {

        cy.get('body', { timeout: 2000 })

        if (NC_DB_NONE == projectData.dbType) {

            let projectName = projectData.name

            if (projectData.name == '')
                projectName = 'test_proj' + Date.now()

            // click on "New Project" 
            cy.get(':nth-child(5) > .v-btn').click()

            // Subsequent form, select (+ Create) option
            cy.get('.nc-create-xc-db-project').click({ force: true })

            // feed project name
            cy.get('.nc-metadb-project-name').type(projectName)

            // Radio button: defaults to NC_REST
            if (NC_GQL == projectData.apiType) {
                cy.contains('GRAPHQL APIs').closest('label').click();
            }

            // Submit
            cy.contains('button', 'Create', { timeout: 3000 }).click()

            // takes a while to load project
            this.waitHomePageLoad()

            return projectName
        }
        else {

            // Existing database connections
            // TBD

        }
    }


    // Click on refresh key on projects page
    //
    refreshProject() {
        cy.contains('My Projects').parent().find('button').click();
        cy.wait(1000)
    }

    // search project with given key
    // return project-name array
    //
    searchProject(projectNameKey) {
        cy.get('input[placeholder="Search Project"]').type(projectNameKey)

        const projectName = []

        cy.get('table tr').each((tableRow) => {

            cy.wrap(tableRow).find('td').eq(0).find('.title').then((input) => {
                projectName.push(input.text())
            })
        })
            .then(() => {

                // TBD: validate project name to contain search key
                console.log(projectName)
                return projectName
            })
    }

    // remove specified project entry
    // TODO: error handling
    //
    deleteProject(name) {

        // delete icon
        cy.get('tbody').contains('tr', name).find('.mdi-delete-circle-outline').click()
        this.waitDeletePageLoad()

        // pop-up, submit
        cy.get('body').then((body) => {
            cy.wrap(body).find('button').contains('Submit').click()
        })
    }

    // remove all projects created
    //
    // 1. read all project names to be deleted, store in array
    // 2. invoke delete project for each entry in array
    //
    deleteAllProject() {

        const projectName = []

        cy.get('table tr').each((tableRow) => {

            cy.wrap(tableRow).find('td').eq(0).find('.title').then((input) => {
                projectName.push(input.text())
            })
        })
            .then(() => {
                console.log(projectName)
                projectName.forEach(element => {

                    // bring back the DOM to normalcy
                    cy.get('div').parentsUntil('body')
                    this.deleteProject(element)

                    // wait needed for pop up to disapper
                    this.waitDeletePageLoad()
                })
            })
    }

    waitHomePageLoad() {
        cy.url({ timeout: 12000 }).should('contain', '?type=roles')
    }

    waitDeletePageLoad() {
        cy.wait(1000)
    }
}

export const loginPage = new _loginPage;
export const projectsPage = new _projectsPage;
