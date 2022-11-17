export const genTest = (apiType, dbType) => {
  describe(`${apiType.toUpperCase()} api - Super user test`, () => {
    before(() => {
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
    });

    it(`Open App store page and check slack app`, () => {
      cy.visit('/#/apps').then((win) => {
        cy.get('.nc-app-store-title').should('exist');
        cy.get('.nc-app-store-card-Slack').should('exist');

        // install slack app
        cy.get('.nc-app-store-card-Slack .install-btn').invoke(
          'attr',
          'style',
          'right: 10px'
        );

        cy.get(
          '.nc-app-store-card-Slack .install-btn .nc-app-store-card-install'
        ).click();

        cy.getActiveModal('.nc-modal-plugin-install')
          .find('[placeholder="Channel Name"]')
          .type('Test channel');

        cy.getActiveModal('.nc-modal-plugin-install')
          .find('[placeholder="Webhook URL"]')
          .type('http://test.com');

        cy.getActiveModal('.nc-modal-plugin-install')
          .find('button:contains("Save")')
          .click();

        cy.toastWait('Successfully installed');

        cy.get(
          '.nc-app-store-card-Slack .install-btn .nc-app-store-card-install'
        ).should('not.exist');

        // update slack app config
        cy.get('.nc-app-store-card-Slack .install-btn .nc-app-store-card-edit')
          .should('exist')
          .click();
        cy.getActiveModal('.nc-modal-plugin-install')
          .should('exist')
          .find('[placeholder="Channel Name"]')
          .should('have.value', 'Test channel')
          .clear()
          .type('Test channel 2');

        cy.getActiveModal('.nc-modal-plugin-install')
          .get('button:contains("Save")')
          .click();

        cy.toastWait('Successfully installed');

        // reset slack app
        cy.get('.nc-app-store-card-Slack .install-btn .nc-app-store-card-reset')
          .should('exist')
          .click();

        cy.getActiveModal('.nc-modal-plugin-uninstall')
          .should('exist')
          .find('button:contains("Confirm")')
          .click();

        cy.toastWait('Plugin uninstalled successfully');
      });
    });

    it(`Open super user management page and add/delete user`, () => {
      // delay for avoiding error related to vue router change
      cy.wait(500);

      cy.visit('/#/account/users').then((win) => {
        cy.get('[data-cy="nc-super-user-list"]').should('exist')
          .find('tbody tr').then((rows) => {
          const initialUserCount = rows.length;

          cy.get('[data-cy=\'nc-super-user-invite\'')
            .click();

          // additional wait to ensure the modal is fully loaded
          cy.getActiveModal('.nc-modal-invite-user').should('exist');
          cy.getActiveModal('.nc-modal-invite-user')
            .find('input[placeholder="E-mail"]')
            .should('exist');

          cy.getActiveModal('.nc-modal-invite-user')
            .find('input[placeholder="E-mail"]')
            .type('test@nocodb.com');
          cy.getActiveModal('.nc-modal-invite-user')
            .find('.ant-select.nc-user-roles')
            .click();

          cy.getActiveModal('.nc-modal-invite-user')
            .find('button.ant-btn-primary')
            .click();

          cy.toastWait('Successfully added user');


          cy.getActiveModal().find('[data-cy="nc-root-user-invite-modal-close"]').click();


          cy.get('[data-cy="nc-super-user-list"]').should('exist')
            .find('tbody tr').should('have.length', initialUserCount +1)
            .last().find('[data-cy="nc-super-user-delete"]').click();

          cy.getActiveModal().find('.ant-modal-confirm-btns .ant-btn-primary').click();

          cy.toastWait('User deleted successfully');


          cy.get('[data-cy="nc-super-user-list"]').should('exist')
            .find('tbody tr').should('have.length', initialUserCount);
        });
      });
    });

    it('User management settings', () => {

    });

    it(`Token management`, () => {
      // delay for avoiding error related to vue router change
      cy.wait(500);
      cy.visit('/#/account/tokens').then((win) => {

        cy.get('[data-cy="nc-token-list"]').should('exist').find(':contains("No Data")').should('exist');
        cy.get('[data-cy="nc-token-create"]').click();
        cy.get('[data-cy="nc-token-modal-description"]').type('Descriptqion');
        cy.get('[data-cy="nc-token-modal-save"]').click();
        cy.toastWait('Token generated successfully');

        cy.get('[data-cy="nc-token-list"]').should('exist')
          .find('tbody tr').should('have.length', 1);

        cy.get('.nc-token-menu').click();

        cy.getActiveMenu('.nc-dropdown-api-token-mgmt').find('.ant-dropdown-menu-item:contains("Remove")').click();


        cy.getActiveModal().find('.ant-modal-confirm-btns .ant-btn-primary').click();

        cy.toastWait('Token deleted successfully');

      });
    });


  });

};
