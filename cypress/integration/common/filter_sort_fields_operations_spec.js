const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Filter, Fields,  Sort`, () => {

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
    it('Check country table - Pagination', () => {
      cy.get('.nc-pagination').should('exist');
      cy.get('.nc-pagination .v-pagination > li:last-child').click()
      cy.get('.nc-pagination .v-pagination > li:contains(2) button').should('have.class', 'v-pagination__item--active')

      cy.get('.nc-pagination .v-pagination > li:first-child').click()
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

      // remove sort and check
      cy.get('.nc-sort-item-remove-btn').click()
      cy.contains('Zambia').should('not.exist')
    })


    describe('Field Operation', () => {

      before(() => {
        cy.get('.nc-fields-menu-btn').click()
      })
      if ('Hide field', () => {
        cy.get('th:contains(LastUpdate)').should('be.visible')
        // toggle and confirm it's hidden
        cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
        cy.get('th:contains(LastUpdate)').should('not.be.visible')
      })

      it('Show field', () => {
        cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
        cy.get('th:contains(LastUpdate)').should('be.visible')
      })
    })


    // Test fields
    // it('Add fields options', () => {


      // toggle and confirm it's visible
      // // cy.get('.nc-fields-menu-btn').click()
      // cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
      // cy.get('th:contains(LastUpdate)').should('be.visible')


      // cy.get('.menuable__content__active .v-list-item label:contains(Country)').closest('.v-list-item').dragTo('.v-list-item:has(.menuable__content__active .v-list-item label:contains(LastUpdate)')
      /*    cy.get('.nc-fields-menu-btn').click()


          cy.get('.menuable__content__active .v-list-item').eq(1).invoke('attr','draggable', 'true')

          cy.get('.menuable__content__active .v-list-item').eq(1).drag('.menuable__content__active .v-list > d')
          cy.get('.menuable__content__active .v-list-item').eq(1).move({x: 100, y: 100})


          cy.get('.menuable__content__active .v-list-item').then($el => {
            const draggable = $el[1]; // Cypress.$('.menuable__content__active .v-list-item label:contains(Country)').closest('.v-list-item')[0]  // Pick up this
            const droppable = $el[$el.length - 3];
            draggable.setAttribute('draggable', 'true')
            // console.log(draggable, droppable)
            // const coords = droppable.getBoundingClientRect()
            // cy.wrap(draggable).click().dragTo(droppable)


            // cy.wrap(draggable).trigger("dragstart");
            // cy.wrap(droppable).trigger("drop");

            // cy.wrap(draggable).drop(droppable);


            // draggable.parentElement.dispatchEvent(new MouseEvent('dragenter'))
            // draggable.parentElement.dispatchEvent(new MouseEvent('dragover'))
            // draggable.dispatchEvent(new MouseEvent('pointerdown'))
            // draggable.dispatchEvent(new MouseEvent('mousemove'));
            // draggable.dispatchEvent(new MouseEvent('mousedown'));
            // draggable.dispatchEvent(new MouseEvent('mousemove', {clientX: 10, clientY: 0}));
            // draggable.dispatchEvent(new MouseEvent('mousemove', {clientX: coords.x + 10, clientY: coords.y + 10}));
            // draggable.dispatchEvent(new MouseEvent('mouseup'));
          })*/

    // })


    describe('Filter operations', () => {

      it('Create Filter', () => {
        cy.get('.nc-filter-menu-btn').click()
        cy.contains('Add Filter').click();

        cy.get('.nc-filter-field-select').last().click();
        cy.get('.menuable__content__active .v-list-item:contains(Country)').click()
        cy.get('.nc-filter-operation-select').last().click();
        cy.get('.menuable__content__active .v-list-item:contains("is equal")').click()
        cy.get('.nc-filter-value-select input:text').last().type('India');

        cy.get('td:contains(India)').should('exist')
      })

      it('Delete Filter', () => {

        // remove sort and check
        cy.get('.nc-filter-item-remove-btn').click()
        cy.contains('td:contains(India)').should('not.exist')

      })

    })


    //
    // // Test filter
    // it('Add filter options', () => {
    //
    //
    // })

  })
}


genTest('rest')
genTest('graphql')
