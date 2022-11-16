import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - RollUp column`, () => {
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
    //     cy.closeTableTab("Country");
    // });

    // Routine to create a new look up column
    //
    const addRollUpColumn = (
      columnName,
      childTable,
      childCol,
      aggregateFunc
    ) => {
      cy.get(".nc-grid  tr > th:last .nc-icon").click({
        force: true,
      });

      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find("input.nc-column-name-input")
        .should("exist")
        .clear()
        .type(columnName);
      // cy.get(".nc-column-type-input").last().click().type("RollUp");
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".nc-column-type-input")
        .last()
        .click()
        .type("RollUp");
      cy.getActiveSelection(".nc-dropdown-column-type")
        .find(".ant-select-item-option")
        .contains("Rollup")
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

      fetchParentFromLabel("Aggregate function");
      cy.getActiveSelection(".nc-dropdown-rollup-function")
        .find(".ant-select-item-option")
        .contains(aggregateFunc)
        .click();

      // cy.get(".ant-btn-primary").contains("Save").should('exist').click();
      cy.getActiveMenu(".nc-dropdown-grid-add-column")
        .find(".ant-btn-primary:visible")
        .contains("Save")
        .click();
      cy.toastWait(`Column created`);

      cy.get(`th[data-title="${columnName}"]`).should("exist");
    };

    // routine to delete column
    //
    const deleteColumnByName = (columnName) => {
      mainPage.deleteColumn(columnName);
    };

    // routine to edit column
    //
    // const editColumnByName = (oldName, newName) => {
    //     // verify if column exists before delete
    //     cy.get(`th:contains(${oldName})`).should("exist");
    //
    //     // delete opiton visible on mouse-over
    //     cy.get(`th:contains(${oldName}) .mdi-menu-down`)
    //         .trigger("mouseover")
    //         .click();
    //
    //     // edit/ save on pop-up
    //     cy.get(".nc-column-edit").click();
    //     cy.get(".nc-column-name-input input").clear().type(newName);
    //     cy.get(".nc-col-create-or-edit-card").contains("Save").click();
    //
    //     cy.toastWait("Successfully updated alias");
    //
    //     // validate if deleted (column shouldnt exist)
    //     cy.get(`th:contains(${oldName})`).should("not.exist");
    //     cy.get(`th:contains(${newName})`).should("exist");
    // };

    ///////////////////////////////////////////////////
    // Test case

    it("Add Rollup column (City, City, count) & Delete", () => {
      cy.openTableTab("Country", 25);

      addRollUpColumn("RollUpCol", "City", "City", "count");

      // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
      // intentionally verifying 4th item, as initial items are being masked out by list scroll down
      mainPage.getCell("RollUpCol", 4).contains("2").should("exist");

      // editColumnByName("RollUpCol_2", "RollUpCol_New");
      deleteColumnByName("RollUpCol");

      cy.closeTableTab("Country");
    });

    it.skip("Add Rollup column (City, CountryId, count) & Delete", () => {
      addRollUpColumn("RollUpCol_1", "City", "CountryId", "count");

      // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
      cy.get(`tbody > :nth-child(4) > [data-col="RollUpCol_1"]`)
        .contains("2")
        .should("exist");

      // editColumnByName("RollUpCol_1", "RollUpCol_New");
      deleteColumnByName("RollUpCol_New");
    });
  });
};
