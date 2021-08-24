// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// for waiting until page load
Cypress.Commands.add('waitForSpinners', () => {
  cy.visit('http://localhost:3000', {retryOnNetworkFailure: true, timeout: 120000})
  cy.get('#nuxt-loading', {timeout: 10_000}).should('have.length', 0)
})
Cypress.Commands.add('signinOrSignup', () => {

  // signin/signup
  cy.get('body').then(($body) => {
    cy.wait(1000)
    cy.url().then(url => {
      if (!url.includes('/projects')) {
        // handle initial load
        if ($body.find('.welcome-page').length > 0) {
          cy.wait(8000);
          cy.get('body').trigger('mousemove');
          cy.contains('Let\'s Begin').click();
          cy.get('input[type="text"]').type('pranavc@gmail.com');
          cy.get('input[type="password"]').type('Password123.');
          cy.get('button:contains("SIGN UP")').click()

          // handle signin
        } else {
          cy.get('input[type="text"]').type('pranavc@gmail.com');
          cy.get('input[type="password"]').type('Password123.');
          cy.get('button:contains("SIGN IN")').click()
        }
      }

    })
  })
});
// for opening/creating a rest project
Cypress.Commands.add('openOrCreateRestProject', () => {

  // signin/signup
  cy.signinOrSignup()
  cy.wait(2000);
  cy.get('body').then($body => {
    // if project exist open
    if ($body.find('.nc-rest-project-row').length) {
      cy.get('.nc-rest-project-row').first().click()
      // create new project
    } else {
      cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
      cy.get('.create-external-db-project').click()
      cy.url({timeout: 6000}).should('contain', '#/project')
      cy.get('.database-field input').click().clear().type('sakila')
      cy.contains('Test Database Connection').click()
      cy.contains('Ok & Save Project', {timeout: 3000}).click()
    }
  })
  cy.url({timeout: 20000}).should('contain', '#/nc/')

})


Cypress.Commands.add('openOrCreateGqlProject', () => {

  cy.signinOrSignup()


  cy.wait(2000);
  cy.get('body').then($body => {
    // if project exist open
    if ($body.find('.nc-graphql-project-row').length) {
      cy.get('.nc-graphql-project-row').first().click()
      // create new project
    } else {
      cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
      cy.get('.create-external-db-project').click()
      cy.url({timeout: 6000}).should('contain', '#/project')
      cy.contains('GRAPHQL APIs').closest('label').click()
      cy.get('.database-field input').click().clear().type('sakila')
      cy.contains('Test Database Connection').click()
      cy.contains('Ok & Save Project', {timeout: 3000}).click()
    }
  })
  cy.url({timeout: 20000}).should('contain', '#/nc/')

})
