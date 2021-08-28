const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table views`, () => {

    const name = 'Test' + Date.now();

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
      cy.openTableTab('Country');
    })

    it('Create grid view', () => {
      cy.get('.nc-create-grid-view').click();
      cy.getActiveModal().find('button:contains(Submit)').click()
      cy.get('.nc-view-item.nc-grid-view-item').should('exist')
    })
    it('Create gallery view', () => {
      cy.get('.nc-create-gallery-view').click();
      cy.getActiveModal().find('button:contains(Submit)').click()
      cy.get('.nc-view-item.nc-gallery-view-item').should('exist')
    })
    /*  it('Delete grid view', () => {
        cy.get('.nc-view-item.nc-grid-view-item').then($items => {
          cy.get('.nc-view-item.nc-grid-view-item .nc-view-delete-icon').last().invoke('show').click()
          expect(Cypress.$('.nc-view-item.nc-grid-view-item').length).to.be.lt($items.length)
        })
      })
      it('Delete gallery view', () => {
        cy.get('.nc-view-item.nc-gallery-view-item').then($items => {
          cy.get('.nc-view-item.nc-gallery-view-item .nc-view-delete-icon').last().invoke('show').click()
          expect(Cypress.$('.nc-view-item.nc-gallery-view-item').length).to.be.lt($items.length)
        })

      })*/


  })
}


genTest('rest')
genTest('graphql')

