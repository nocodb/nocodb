import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Multi select`, () => {
    before(() => {
      Cypress.LocalStorage.clear = () => {};
      cy.restoreLocalStorage();

      // cy
      //   .setup({ dbType })
      //   .then(() => {
      //     cy.createTable("sheet1").openTableTab("sheet1", 0).then(() => {
      //       mainPage.createSelectColumn({type: "MultiSelect", title: "Multi"})
      //     });
      //   });
    });

    beforeEach(() => {
      mainPage.addRow(1, "Row 1");
    })

    afterEach(() => {
      if (cy.state('test').state === 'failed') {
        Cypress.runner.stop()
      }
      mainPage.deleteRow(1);
    })
    
    // after(() => {
    //   cy.deleteTable(sheet1)
    // })

    it("Add Multi select record", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName :"Multi",
        index: 1,
        cellValue:"Option 1"
      });
    })

    it("Select option 2 to Multi select record", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName :"Multi",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Delete Multi select record", () => {
      mainPage.deleteRow(1);
      mainPage.verifyCellDoesNotExist({columnName: "Multi", index: 1})
      mainPage.addRow(1, "Row 1");
    })

    it("Add new options", () => {
      cy.get('[data-cy="column-Multi"]').should("be.visible")
        .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-add-select-option"]').should("be.visible").click()
        .get('[data-cy="select-column-option-input-2"]').should("be.visible").click().type("Option 3")
        .get('[data-cy="column-save-button"]').should("be.visible").click();

        mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 3", columnName: "Multi", clearAlreadySelected: true});

      mainPage.verifyCell({
        columnName :"Multi",
        index: 1,
        cellValue:"Option 3"
      });

      cy
      .get('[data-cy="column-Multi"]').should("be.visible")
      .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
      .get('[data-cy="column-menu-edit"]').should("be.visible").click()
      .get('[data-cy="select-column-option-remove-2"]').should("be.visible").click()
      .get('[data-cy="column-save-button"]').should("be.visible").click()
    })

    it("Edit option-1", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Multi", clearAlreadySelected: true});

      cy.get('[data-cy="column-Multi"]').should("be.visible")
        .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .getSettled('[data-cy="select-column-option-input-0"]').should("be.visible").click().clear().type("New Option 1")
        .get('[data-cy="select-column-option-input-1"]').should("be.visible").click().clear().type("New Option 2")
        .get('[data-cy="column-save-button"]').should("be.visible").click();

      mainPage.verifyCell({
        columnName :"Multi",
        index: 1,
        cellValue:"New Option 1"
      });

      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "New Option 2", columnName: "Multi", clearAlreadySelected: true});

      mainPage.verifyCell({
        columnName :"Multi",
        index: 1,
        cellValue:"New Option 2"
      });

      cy.get('[data-cy="column-Multi"]').should("be.visible")
        .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .getSettled('[data-cy="select-column-option-input-0"]').should("be.visible").click().clear().type("Option 1")
        .get('[data-cy="select-column-option-input-1"]').should("be.visible").click().clear().type("Option 2")
        .get('[data-cy="column-save-button"]').should("be.visible").click();
    })

    it("Remove option-1 and replace it with option-2 from first record", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 1"
      });

      mainPage
        .getCell("Multi", 1)
        .get('.ant-tag-close-icon').should('exist').click();

      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Remove option-2 from edit column", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Multi", clearAlreadySelected: true});

      cy.get('[data-cy="column-Multi"]').should("be.visible")
        .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-option-remove-1"]').should("be.visible").click()
        .get('[data-cy="column-save-button"]').should("be.visible").click();

      cy.toastWait(`Column updated`);

      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 1"
      });

      cy.get('[data-cy="column-Multi"]').should("be.visible")
        .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
        .get('[data-cy="column-menu-edit"]').should("be.visible").click()
        .get('[data-cy="select-column-add-select-option"]').should("be.visible").click()
        .get('[data-cy="select-column-option-input-1"]').should("be.visible").click().type("Option 2")
        .get('[data-cy="column-save-button"]').should("be.visible").click();

      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Multi", clearAlreadySelected: true});
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Select option 1 and option 2", () => {
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 1", columnName: "Multi", clearAlreadySelected: false});
      mainPage.selectMultipleOptionOfRow({index: 1, cellValue: "Option 2", columnName: "Multi", clearAlreadySelected: false});
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 1"
      });
      mainPage.verifyCell({
        columnName: "Multi",
        index: 1,
        cellValue:"Option 2"
      });
    })

    it("Remove column", () => {
      mainPage.deleteColumn("Multi");

      mainPage.verifyColumnDoesNotExist("Multi");
    })

    // todo: Fix this test. It is failing because of the drag and drop not working with cypress
    // it.only("Reorder options", () => {
    //   cy.get('[data-cy="column-Multi"]').should("be.visible")
    //   .get('[data-cy="column-Multi-menu-dropdown-button"]').should("be.visible").click()
    //   .get('[data-cy="column-menu-edit"]').should("be.visible").click()
    //   .get('.select-column-option-drag-handle-0')
    //   .drag('.select-column-option-1', { force: true })
    //   .wait(10000)
    //   .get('[data-cy="column-save-button"]').should("be.visible").click()
    //   .toastWait(`Column updated`)
    //   .then(() => {
    //     mainPage
    //     .getCell("Multi", 0)
    //     .dblclick()
    //     .then(($el) => {
    //       cy.wrap($el).click().get('.ant-select-item-option').first().contains("Option 2").click();
    //     });
    //   });
    // })
  });
};