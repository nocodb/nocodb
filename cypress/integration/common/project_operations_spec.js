const genTest = (type) => {

  describe(`${type.toUpperCase()} Project operations`, () => {

    before(() => {
      cy.waitForSpinners();
      cy.signinOrSignup();
    })
    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });


    it('Create Project', () => {
      cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
      cy.get('.create-external-db-project').click()
      cy.url({timeout: 6000}).should('contain', '#/project/')
      if (type === 'graphql') {
        cy.contains('GRAPHQL APIs').closest('label').click()
      }
      cy.get('.database-field input').click().clear().type('dummy_db')
      cy.contains('Test Database Connection').click()
      cy.contains('Ok & Save Project', {timeout: 3000}).click()
      cy.url({timeout: 12000}).should('contain', '#/nc/')
    });

    it('Stop Project', () => {
      cy.visit('./#/projects')
      // cy.get('.nc-rest-project-row .mdi-stop-circle-outline', {timeout: 10000}).last().trigger('onmouseover').trigger('mouseenter')
      cy.get(`.nc-${type}-project-row .mdi-stop-circle-outline`, {timeout: 10000}).last().invoke('show').click();
      cy.contains('Submit').closest('button').click();
    });

    it('Start Project', () => {
      cy.visit('./#/projects')
      cy.get(`.nc-${type}-project-row .mdi-play-circle-outline`, {timeout: 10000}).last().invoke('show').click();
      cy.contains('Submit').closest('button').click();
    });
    it('Restart Project', () => {
      cy.visit('./#/projects')
      cy.get(`.nc-${type}-project-row .mdi-restart`, {timeout: 10000}).last().invoke('show').click();
      cy.contains('Submit').closest('button').click();
    });
    it('Delete Project', () => {
      cy.visit('./#/projects')
      cy.get(`.nc-${type}-project-row .mdi-delete-circle-outline`, {timeout: 10000}).last().invoke('show').click();
      cy.contains('Submit').closest('button').click();
    });


  })
}


genTest('rest')
genTest('graphql')
