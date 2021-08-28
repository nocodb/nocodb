const genTest = (type, meta) => {

  describe(`${meta ? 'Meta - ' : ''}${type.toUpperCase()} api - Table`, () => {

    before(() => {
      cy.waitForSpinners();
      if (type === 'rest') {
        cy.openOrCreateRestProject({
          new: true,
          meta
        });
      } else {
        cy.openOrCreateGqlProject({
          new: true,
          meta
        });
      }
    });

    const name = 'Test' + Date.now();


    // create a new random table
    it('Create Table', () => {
      cy.get('.add-btn').click();
      cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
      if (!meta) {
        cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
      }
      cy.wait(5000)
      cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
      cy.get(`.project-tab:contains(${name})`).should('exist')
      cy.url().should('contain', `?name=${name}&`)
    });


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
}


genTest('rest')
genTest('graphql')
genTest('rest', true)
genTest('graphql', true)

