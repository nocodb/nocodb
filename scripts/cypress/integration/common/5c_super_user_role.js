import { loginPage } from "../../support/page_objects/navigation";
import { roles } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  describe(`${apiType.toUpperCase()} api - Super user test`, () => {
    before(() => {});

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {});

    it(`Open App store page and check slack app`, () => {
      cy.visit("/#/apps").then((win) => {
        cy.get(".nc-app-store-title").should("exist");
        cy.get(".nc-app-store-card-Slack").should("exist");

        // install slack app
        cy.get(".nc-app-store-card-Slack .install-btn").invoke(
          "attr",
          "style",
          "right: 10px"
        );

        cy.get(
          ".nc-app-store-card-Slack .install-btn .nc-app-store-card-install"
        ).click();

        cy.getActiveModal(".nc-modal-plugin-install")
          .find('[placeholder="Channel Name"]')
          .type("Test channel");

        cy.getActiveModal(".nc-modal-plugin-install")
          .find('[placeholder="Webhook URL"]')
          .type("http://test.com");

        cy.getActiveModal(".nc-modal-plugin-install")
          .find('button:contains("Save")')
          .click();

        cy.toastWait("Successfully installed");

        cy.get(
          ".nc-app-store-card-Slack .install-btn .nc-app-store-card-install"
        ).should("not.exist");

        // update slack app config
        cy.get(".nc-app-store-card-Slack .install-btn .nc-app-store-card-edit")
          .should("exist")
          .click();
        cy.getActiveModal(".nc-modal-plugin-install")
          .should("exist")
          .find('[placeholder="Channel Name"]')
          .should("have.value", "Test channel")
          .clear()
          .type("Test channel 2");

        cy.getActiveModal(".nc-modal-plugin-install")
          .get('button:contains("Save")')
          .click();

        cy.toastWait("Successfully installed");

        // reset slack app
        cy.get(".nc-app-store-card-Slack .install-btn .nc-app-store-card-reset")
          .should("exist")
          .click();

        cy.getActiveModal(".nc-modal-plugin-uninstall")
          .should("exist")
          .find('button:contains("Confirm")')
          .click();

        cy.toastWait("Plugin uninstalled successfully");
      });
    });
  });
};
