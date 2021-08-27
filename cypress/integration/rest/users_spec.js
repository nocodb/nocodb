describe('User mana', () => {
  const email = `noco${Date.now()}@gmail.com`;

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateRestProject();
  })


  it('Add  new user', () => {
    cy.get('.v-list-item:contains("Team & Auth")').click();

    cy.get(`.project-tab:contains("Team & Auth"):visible`).should('exist')
    cy.get(`td:contains("pranavc@gmail.com")`).should('exist')

    cy.get('button:contains("New User")').first().click()

    cy.get('label:contains(Email)').next('input').type(email)

    cy.get('.nc-invite-or-save-btn').click()

  })


})
