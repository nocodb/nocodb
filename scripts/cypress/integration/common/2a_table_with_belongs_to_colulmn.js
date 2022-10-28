import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Table: belongs to, link record`, () => {
    // before(() => {
    //     cy.restoreLocalStorage();
    //     cy.openTableTab("Country", 25);
    // });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    // after(() => {
    //   cy.closeTableTab("City");
    // });

    it("URL validation", () => {
      cy.openTableTab("Country", 25);
      // column name validation
      // cy.get(`.project-tab:contains(Country):visible`).should("exist");
      // URL validation
      cy.url().should("contain", `table/Country`);
    });

    it("Grid cell chip content validation", () => {
      // grid cell content validation
      mainPage
        .getCell("City List", 1)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Kabul")
        .should("exist");
      mainPage
        .getCell("City List", 2)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Batna")
        .should("exist");
      mainPage
        .getCell("City List", 2)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Bchar")
        .should("exist");
      mainPage
        .getCell("City List", 2)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Skikda")
        .should("exist");
    });

    it("Expand has-many column", () => {
      mainPage
        .getCell("City List", 1)
        .should("exist")
        .trigger("mouseover")
        .click();
      cy.get(".nc-action-icon").eq(0).should("exist").click({ force: true });
    });

    it("Expand Link record, validate", () => {
      cy.getActiveModal(".nc-modal-child-list")
        .find("button:contains(Link to 'City')")
        .click()
        .then(() => {
          // Link record form validation
          cy.getActiveModal(".nc-modal-link-record")
            .contains("Link record")
            .should("exist");
          cy.getActiveModal(".nc-modal-link-record")
            .find(".nc-reload")
            .should("exist");
          cy.getActiveModal(".nc-modal-link-record")
            .find('button:contains("Add new record")')
            .should("exist");
          cy.getActiveModal(".nc-modal-link-record")
            .find(".ant-card")
            .eq(0)
            .contains("A Corua (La Corua)")
            .should("exist");

          cy.getActiveModal(".nc-modal-link-record")
            .find("button.ant-modal-close")
            .click();
          // .then(() => {
          //     cy.getActiveModal()
          //         .find("button.ant-modal-close")
          //         .click();
          // });
        });
    });

    it("Belongs to column, validate", () => {
      cy.closeTableTab("Country");
      cy.openTableTab("City", 25);
      cy.url().should("contain", `table/City`);

      // grid cell content validation
      mainPage
        .getCell("Country", 1)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Spain")
        .should("exist");
      mainPage
        .getCell("Country", 2)
        .find(".nc-virtual-cell > .chips-wrapper > .chips > .group > .name")
        .contains("Saudi Arabia")
        .should("exist");

      cy.closeTableTab("City");
    });
  });
};
