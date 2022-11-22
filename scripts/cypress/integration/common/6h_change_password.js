import { isTestSuiteActive, roles } from "../../support/page_objects/projectConstants";


const newPassword = `${roles.owner.credentials.password}1`;
const currentPasswordIsWrong = "Current password is wrong";
const passwordsNotMatching = "Passwords do not match";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe('User settings', () => {
        it('Visit user settings page', () => {
            cy.get("[data-cy='nc-noco-brand-icon']").click();

            cy.get("[data-cy='nc-menu-accounts']").click();
            cy.get("[data-cy='nc-menu-accounts__user-settings']").click();
            cy.get('.user-management-tab-label:contains("Reset Password")').should('exist').click()
            cy.get("[data-cy='nc-user-settings-form']").should("exist");
        });

        describe('Update password and verify user settings form validation', () => {
            beforeEach(() => {
                cy.get("[data-cy='nc-user-settings-form__current-password']").clear();
                cy.get("[data-cy='nc-user-settings-form__new-password']").clear();
                cy.get("[data-cy='nc-user-settings-form__new-password-repeat']").clear();
            })

            it('Verifies current password', () => {
                cy.get("[data-cy='nc-user-settings-form__current-password']").type('WrongPassword');
                cy.get("[data-cy='nc-user-settings-form__new-password']").type(newPassword);
                cy.get("[data-cy='nc-user-settings-form__new-password-repeat']").type(newPassword);
                cy.get("[data-cy='nc-user-settings-form__submit']").click();
                cy.get("[data-cy='nc-user-settings-form__error']").should("exist").should("contain", currentPasswordIsWrong);
            });

            it('Verifies passwords match', () => {
                cy.get("[data-cy='nc-user-settings-form__current-password']").type(roles.owner.credentials.password);
                cy.get("[data-cy='nc-user-settings-form__new-password']").type(newPassword);
                cy.get("[data-cy='nc-user-settings-form__new-password-repeat']").type(`${newPassword}NotMatching`);
                cy.get("[data-cy='nc-user-settings-form__submit']").click();
                cy.get(".ant-form-item-explain-error").should("exist").should("contain", passwordsNotMatching);
            });

            it('Changes user password & signs out', () => {
                cy.get("[data-cy='nc-user-settings-form__current-password']").type(roles.owner.credentials.password);
                cy.get("[data-cy='nc-user-settings-form__new-password']").type(newPassword);
                cy.get("[data-cy='nc-user-settings-form__new-password-repeat']").type(newPassword);
                cy.get("[data-cy='nc-user-settings-form__submit']").click();
                cy.get("[data-cy='nc-user-settings-form__submit']").should("not.exist");
            });
        })

        describe('Sign in with new password', () => {
            it('Verifies new password works', () => {
                cy.get("[data-cy='nc-form-signin']").should("exist");
                cy.get("[data-cy='nc-form-signin__email']").type(roles.owner.credentials.username);
                cy.get("[data-cy='nc-form-signin__password']").type(newPassword);
                cy.get("[data-cy='nc-form-signin__submit']").click();
                cy.get("[data-cy='nc-menu-accounts']").should("exist");
            })
        })
    });
};
