describe('Rest Project operations', () => {

  beforeEach(() => {
    cy.waitForSpinners();
    cy.signinOrSignup();
  })

  it('Create Project', () => {
    // cy.visit('')
    cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
    cy.get('.create-external-db-project').click()
    cy.url({timeout: 6000}).should('contain', '#/project')
    cy.get('.database-field input').click().clear().type('dummy_db')
    cy.contains('Test Database Connection').click()
    cy.contains('Ok & Save Project', {timeout: 3000}).click()
    cy.url({timeout: 12000}).should('contain', '#/nc/')
  });
  it('Stop Project', () => {
    // cy.get('.nc-rest-project-row .mdi-stop-circle-outline', {timeout: 10000}).last().trigger('onmouseover').trigger('mouseenter')
    cy.get('.nc-rest-project-row .mdi-stop-circle-outline', {timeout: 10000}).last().invoke('show').click();
    cy.contains('Submit').closest('button').click();
  });
  it('Start Project', () => {
    cy.get('.nc-rest-project-row .mdi-play-circle-outline', {timeout: 10000}).last().invoke('show').click();
    cy.contains('Submit').closest('button').click();
  });
  it('Restart Project', () => {
    cy.get('.nc-rest-project-row .mdi-restart', {timeout: 10000}).last().invoke('show').click();
    cy.contains('Submit').closest('button').click();
  });
  it('Delete Project', () => {
    cy.get('.nc-rest-project-row .mdi-delete-circle-outline', {timeout: 10000}).last().invoke('show').click();
    cy.contains('Submit').closest('button').click();
  });


})
