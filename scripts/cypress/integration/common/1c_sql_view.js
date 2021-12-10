import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

export const genTest = (type, xcdb) => {
  if (!isTestSuiteActive(type, xcdb)) return;

  describe(`${type.toUpperCase()} SQL Views`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      // void
    });

    it(`SQL View Column operations`, () => {
      // Open one of the views & verify validity of first two entries

      cy.openViewsTab("ActorInfo", 25);

      // Record-1 validation
      mainPage.getCell(`ActorId`, 1).contains("1").should("exist");
      mainPage.getCell(`FirstName`, 1).contains("PENELOPE").should("exist");
      mainPage.getCell(`LastName`, 1).contains("GUINESS").should("exist");
      mainPage
        .getCell(`FilmInfo`, 1)
        .contains("Animation: ANACONDA CONFESSIONS;")
        .should("exist");

      // Record-2 validation
      mainPage.getCell(`ActorId`, 2).contains("2").should("exist");
      mainPage.getCell(`FirstName`, 2).contains("NICK").should("exist");
      mainPage.getCell(`LastName`, 2).contains("WAHLBERG").should("exist");
      mainPage
        .getCell(`FilmInfo`, 2)
        .contains("Action: BULL SHAWSHANK; Animation: FIGHT JAWBREAKER;")
        .should("exist");

      // Column operations: Hide
      mainPage.hideField("FilmInfo");
      mainPage.unhideField("FilmInfo");

      // Column operations: Sort
      mainPage.sortField("FirstName", "Z -> A");
      mainPage.getCell(`FirstName`, 1).contains("ZERO").should("exist");
      mainPage.clearSort();

      // Column operations: Filter
      mainPage.filterField("FirstName", "is like", "PENELOPE");
      mainPage.getCell(`FirstName`, 1).contains("PENELOPE").should("exist");
      mainPage.filterReset();

      cy.closeViewsTab("ActorInfo");
    });

    it(`SQL View List`, () => {
      // confirm if other views exist
      //
      cy.openViewsTab("CustomerList", 25);
      cy.closeViewsTab("CustomerList");

      cy.openViewsTab("FilmList", 25);
      cy.closeViewsTab("FilmList");

      cy.openViewsTab("NicerButSlowerFilmList", 25);
      cy.closeViewsTab("NicerButSlowerFilmList");

      cy.openViewsTab("SalesByFilmCategory", 16);
      cy.closeViewsTab("SalesByFilmCategory");

      // SalesByStore && StaffList contain no entries. Hence marking row count to 0
      cy.openViewsTab("SalesByStore", 0);
      cy.closeViewsTab("SalesByStore");

      cy.openViewsTab("StaffList", 0);
      cy.closeViewsTab("StaffList");
    });

    after(() => {
      // void
    });
  });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
