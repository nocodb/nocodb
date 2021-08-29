const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table Row`, () => {
    const randVal = 'Test' + Date.now();
    const updatedRandVal = 'Updated' + Date.now();
    const name = 'Tablerow' + Date.now();

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


    it('Add new row', () => {
      cy.get('.nc-add-new-row-btn').click({force: true});

      cy.get('#data-table-form-Title > input').first().type(randVal);

      cy.contains('Save Row').filter('button').click({force: true})

      cy.get('td').contains(randVal).should('exist');

    })

    it('Update row', () => {
      cy.get('td').contains(randVal)
        .closest('tr')
        .find('.nc-row-expand-icon')
        .click({force: true});


      cy.get('#data-table-form-Title > input').first().clear().type(updatedRandVal);
      cy.contains('Save Row').filter('button').click({force: true})


      cy.get('td').contains(updatedRandVal).should('exist');
      cy.get('td').contains(randVal).should('not.exist');

    })


    it('Delete row', () => {
      cy.get('td').contains(updatedRandVal).rightclick({force: true})

      // delete row
      cy.getActiveMenu().find('.v-list-item:contains("Delete Row")').first().click({force: true})
      cy.wait(1000)
      cy.get('td').contains(randVal).should('not.exist');
    })

  });
}


genTest('rest')
genTest('graphql')

