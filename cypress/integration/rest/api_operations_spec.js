describe('Rest api - CRUD/Filter', () => {

  before(() => {
    cy.waitForSpinners();
    cy.openOrCreateRestProject();

    // open country table
    cy.openTableTab('Country');
    // cy.intercept({
    //   method: "GET",
    //   url: "/nc/**/api/v1/Country**",
    //   hostname: 'localhost',
    //   port: 8080
    // }).as("dataGetFirst");
    // cy.wait("@dataGetFirst");
    // todo: wait until api call completes
    cy.wait(2000)

  })

  // check pagination
  it('Check country table - ', () => {
    cy.get('.nc-pagination').should('exist');
    cy.get('.nc-pagination .v-pagination > li:last-child').click()
    cy.get('.nc-pagination .v-pagination > li:contains(2)').should('have.class', 'v-pagination__item--active')
  });

  // create new row
  it('Create new row', () => {
    cy.get('.nc-add-new-row-btn').click();

    cy.get('#data-table-form-Country > input').first().type('Test Country');

    cy.contains('Save Row').filter('button').click()

    // todo: verify
  })

  // Test sort
  it('Add sort option', () => {
    cy.get('.nc-sort-menu-btn').click()
    cy.contains('Add Sort Option').click();
    cy.get('.nc-sort-field-select div').first().click()
    cy.get('.menuable__content__active .v-list-item:contains(Country)').click()
    cy.get('.nc-sort-dir-select div').first().click()
    cy.get('.menuable__content__active .v-list-item:contains("Z -> A")').click()
    cy.contains('Zambia').should('exist')
  })


  // Test fields
  it('Add fields options', () => {
    cy.get('.nc-fields-menu-btn').click()
    cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
    cy.get('th:contains(LastUpdate)').should('not.exist')
  })


  // Test filter
  it('Add filter options', () => {
    cy.get('.nc-filter-menu-btn').click()
    cy.contains('Add Filter').click();

    cy.get('.nc-filter-field-select').last().click();
    cy.get('.menuable__content__active .v-list-item:contains(Country)').click()
    cy.get('.nc-filter-operation-select').last().click();
    cy.get('.menuable__content__active .v-list-item:contains("is equal")').click()
    cy.get('.nc-filter-value-select input:text').last().type('India');

    cy.get('td:contains(India)').should('exist')

  })

})
