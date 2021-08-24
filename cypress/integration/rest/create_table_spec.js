describe('Rest api - New table', () => {

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateRestProject();
  })

  it('Create Table', () => {
    cy.get('.add-btn').click();
    const name = 'Test' + Date.now();
    cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
    cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
    cy.wait(5000)
    cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
    cy.get(`.project-tab:contains(${name})`).should('exist')
    cy.url().should('contain', `?name=${name}&`)
  });


})
