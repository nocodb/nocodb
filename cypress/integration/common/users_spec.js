const genTest = (type) => {

  describe(`${type.toUpperCase()} api - User Management`, () => {

    before(() => {
      cy.waitForSpinners();
      if (type === 'rest') {
        cy.openOrCreateRestProject({
          new: true
        });
      } else {
        cy.openOrCreateGqlProject({
          new: true
        });
      }
    });

    const email = `noco${Date.now()}@gmail.com`;


    it('Add  new user', () => {
      cy.get('.v-list-item:contains("Team & Auth")').click();

      cy.get(`.project-tab:contains("Team & Auth"):visible`).should('exist')
      cy.get(`td:contains("pranavc@gmail.com")`).should('exist')

      cy.get('button:contains("New User")').first().click()

      cy.get('label:contains(Email)').next('input').type(email).trigger('input')


      cy.get('.nc-invite-or-save-btn').then($el => {
        cy.wrap($el[0]).click()

        // cy.contains('.v-alert', /http:\/\/locahost/).should('exist')
        cy.contains('.v-alert', '#/user/authentication/signup/').should('exist')
      })


    })


  })
}


genTest('rest')
genTest('graphql')
