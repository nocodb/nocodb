const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table`, () => {

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

      const randVal = 'Test' + Date.now();
      const updatedRandVal = 'Updated' + Date.now();
      const name = 'Test' + Date.now();

      before(() => {
        cy.waitForSpinners();
        cy.openOrCreateRestProject();
      })

      // create a new random table
      it('Create Table', () => {
        cy.get('.add-btn').click();
        cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
        cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
        cy.wait(5000)
        cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
        cy.get(`.project-tab:contains(${name})`).should('exist')
        cy.url().should('contain', `?name=${name}&`)
      });


      // create new row
      it('Create/Edit/Delete row', () => {
        // add new row
        cy.get('.nc-add-new-row-btn').click();

        cy.get('#data-table-form-Title > input').first().type(randVal);

        cy.contains('Save Row').filter('button').click()

        cy.get('td').contains(randVal).should('exist');

        // update row
        cy.get('td').contains(randVal)
          .closest('tr')
          .find('.nc-row-expand-icon')
          .click();


        cy.get('#data-table-form-Title > input').first().clear().type(updatedRandVal);
        cy.contains('Save Row').filter('button').click()

        cy.get('td').contains(updatedRandVal).should('exist');
        cy.get('td').contains(randVal).should('not.exist');

        cy.get('td').contains(updatedRandVal).rightclick()

        // delete row
        cy.getActiveMenu().find('.v-list-item:contains("Delete Row")').first().click()
        cy.wait(1000)
        cy.get('td').contains(randVal).should('not.exist');
      })


      // add new column to newly created table
      it('Create Table Column', () => {
        cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
          .first().click()

        cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});

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


      // delete newly created table
      it('Delete Table', () => {

        cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
          .first().click()

        cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});

        cy.get(`.project-tab:contains(${name}):visible`).should('exist')

        cy.get('.nc-table-delete-btn:visible').click()

        cy.get('button:contains(Submit)').click()
        cy.get(`.project-tab:contains(${name}):visible`).first().should('not.exist')
      });


    })
  });
}


genTest('rest')
genTest('graphql')

