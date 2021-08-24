describe('GraphQL api - Existing table with M2M', () => {

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateGqlProject();
  })

  it('Open Actor table', () => {

    cy.get('.nc-project-tree :contains(Tables)', {timeout: 10000})
      .first().click()
      .contains('Actor', {timeout: 6000}).first().click({force: true});


    cy.get(`.project-tab:contains(Actor)`).should('exist')
    cy.url().should('contain', `?name=Actor&`)

    cy.get('td[data-col="Actor <=> Film"] div', {timeout:12000}).first().click({force: true})
    cy.get('td[data-col="Actor <=> Film"] div .mdi-arrow-expand').first().click({force: true})
    //
    // cy.get(":contains(Link to 'City')").should('exist')
    //
    // cy.get(":contains(Link to 'City'):visible").click()

    cy.get('.child-card:visible').should('exist').first().click()

    cy.contains('Save Row').should('exist');
    cy.contains('Save Row').should('exist');

  });


})
