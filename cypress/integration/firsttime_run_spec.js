describe('My First Test', () => {

  it('Sign Up / Sign In', (done) => {
    cy.visit('http://localhost:8080/dashboard')
    cy.get('body').then($body => {

      if ($body.find('.welcome-msg').length > 0) {
        cy.wait(12000);
        cy.get('body').trigger('mousemove');
        cy.wait(1000);
        cy.contains('Let\'s Begin').click();
        cy.wait(1000);
        cy.get('input[type="text"]').type('pranavc@gmail.com');
        cy.get('input[type="password"]').type('Password123.');
        cy.contains('Sign Up').click()
      } else {
        cy.get('input[type="text"]').type('pranavc@gmail.com');
        cy.get('input[type="password"]').type('Password123.');
        cy.contains('Sign In').click()
      }
      done()
    });

  });

  it('Create Project', async () => {
    cy.wait(1000)
    cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
    cy.wait(1500)
    cy.get('.create-external-db-project').click()
    cy.wait(5500)
    cy.get('.database-field input').click().clear().type('sakila')
    cy.contains('Test Database Connection').click()

    cy.wait(1500);
    cy.contains('Ok & Save Project').click()
  });
})
