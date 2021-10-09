
import { loginPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { roles } from "../../support/page_objects/projectConstants"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`Swagger API - Test preparation`, () => {
        before(()=> {
            loginPage.loginAndOpenProject('rest', false)
        })

        it("[REST] open project & record swagger URL, AuthToken", () => {
            let authToken = mainPage.getAuthToken()
            cy.url().then( (url) => {
                // retrieve project name from URL & use it to construct Swagger URL
                // URL on homepage: http://localhost:3000/#/nc/externalrest_weUO?type=roles&dbalias=&name=Team%20%26%20Auth%20
                // Swagger URL: http://localhost:8080/nc/externalrest_weUO/db/swagger
                //
                const projectName = url.split("/")[5].split("?")[0];
                let swaggerURL = `http://localhost:8080/nc/${projectName}/db/swagger`

                // exchange information between two tests using a file
                // https://stackoverflow.com/questions/52050657/what-is-the-best-practice-of-pass-states-between-tests-in-cypress
                // 
                cy.writeFile("shared.json", {SWAGGER_URL: swaggerURL, AUTH_TOKEN: authToken})
        })
        })
    })

    describe(`Swagger page, base verification`, () => {

        // returns swagger button intended for
        //
        const getSwaggerButton = (tag, idx, desc) => {
            return cy.get(`#operations-tag-${tag}`).next().find('.opblock').eq(idx).find(`button:contains(${desc})`)
        }

        let Token

        // basic authentication tag verification
        //
        it("Swagger URL access & basic validation", () => {
            // retrieve information stored in previous IT block
            //
            cy.readFile("shared.json").then((jsonPayload) => {
                let URL = jsonPayload.SWAGGER_URL
                Token = jsonPayload.AUTH_TOKEN

                cy.visit(URL)
                cy.log(Token)

                // validate; API order assumed
                cy.get('#operations-tag-Authentication').next().find('.opblock').should('has.length', 9)
                getSwaggerButton("Authentication", 0, "User login").should('exist')
                getSwaggerButton("Authentication", 1, "User signup").should('exist')
                getSwaggerButton("Authentication", 2, "Password Forgot").should('exist')
                getSwaggerButton("Authentication", 3, "Email validate link").should('exist')
                getSwaggerButton("Authentication", 4, "Validate password reset token").should('exist')
                getSwaggerButton("Authentication", 5, "Password reset").should('exist')
                getSwaggerButton("Authentication", 6, "User details").should('exist')
                getSwaggerButton("Authentication", 7, "Update user details").should('exist')
                getSwaggerButton("Authentication", 8, "Update user details").should('exist')
            })
        })

        it("Authorize success: Valid token", ()=> {
            // authorize button, feed token, click authorize
            cy.get('[class="btn authorize unlocked"]').click()
            cy.get('input').type(Token)
            cy.get('.auth-btn-wrapper > .authorize').click()

            // Response: "Authorized" should exist on DOM
            cy.get('.auth-container').contains('Authorized').should('exist')        
            cy.get('.btn-done').click()

            // Authorize button is LOCKED now
            cy.get('[class="btn authorize locked"]').should('exist')
        })

        it("Execute Authentication (valid token case) > GET: User details API", ()=> {  
            // Auth> User details API  
            getSwaggerButton("Authentication", 6, "User details").click()

            // "Try it out" button, followed by "Execute"
            cy.get('.try-out > .btn').click()
            cy.get('.execute-wrapper > .btn').click()

            // check response: validate email credentials
            cy.get('.highlight-code > .microlight').contains('email').should('exist')
            cy.get('.highlight-code > .microlight').contains(roles.owner.credentials.username).should('exist')

            // reset operations (clear, cancel, windback User details tab)
            cy.get('.btn-clear').click()
            cy.get('.try-out > .btn').click()
            getSwaggerButton("Authentication", 6, "User details").click()
        })

        it("Logout post authorization", ()=> {
            // authorize button, logout
            cy.get('[class="btn authorize locked"]').click()
            cy.get('.auth-btn-wrapper > button:contains("Logout")').click()
            cy.get('.btn-done').click()

            // Authorize button is UNLOCKED now
            cy.get('[class="btn authorize unlocked"]').should('exist')
        })    

        it("Execute Authentication (logout case) > GET: User details API", ()=> {    
            // Auth> User details API  
            getSwaggerButton("Authentication", 6, "User details").click()

            // "Try it out" button, followed by "Execute"
            cy.get('.try-out > .btn').click()
            cy.get('.execute-wrapper > .btn').click()

            // check response: email credentials shouldnt exist. should display 'guest:true'
            cy.get('.highlight-code > .microlight').contains('guest').should('exist')
            cy.get('.highlight-code > .microlight').contains('email').should('not.exist')
            cy.get('.highlight-code > .microlight').contains(roles.owner.credentials.username).should('not.exist')

            // reset operations (clear, cancel, windback User details tab)
            cy.get('.btn-clear').click()
            cy.get('.try-out > .btn').click()
            getSwaggerButton("Authentication", 6, "User details").click()        
        })

        it("Authorize failure: invalid token", ()=> {
            // authorize button, feed *invalid* token, click authorize
            cy.get('[class="btn authorize unlocked"]').click()
            cy.get('input').type('xyz')
            cy.get('.auth-btn-wrapper > .authorize').click()

            // Response: "Authorized" should *not* exist on DOM
            // TBD: cy.get('.auth-container').contains('Authorized').should('not.exist')        
            cy.get('.btn-done').click()

            // Authorize button should be UNLOCKED now
            // TBD: cy.get('[class="btn authorize unlocked"]').should('exist')
        })    

        it("Execute Authentication (invalid token case) > GET: User details API", ()=> {    
            // Auth> User details API  
            getSwaggerButton("Authentication", 6, "User details").click()

            // "Try it out" button, followed by "Execute"
            cy.get('.try-out > .btn').click()
            cy.get('.execute-wrapper > .btn').click()

            // check response: email credentials shouldnt exist. should display 'guest:true'
            cy.get('.highlight-code > .microlight').contains('guest').should('exist')
            cy.get('.highlight-code > .microlight').contains('email').should('not.exist')
            cy.get('.highlight-code > .microlight').contains(roles.owner.credentials.username).should('not.exist')

            // reset operations (clear, cancel, windback User details tab)
            cy.get('.btn-clear').click()
            cy.get('.try-out > .btn').click()
            getSwaggerButton("Authentication", 6, "User details").click()         
        })

        // clean-up created file (shared.json)
        after(() => {
            cy.exec("del shared.json").then(()=> {
                cy.log("file cleaned up!")
            })
        })
    })
}

genTest('rest', false)
