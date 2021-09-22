
import { loginPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"

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

    // basic authentication tag verification
    //
    it("Swagger URL access & basic validation", () => {
        // retrieve information stored in previous IT block
        //
        cy.readFile("shared.json").then((jsonPayload) => {
            let URL = jsonPayload.SWAGGER_URL
            let Token = jsonPayload.AUTH_TOKEN

            cy.visit(URL)
            cy.log(Token)

            // validate
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

    // clean-up created file
    after(() => {
        cy.exec("del shared.json").then(()=> {
            cy.log("file cleaned up!")
        })
    })
})
