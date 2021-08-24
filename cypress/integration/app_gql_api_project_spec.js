describe('GraphQL api project test', () => {

/*
  before(() => {
    cy.visit('http://localhost:3000', {retryOnNetworkFailure: true, timeout: 120000})
    cy.waitForSpinners();
  })

  it('Sign Up / Sign In', () => {
    // console.log('=====',cy.$$(cy.get('body')).find('.welcome-page').length)
    cy.get('body').then(($body) => {
      if ($body.find('.welcome-page').length > 0) {

        // if (cy.get('body').find('.welcome-page').should('exist')) {
        cy.wait(8000);
        cy.get('body').trigger('mousemove');
        cy.contains('Let\'s Begin').click();
        cy.get('input[type="text"]').type('pranavc@gmail.com');
        cy.get('input[type="password"]').type('Password123.');
        cy.get('button:contains("SIGN UP")').click()
        // cy.url().shou
      } else {
        cy.get('input[type="text"]').type('pranavc@gmail.com');
        cy.get('input[type="password"]').type('Password123.');
        cy.get('button:contains("SIGN IN")').click()
      }
    });

  });

  it('Create Project', () => {
    cy.wait(1500);
    cy.get('body').then($el => {
      if ($el.find('.project-row').length) {
        cy.get('.project-row').first().click();
      } else {
        cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
        cy.get('.create-external-db-project').click()

        cy.wait(1500);
        cy.url().should('contain', '#/project')
        cy.get('.database-field input').click().clear().type('sakila')
        cy.contains('Test Database Connection').click()

        cy.wait(1500);
        cy.contains('Ok & Save Project').click()

      }
      cy.wait(5000);
      cy.url().should('contain', '#/nc/')
    })


  });


  it('Create Table', () => {
    cy.get('.add-btn').click();
    const name = 'Test' + Date.now();
    cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
    cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
    cy.wait(5000)
    cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
    cy.get(`.project-tab:contains(${name})`).should('exist')
    cy.url().should('contain', `?name=${name}&`)
  });


  it('Open and check country table', () => {
    cy.contains('Country').click();

    cy.get(`.project-tab:contains(Country)`).should('exist')
    cy.url().should('contain', `?name=Country&`)

    cy.get('td[data-col="Country => City"] div').first().click()
    cy.get('td[data-col="Country => City"] div .mdi-arrow-expand').first().click()

    cy.get(":contains(Link to 'City')").should('exist')

    cy.get(":contains(Link to 'City'):visible").click()
  });

  it('Open and check actor table for m2m', () => {
    cy.contains('Actor').click();

    cy.get(`.project-tab:contains(Actor)`).should('exist')
    cy.url().should('contain', `?name=Actor&`)

    cy.get('td[data-col="Actor <=> Film"] div').first().click()
    cy.get('td[data-col="Actor <=> Film"] div .mdi-arrow-expand').first().click()
    //
    // cy.get(":contains(Link to 'City')").should('exist')
    //
    // cy.get(":contains(Link to 'City'):visible").click()
  });
*/

})
