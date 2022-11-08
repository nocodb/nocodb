import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - LookUp column`, () => {
    // to retrieve few v-input nodes from their label
    //
    const fetchParentFromLabel = (label) => {
      cy.get("label").contains(label).parents(".ant-row").click();
    };

    // before(() => {
    // });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    // after(() => {
    //     cy.closeTableTab("City");
    // });

    // Routine to create a new look up column
    //
    const addLookUpColumn = (childTable, childCol) => {
      cy.get(".nc-grid  tr > th:last .nc-icon").click({
        force: true,
      });

      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find("input.nc-column-name-input")
        .should("exist")
        .clear()
        .type(childCol);
      // cy.get(".nc-column-type-input").last().click().type("Lookup");
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".nc-column-type-input")
        .last()
        .click()
        .type("Lookup");
      cy.getActiveSelection(".nc-dropdown-column-type")
        .find(".ant-select-item-option")
        .contains("Lookup")
        .click();

      cy.inputHighlightRenderWait();

      // Configure Child table & column names
      fetchParentFromLabel("Child table");
      cy.getActiveSelection(".nc-dropdown-relation-table")
        .find(".ant-select-item-option")
        .contains(childTable)
        .click();

      fetchParentFromLabel("Child column");
      cy.getActiveSelection(".nc-dropdown-relation-column")
        .find(".ant-select-item-option")
        .contains(childCol)
        .click();

      // cy.get(".ant-btn-primary").contains("Save").should('exist').click();
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".ant-btn-primary:visible")
        .contains("Save")
        .click();
      cy.toastWait(`Column created`);

      cy.get(`th[data-title="${childCol}"]`).should("exist");
    };

    // routine to delete column
    //
    const deleteColumnByName = (childCol) => {
      mainPage.deleteColumn(childCol);
    };

    ///////////////////////////////////////////////////
    // Test case

    it("Add Lookup column (Address, PostalCode) & Delete", () => {
      cy.openTableTab("City", 25);

      addLookUpColumn("Address", "PostalCode");

      // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
      mainPage.getCell("PostalCode", 1).contains("4166").should("exist");

      deleteColumnByName("PostalCode");

      cy.closeTableTab("City");
    });

    it.skip("Add Lookup column (Country, CountryId) & Delete", () => {
      addLookUpColumn("Country", "CountryId");

      // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
      cy.get(`tbody > :nth-child(1) > [data-col="CountryId"]`)
        .contains("87")
        .should("exist");

      deleteColumnByName("CountryId");
    });
  });
};
