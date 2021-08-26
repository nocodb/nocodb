describe('Rest api - CRUD/Filter', () => {

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateRestProject();

    // open country table
    cy.openTableTab('Country');

  })

  // create a new random table
  it('Check country table - ', () => {
    cy.get('.nc-pagination').should('exist')
  });


})
