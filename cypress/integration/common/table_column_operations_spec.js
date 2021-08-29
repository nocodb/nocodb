const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table Column`, () => {
    const name = 'Table' + Date.now();

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

      cy.createTable(name)
    });

    // delete table
    after(() => {
      cy.deleteTable(name)
    });

    it('Create Table Column', () => {
      // cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
      //   .first().click()
      //
      // cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});

      cy.get(`.project-tab:contains(${name}):visible`).should('exist')

      cy.get('.v-window-item--active .nc-grid  tr > th:last button').click({force: true});
      cy.get('.nc-column-name-input input').clear().type('new_column')
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()
      cy
        .get('th:contains(new_column)')
        .should('exist');
    });


    // edit the newly created column
    it('Edit table column - rename & uidt update', () => {


      cy.get('th:contains(new_column) .mdi-menu-down')
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()


      // change column type and verify
      cy.get('.nc-ui-dt-dropdown').click()
      cy.contains('LongText').click()
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()

      cy.get('th[data-col="new_column"] .mdi-text-subject').should('exist')


      cy.get('th:contains(new_column) .mdi-menu-down')
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()


    })

    // edit the newly created column
    it('Edit table column - rename', () => {


      cy.get('th:contains(new_column) .mdi-menu-down')
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()

      // rename column and verify
      cy.get('.nc-column-name-input input').clear().type('updated_column')
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()


      cy
        .get('th:contains(updated_column)')
        .should('exist');
      cy
        .get('th:contains(new_column)')
        .should('not.exist');


    })


    // delete the newly created column
    it('Delete table column', () => {
      cy
        .get('th:contains(updated_column)')
        .should('exist');

      cy.get('th:contains(updated_column) .mdi-menu-down')
        .trigger('mouseover')
        .click()

      cy.get('.nc-column-delete').click()
      cy.get('button:contains(Confirm)').click()


      cy
        .get('th:contains(updated_column)')
        .should('not.exist');

    })


  });
}


genTest('rest')
genTest('graphql')

