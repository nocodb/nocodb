import {
  isTestSuiteActive,
  isXcdb,
} from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} SQL Views`, () => {
    // Run once before test- create project (rest/graphql)
    //
    // before(() => {
    //     cy.fileHook();
    //     mainPage.tabReset();
    // });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it(`XCDB: SQL View Column operations`, () => {
      // Open one of the views & verify validity of first two entries
      if (isXcdb()) {
        cy.openViewsTab("CustomerList", 25);

        // Record-1 validation
        mainPage.getCell(`ID`, 1).contains("1").should("exist");
        mainPage.getCell(`Name`, 1).contains("MARY SMITH").should("exist");
        mainPage
          .getCell(`Address`, 1)
          .contains("1913 Hanoi Way")
          .should("exist");
        mainPage.getCell(`ZipCode`, 1).contains("35200").should("exist");

        // Record-2 validation
        mainPage.getCell(`ID`, 2).contains("2").should("exist");
        mainPage
          .getCell(`Name`, 2)
          .contains("PATRICIA JOHNSON")
          .should("exist");
        mainPage
          .getCell(`Address`, 2)
          .contains("1121 Loja Avenue")
          .should("exist");
        mainPage.getCell(`ZipCode`, 2).contains("17886").should("exist");

        // Column operations: Hide
        mainPage.hideField(`ZipCode`);
        mainPage.unhideField(`ZipCode`);

        // Column operations: Sort
        mainPage.sortField("Name", "Z → A");
        mainPage.getCell(`Name`, 1).contains("ZACHARY HITE").should("exist");
        mainPage.clearSort();

        // Column operations: Filter
        mainPage.filterField("Name", "is like", "MARY");
        mainPage.getCell(`Name`, 1).contains("MARY SMITH").should("exist");
        mainPage.filterReset();

        cy.closeViewsTab("CustomerList");
      }
    });

    it(`SQL View Column operations`, () => {
      if (!isXcdb()) {
        // Open one of the views & verify validity of first two entries

        cy.openViewsTab("ActorInfo", 25);

        // Record-1 validation
        mainPage.getCell(`ActorId`, 1).contains("1").should("exist");
        mainPage.getCell(`FirstName`, 1).contains("PENELOPE").should("exist");
        mainPage.getCell(`LastName`, 1).contains("GUINESS").should("exist");
        mainPage
          .getCell(`FilmInfo`, 1)
          .contains("Animation: ANACONDA CONFESSIONS")
          .should("exist");

        // Record-2 validation
        mainPage.getCell(`ActorId`, 2).contains("2").should("exist");
        mainPage.getCell(`FirstName`, 2).contains("NICK").should("exist");
        mainPage.getCell(`LastName`, 2).contains("WAHLBERG").should("exist");
        mainPage
          .getCell(`FilmInfo`, 2)
          .contains("Action: BULL SHAWSHANK")
          .should("exist");

        // Column operations: Hide
        mainPage.hideField("FilmInfo");
        mainPage.unhideField("FilmInfo");

        // Column operations: Sort
        mainPage.sortField("FirstName", "Z → A");
        mainPage.getCell(`FirstName`, 1).contains("ZERO").should("exist");
        mainPage.clearSort();

        // Column operations: Filter
        mainPage.filterField("FirstName", "is like", "PENELOPE");
        mainPage.getCell(`FirstName`, 1).contains("PENELOPE").should("exist");
        mainPage.filterReset();

        cy.closeViewsTab("ActorInfo");
      }
    });

    it.skip(`SQL View List`, () => {
      // confirm if other views exist
      //
      cy.openViewsTab("CustomerList", 25);
      cy.closeViewsTab("CustomerList");

      cy.openViewsTab("FilmList", 25);
      cy.closeViewsTab("FilmList");

      cy.openViewsTab("SalesByFilmCategory", 16);
      cy.closeViewsTab("SalesByFilmCategory");

      if (!isXcdb()) {
        cy.openViewsTab("NicerButSlowerFilmList", 25);
        cy.closeViewsTab("NicerButSlowerFilmList");

        // SalesByStore && StaffList contain no entries. Hence marking row count to 0
        cy.openViewsTab("SalesByStore", 0);
        cy.closeViewsTab("SalesByStore");

        cy.openViewsTab("StaffList", 0);
        cy.closeViewsTab("StaffList");
      } else {
        cy.openViewsTab("SalesByStore", 2);
        cy.closeViewsTab("SalesByStore");

        cy.openViewsTab("StaffList", 2);
        cy.closeViewsTab("StaffList");
      }
    });
  });
};
