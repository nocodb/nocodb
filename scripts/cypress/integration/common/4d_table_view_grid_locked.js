import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Lock view`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      cy.restoreLocalStorage();
      cy.openTableTab("Country", 25);
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      cy.restoreLocalStorage();
      cy.closeTableTab("Country");
      cy.saveLocalStorage();
    });

    const lockViewTest = (enabled) => {
      it(`Grid: lock view set to ${enabled}: validation`, () => {
        let vString = enabled ? "not." : "";
        let menuOption = enabled ? "Locked View" : "Collaborative View";

        // on menu, collaboration view appears first (at index 0)
        // followed by Locked view (at index 1)
        cy.get(".nc-actions-menu-btn").click();
        cy.getActiveMenu(".nc-dropdown-actions-menu")
          .find(".ant-dropdown-menu-submenu")
          .eq(0)
          .click();
        cy.wait(1000);
        cy.get(".nc-locked-menu-item")
          .contains(menuOption)
          .should("exist")
          .click();

        // cy.get(".nc-sidebar-lock-menu")
        //     .click();
        // cy.getActiveMenu()
        //     .find('.nc-menu-item:visible')
        //     .eq(menuOption)
        //     .click();

        if (enabled) {
          cy.toastWait("Successfully Switched to locked view");
          cy.get(".nc-icon-locked").should("exist");
        } else {
          cy.toastWait("Successfully Switched to collaborative view");
          cy.get(".nc-icon-collaborative").should("exist");
        }

        // expected toolbar for Lock view: Only lock-view menu, reload, toggle-nav-drawer to be enabled
        //
        // cy.get(".nc-sidebar-lock-menu:enabled")
        //     .should("exist");

        cy.get(".nc-toolbar-reload-btn").should("exist");
        cy.get(".nc-add-new-row-btn > .cursor-pointer").should(
          `${vString}exist`
        );
        cy.get(".nc-fields-menu-btn:enabled").should(`${vString}exist`);
        cy.get(".nc-sort-menu-btn:enabled").should(`${vString}exist`);
        cy.get(".nc-filter-menu-btn:enabled").should(`${vString}exist`);

        // dblClick on a cell & see if we can edit
        mainPage.getCell("Country", 1).dblclick();
        mainPage.getCell("Country", 1).find("input").should(`${vString}exist`);

        // the expand button should be always enabled
        cy.get(".nc-row-expand").should("exist");

        // check if add/ expand options available for 'has many' column type
        // GUI-v2: TBD
        mainPage
          .getCell("City List", 1)
          .click()
          .find(".nc-action-icon.nc-plus")
          .should(`${vString}exist`);
        mainPage
          .getCell("City List", 1)
          .click()
          .find(".nc-action-icon.nc-arrow-expand")
          .should(`${vString}exist`);

        // update row option (right click) - should not be available for Lock view
        mainPage.getCell("City List", 1).rightclick();
        cy.get(".ant-dropdown-content").should(`${vString}be.visible`);
      });
    };

    // Locked view
    lockViewTest(true);

    // collaboration view
    lockViewTest(false);
  });
};
