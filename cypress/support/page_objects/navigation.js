
import { roles, staticProjects, defaultDbParams } from "./projectConstants"

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

        cy.get('input[type="text"]', {timeout: 20000}).type(userCredentials.username)
        cy.get('input[type="password"]').type(userCredentials.password)
        cy.get('button:contains("SIGN IN")').click()

        this.waitProjectPageLoad()
    }

    // visit SignUp URL, enter credentials passed as parameters
    //
    signUp(userCredentials) {
        this.go(urlPool.ncUrlSignUp)

        cy.get('input[type="text"]', {timeout: 20000}).type(userCredentials.username)
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

    // standard pre-project activity
    //
    loginAndOpenProject(apiType, xcdb) {
        loginPage.signIn(roles.owner.credentials)

        if(!xcdb) {
        if ('rest' == apiType) 
            projectsPage.openProject(staticProjects.externalREST.basic.name)
        else
            projectsPage.openProject(staticProjects.externalGQL.basic.name)        
        }
        else {
            if ('rest' == apiType) 
                projectsPage.openProject(staticProjects.sampleREST.basic.name)
            else
                projectsPage.openProject(staticProjects.sampleGQL.basic.name)  
        }
    }    
}


///////////////////////////////////////////////////////////
// Projects page

export class _projectsPage {

    // Project creation options
    //

    // {dbType, apiType, name}
    // for external database, {databaseType, hostAddress, portNumber, username, password, databaseName}

    // Open existing project
    // TODO: add projectName validation
    // 
    openProject(projectName) {
        cy.get('tbody').contains('tr', projectName).click()

        // takes a while to load project
        this.waitHomePageLoad()
    }

    // Create new project
    // Input: 
    //          projectData     {dbType, apiType, name}
    //          dbCredentials   {databaseType, hostAddress, portNumber, username, password, databaseName}
    // Returns: projectName
    // 
    // To configure
    //      SSL & advanced parameters
    //      Database type selection 
    //
    createProject(projectData, cred) {

        cy.get('body', { timeout: 2000 })

        let projectName = projectData.name

        if (projectData.name == '')
            projectName = 'test_proj' + Date.now()

        // click on "New Project" 
        cy.get(':nth-child(5) > .v-btn').click()

        if ('none' == projectData.dbType) {

            // Subsequent form, select (+ Create) option
            cy.get('.nc-create-xc-db-project').click({ force: true })

            // feed project name
            cy.get('.nc-metadb-project-name').type(projectName)

            // Radio button: defaults to NC_REST
            if ('GQL' == projectData.apiType) {
                cy.contains('GRAPHQL APIs').closest('label').click();
            }

            // Submit
            cy.contains('button', 'Create', { timeout: 3000 }).click()

            // takes a while to load project
            this.waitHomePageLoad()

            return projectName
        }

        // dbType == 'external'
        else {

            // Subsequent form, select (+ Create by connection to external database) option
            cy.get('.nc-create-external-db-project').click({ force: true })

            // feed project name
            //cy.get('.nc-metadb-project-name').type(projectName)
            cy.contains('Enter Project Name').parent().find('input').clear().type(projectName)

            // Radio button: defaults to NC_REST
            if ('GQL' == projectData.apiType) {
                cy.contains('GRAPHQL APIs').closest('label').click();
            }

            // External database credentials
            // cy.contains('Database Type').parent().find('input').eq(1).click()
            // cy.wait(100)
            // cy.get('body').contains(' MySQL ').parents('div').click()

            if (cred.hostAddress != '') cy.contains('Host Address').parent().find('input').clear().type(cred.hostAddress)
            if (cred.portNumber != '') cy.contains('Port Number').parent().find('input').clear().type(cred.portNumber)
            if (cred.username != '') cy.contains('Username').parent().find('input').clear().type(cred.username)
            if (cred.password != '') cy.contains('Password').parent().find('input').clear().type(cred.password)
            if (cred.databaseName != '') cy.contains('Database : create if not exists').parent().find('input').clear().type(cred.databaseName)

            // Test database connection
            cy.contains('Test Database Connection').click()

            // Create project
            cy.contains('Ok & Save Project', { timeout: 6000 }).click()

            // takes a while to load project
            this.waitHomePageLoad()

            return projectName
        }
    }

    // create REST default project (sakila DB)
    //
    createDefaulRestProject() {
        return this.createProject({ dbType: 1, apiType: 0, name: '' }, defaultDbParams )
    }

    // create GraphQL default project (sakila DB)
    //
    createDefaultGraphQlProject() {
        return this.createProject({ dbType: 1, apiType: 1, name: '' }, defaultDbParams )
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
        cy.url({ timeout: 50000 }).should('contain', '?type=roles')
    }

    waitDeletePageLoad() {
        cy.wait(1000)
    }
}

export const loginPage = new _loginPage;
export const projectsPage = new _projectsPage;

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
