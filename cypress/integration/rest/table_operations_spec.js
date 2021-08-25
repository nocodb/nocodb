describe('Rest api - Table', () => {

  const name = 'Test' + Date.now();

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateRestProject();
  })

  it('Create Table', () => {
    cy.get('.add-btn').click();
    cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
    cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
    cy.wait(5000)
    cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
    cy.get(`.project-tab:contains(${name})`).should('exist')
    cy.url().should('contain', `?name=${name}&`)
  });

  it('Create Table Column', () => {


    cy.get('.nc-project-tree :contains(Tables)', {timeout: 10000})
      .first().click()
      .contains(name, {timeout: 6000}).first().click({force: true});
    cy.get(`.project-tab:contains(${name}):visible`).should('exist')

    cy.get('.v-window-item--active .nc-grid  tr > th:last button').click();


  });


  it('Delete Table', () => {
    cy.get('.nc-project-tree :contains(Tables)', {timeout: 10000})
      .first().click()
      .contains(name, {timeout: 6000}).first().click({force: true});
    cy.get(`.project-tab:contains(${name}):visible`).should('exist')

    cy.get('.nc-table-delete-btn:visible').click()

    cy.get('button:contains(Submit)').click()
    cy.get(`.project-tab:contains(${name}):visible`).first().should('not.exist')
  });


})
