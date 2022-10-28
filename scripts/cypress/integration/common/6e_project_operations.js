import { loginPage } from "../../support/page_objects/navigation";
import { isXcdb, roles } from "../../support/page_objects/projectConstants";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  describe(`${apiType.toUpperCase()} Project operations`, () => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    before(() => {
      loginPage.signIn(roles.owner.credentials);
      cy.saveLocalStorage();
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it("Delete Project", () => {
      cy.get(`.nc-action-btn`).should("exist").last().click();

      cy.getActiveModal(".nc-modal-project-delete")
        .find(".ant-btn-dangerous")
        .should("exist")
        .click();
    });
  });
};
