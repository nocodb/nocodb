import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Single select`, () => {
    before(() => {
      Cypress.LocalStorage.clear = () => {};
      cy.restoreLocalStorage();

      // cy
      //   .setup({ dbType })
      //   .then(() => {
      //     cy.createTable("sheet1").openTableTab("sheet1", 0).then(() => {
      //       mainPage.createSelectColumn({type: "SingleSelect", title: "Single"})
      //     });
      //   });
    });

    beforeEach(() => {
      mainPage.addRow(1, "Row 1");
    })

    afterEach(() => {
      mainPage.deleteRow(1);
    })
    
    // after(() => {
    //   cy.deleteTable(sheet1)
    // })

    it("Add single select record", () => {
      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Single"});
      mainPage.verifyCell({
        columnName :"Single",
        index: 1,
        cellValue:"Option 1"
      });
    })

    it("Select option 2 to Multi select record", () => {
      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Single"});
      mainPage.verifyCell({
        columnName :"Single",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Delete single select record", () => {
      mainPage.deleteRow(1);
      mainPage.verifyCellDoesNotExist({columnName: "Single", index: 1})
      mainPage.addRow(1, "Row 1");
    })

    it("Add new options", () => {
      cy.get('[data-cy="column-Single"]').should("be.visible")
        .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-add-select-option"]').should("be.visible").click()
        .get('[data-cy="select-column-option-input-2"]').should("be.visible").click().type("Option 3")
        .get('[data-cy="column-save-button"]').should("be.visible").click();

        mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 3", columnName: "Single"});

      mainPage.verifyCell({
        columnName :"Single",
        index: 1,
        cellValue:"Option 3"
      });

      cy
        .get('[data-cy="column-Single"]').should("be.visible")
        .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-option-remove-2"]').should("be.visible").click()
        .get('[data-cy="column-save-button"]').should("be.visible").click()
    })

    it("Edit option-1", () => {
      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Single"});

      cy.get('[data-cy="column-Single"]').should("be.visible")
        .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .getSettled('[data-cy="select-column-option-input-0"]').should("be.visible").click().clear().type("New Option 1")
        .get('[data-cy="select-column-option-input-1"]').should("be.visible").click().clear().type("New Option 2")
        .get('[data-cy="column-save-button"]').should("be.visible").click();

      mainPage.verifyCell({
        columnName :"Single",
        index: 1,
        cellValue:"New Option 1"
      });

      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "New Option 2", columnName: "Single"});

      mainPage.verifyCell({
        columnName :"Single",
        index: 1,
        cellValue:"New Option 2"
      });

      cy.get('[data-cy="column-Single"]').should("be.visible")
        .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .getSettled('[data-cy="select-column-option-input-0"]').should("be.visible").click().clear().type("Option 1")
        .get('[data-cy="select-column-option-input-1"]').should("be.visible").click().clear().type("Option 2")
        .get('[data-cy="column-save-button"]').should("be.visible").click();
    })

    it("Remove option-1 from first record", () => {
      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Single"});
      mainPage.verifyCell({
        columnName: "Single",
        index: 1,
        cellValue:"Option 1"
      });

      mainPage
        .clearSelectedSingleOptionOfRow({columnName: "Single", index: 1});

      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Single"});
      mainPage.verifyCell({
        columnName: "Single",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Remove option-1 from edit column", () => {
      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Single"});

      cy.get('[data-cy="column-Single"]').should("be.visible")
        .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-option-remove-0"]').should("be.visible").click()
        .get('[data-cy="column-save-button"]').should("be.visible").click();

        cy.toastWait(`Column updated`);

      mainPage.selectSingleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Single"});
      mainPage.verifyCell({
        columnName: "Single",
        index: 1,
        cellValue:"Option 2"
      });

      cy.get(`[data-cy="column-Single"]`).should("be.visible")
      .get(`[data-cy="column-Single-menu-dropdown-button"]`).should("be.visible").click()
      .get('[data-cy="column-menu-edit"]').should("be.visible").click()

      // todo: Remove this wait. Needed since column name is cleared in edit modal with the command down below.
      cy.wait(1000).get('[data-cy="select-column-option-input-0"]').should("be.visible").click().clear().type("Option 1");
      cy.get('[data-cy="select-column-add-select-option"]').should("be.visible").click();
      cy.get('[data-cy="select-column-option-input-1"]').should("be.visible").click().clear().type("Option 2");
      cy.get('[data-cy="column-save-button"]').should("be.visible").click();
    })

    it("Remove column", () => {
      mainPage.deleteColumn("Single");

      mainPage.verifyColumnDoesNotExist("Single");
    })

    // todo: Fix this test. It is failing because of the drag and drop not working with cypress
    // it.only("Reorder options", () => {
    //   cy.get('[data-cy="column-Single"]').should("be.visible")
    //   .get('[data-cy="column-Single-menu-dropdown-button"]').should("be.visible").click()
    //   .get('[data-cy="column-menu-edit"]').should("be.visible").click()
    //   .get('.select-column-option-drag-handle-0')
    //   .drag('.select-column-option-1', { force: true })
    //   .wait(10000)
    //   .get('[data-cy="column-save-button"]').should("be.visible").click()
    //   .toastWait(`Column updated`)
    //   .then(() => {
    //     mainPage
    //     .getCell("Single", 0)
    //     .dblclick()
    //     .then(($el) => {
    //       cy.wrap($el).click().get('.ant-select-item-option').first().contains("Option 2").click();
    //     });
    //   });
    // })
  });
};