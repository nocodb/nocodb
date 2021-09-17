
import { loginPage } from "../../support/page_objects/navigation"

const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Existing table`, () => {

    before(loginPage.loginAndOpenProject(type))

    it('Open Country table', () => {

      cy.get('.nc-project-tree :contains(Tables)', {timeout: 10000})
        .first().click()
        .contains('Country', {timeout: 6000}).first().click({force: true});

      cy.get(`.project-tab:contains(Country):visible`).should('exist')
      cy.url().should('contain', `?name=Country&`)

      cy.get('td[data-col="Country => City"] div:visible', {timeout: 12000}).first().click()
      cy.get('td[data-col="Country => City"] div .mdi-arrow-expand:visible').first().click()

      cy.get(":contains(Link to 'City'):visible").should('exist')

      cy.get(":contains(Link to 'City'):visible").first().click()
    });


  })
}


genTest('rest')
genTest('graphql')
