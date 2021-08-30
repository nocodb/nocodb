const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Rollup column`, () => {
    const colName = 'column_name' + Date.now();
    const updatedColName = 'updated_name' + Date.now();
    before(() => {
      cy.waitForSpinners();
      if (type === 'rest') {
        cy.openOrCreateRestProject({
          new:true
        });
      } else {
        cy.openOrCreateGqlProject({
          new:true
        });
      }
      cy.openTableTab('Country');
    });

    it('Add rollup column', () => {

      cy.get('.v-window-item--active .nc-grid  tr > th:last button').click({force: true});

      cy.get('.nc-column-name-input input').clear().type(colName)

      cy.get('.nc-ui-dt-dropdown').click()
      cy.getActiveMenu().contains('Rollup').click()

      cy.get('.nc-rollup-table').click();
      cy.getActiveMenu().contains('City').click();
      cy.get('.nc-rollup-column').click();
      cy.getActiveMenu().contains('CityId').click();
      cy.get('.nc-rollup-fn').click();
      cy.getActiveMenu().contains('count').click();


      cy.get('.nc-col-create-or-edit-card').contains('Save').click()
      cy
        .get(`th:contains(${colName})`)
        .should('exist');
      cy.wait(500)

      cy.get(`td[data-col="${colName}"]`).first().invoke('text').should('match', /^\s*\d+\s*$/)


    })


    // edit the newly created column
    it('Edit table column - rename', () => {


      cy.get(`th:contains(${colName}) .mdi-menu-down`)
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()

      // rename column and verify
      cy.get('.nc-column-name-input input').clear().type(updatedColName)
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()


      cy
        .get(`th:contains(${updatedColName})`)
        .should('exist');
      cy
        .get(`th:contains(${colName})`)
        .should('not.exist');


    })


    // delete the newly created column
    it('Delete table column', () => {
      cy
        .get(`th:contains(${updatedColName})`)
        .should('exist');

      cy.get(`th:contains(${updatedColName}) .mdi-menu-down`)
        .trigger('mouseover')
        .click()

      cy.get('.nc-column-delete').click()
      cy.getActiveModal().find('button:contains(Confirm)').click()


      cy
        .get(`th:contains(${updatedColName})`)
        .should('not.exist');

    })


  });
}


genTest('rest')
genTest('graphql')

