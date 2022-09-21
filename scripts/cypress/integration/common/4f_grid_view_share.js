import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";

let storedURL = "";

// 0: all enabled
// 1: field hide
// 2: field sort
// 3: field filter
// 4: default (address table): for view operation validation
// 5: default (country table): for update row/column validation
let viewURL = {};

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  const generateViewLink = (viewName) => {
    mainPage.shareView().click();

    cy.wait(1000);

    // wait, as URL initially will be /undefined
    cy.getActiveModal(".nc-modal-share-view")
      .find(".share-link-box")
      .contains("/nc/view/", { timeout: 10000 })
      .should("exist");

    // copy link text, visit URL
    cy.getActiveModal(".nc-modal-share-view")
      .find(".share-link-box")
      .contains("/nc/view/", { timeout: 10000 })
      .then(($obj) => {
        cy.get("body").type("{esc}");
        // viewURL.push($obj.text())
        viewURL[viewName] = $obj.text().trim();
      });

    cy.getActiveModal(".nc-modal-share-view").should("not.exist");
  };

  describe(`${apiType.toUpperCase()} api - GRID view (Share)`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      cy.restoreLocalStorage();
      cy.openTableTab("Address", 25);
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      // close table
      // mainPage.deleteCreatedViews()
      cy.restoreLocalStorage();
      cy.closeTableTab("Address");
      cy.saveLocalStorage();
    });

    // Common routine to create/edit/delete GRID & GALLERY view
    // Input: viewType - 'grid'/'gallery'
    //
    const viewTest = (viewType) => {
      it(`Create ${viewType.toUpperCase()} view`, () => {
        // create a normal public view
        cy.get(`.nc-create-${viewType}-view`).click();
        cy.getActiveModal(".nc-modal-view-create")
          .find("button:contains(Submit)")
          .click();
        cy.toastWait("View created successfully");

        // store base URL- to re-visit and delete form view later
        cy.url().then((url) => {
          storedURL = url;
        });
      });

      it(`Share ${viewType.toUpperCase()} hide, sort, filter & verify`, () => {
        cy.intercept("/api/v1/db/meta/audits/comments/*").as("waitForPageLoad");

        cy.get(`.nc-view-item.nc-${viewType}-view-item`)
          .contains("Grid-1")
          .click();
        mainPage.hideField("Address2");
        mainPage.sortField("District", "Z → A");
        mainPage.filterField("Address", "is like", "Ab");
        generateViewLink("combined");
        cy.log(viewURL["combined"]);

        cy.wait(["@waitForPageLoad"]);
        // kludge: additional wait to ensure page load is completed
        cy.wait(2000);
      });

      it(`Share GRID view : ensure we have only one link even if shared multiple times`, () => {
        // generate view link multiple times
        generateViewLink("combined");
        generateViewLink("combined");

        // verify if only one link exists in table
        mainPage.shareViewList().click();

        cy.get('th:contains("View Link")').should("exist");

        cy.get('th:contains("View Link")')
          .parent()
          .parent()
          .next()
          .find("tr")
          .its("length")
          .should("eq", 1)
          .then(() => {
            cy.get("button.ant-modal-close:visible").click();
          });

        cy.signOut();
      });

      it(`Share ${viewType.toUpperCase()} view : Visit URL, Verify title`, () => {
        // visit public view
        cy.visit(viewURL["combined"], {
          baseUrl: null,
        });
        cy.wait(5000);

        // wait for page rendering to complete
        cy.get(".nc-grid-row").should("have.length", 18);

        // verify title
        cy.get(".nc-shared-view-title").contains("Grid-1").should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify fields hidden/open`, () => {
        // verify column headers
        cy.get('[data-title="Address"]').should("exist");
        cy.get('[data-title="Address2"]').should("not.exist");
        cy.get('[data-title="District"]').should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify fields sort/ filter`, () => {
        // country column content verification before sort
        mainPage
          .getCell("District", 1)
          .contains("West Bengali")
          .should("exist");
        mainPage.getCell("District", 2).contains("Tutuila").should("exist");
        mainPage.getCell("District", 3).contains("Tamil Nadu").should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify download CSV`, () => {
        mainPage.hideField("LastUpdate");
        const verifyCsv = (retrievedRecords) => {
          // expected output, statically configured
          let storedRecords = [
            `Address,District,PostalCode,Phone,Location,Customer List,Staff List,City,Staff List`,
            `1013 Tabuk Boulevard,West Bengali,96203,158399646978,[object Object],2,,Kanchrapara,`,
            `1892 Nabereznyje Telny Lane,Tutuila,28396,478229987054,[object Object],2,,Tafuna,`,
            `1993 Tabuk Lane,Tamil Nadu,64221,648482415405,[object Object],2,,Tambaram,`,
            `1661 Abha Drive,Tamil Nadu,14400,270456873752,[object Object],1,,Pudukkottai,`,
          ];

          for (let i = 0; i < storedRecords.length; i++) {
            let strCol = storedRecords[i].split(",");
            let retCol = retrievedRecords[i].split(",");
            for (let j = 0; j < 4; j++) {
              expect(strCol[j]).to.be.equal(retCol[j]);
            }
          }
        };

        // download & verify
        mainPage.downloadAndVerifyCsvFromSharedView(
          `Address_exported_1.csv`,
          verifyCsv
        );
        mainPage.unhideField("LastUpdate");
      });

      it(`Share ${viewType.toUpperCase()} view : Disable sort`, () => {
        // remove sort and validate
        mainPage.clearSort();
        mainPage
          .getCell("District", 1)
          .contains("West Bengali")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : Enable sort`, () => {
        // Sort menu operations (Country Column, Z → A)
        mainPage.sortField("District", "Z → A");
        mainPage
          .getCell("District", 1)
          .contains("West Bengali")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : Create Filter`, () => {
        // add filter & validate
        mainPage.filterField("District", "is like", "Tamil");
        // wait for page rendering to complete
        cy.get(".nc-grid-row").should("have.length", 2);
        mainPage.getCell("District", 1).contains("Tamil").should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify download CSV after local filter`, () => {
        mainPage.hideField("LastUpdate");
        const verifyCsv = (retrievedRecords) => {
          // expected output, statically configured
          let storedRecords = [
            `Address,District,PostalCode,Phone,Location,Customer List,Staff List,City,Staff List`,
            `1993 Tabuk Lane,Tamil Nadu,64221,648482415405,[object Object],2,,Tambaram,`,
            `1661 Abha Drive,Tamil Nadu,14400,270456873752,[object Object],1,,Pudukkottai,`,
          ];

          // for (let i = 0; i < storedRecords.length; i++) {
          //     expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
          // }

          // ncv2@fixme
          // for (let i = 0; i < storedRecords.length; i++) {
          //     let strCol = storedRecords[i].split(",");
          //     let retCol = retrievedRecords[i].split(",");
          //     for (let j = 0; j < 4; j++) {
          //         expect(strCol[j]).to.be.equal(retCol[j]);
          //     }
          // }
        };
        mainPage.downloadAndVerifyCsvFromSharedView(
          `Address_exported_1.csv`,
          verifyCsv
        );
        mainPage.unhideField("LastUpdate");
      });

      it(`Share ${viewType.toUpperCase()} view : Delete Filter`, () => {
        // Remove sort and Validate
        mainPage.filterReset();
        mainPage
          .getCell("District", 1)
          .contains("West Bengali")
          .should("exist");
      });

      it(`Share GRID view : Virtual column validation > has many`, () => {
        // verify column headers
        cy.get('[data-title="Customer List"]').should("exist");
        cy.get('[data-title="Staff List"]').should("exist");
        cy.get('[data-title="City"]').should("exist");
        cy.get('[data-title="Staff List"]').should("exist");

        // has many field validation
        mainPage
          .getCell("Customer List", 3)
          .click()
          .find(".nc-icon.nc-unlink-icon")
          .should("not.exist");
        mainPage
          .getCell("Customer List", 3)
          .click()
          .find(".nc-icon.nc-action-icon.nc-plus")
          .should("not.exist");

        // mainPage
        //     .getCell("Customer List", 3)
        //     .click()
        //     .find(".nc-icon.nc-action-icon.nc-arrow-expand")
        //     .click({ force: true });
        //
        // // reload button
        // cy.getActiveModal().find(".nc-icon").should("exist");
        // cy.getActiveModal()
        //     .find("button")
        //     .contains("Link to")
        //     .should("not.exist");
        // cy.getActiveModal()
        //     .find(".ant-card")
        //     .contains("2")
        //     .should("exist");
        // cy.getActiveModal()
        //     .find(".ant-card")
        //     .find("button")
        //     .should("not.exist");
        // cy.get('button.ant-modal-close').click();
      });

      it(`Share GRID view : Virtual column validation > belongs to`, () => {
        // belongs to field validation
        mainPage
          .getCell("City", 1)
          .click()
          .find(".nc-icon.nc-unlink-icon")
          .should("not.exist");

        mainPage
          .getCell("City", 1)
          .click()
          .find(".nc-icon.nc-action-icon.nc-arrow-expand")
          .should("not.exist");
        mainPage
          .getCell("City", 1)
          .find(".chips")
          .contains("Kanchrapara")
          .should("exist");
      });

      it(`Share GRID view : Virtual column validation > many to many`, () => {
        // many-to-many field validation
        mainPage
          .getCell("Staff List", 1)
          .click()
          .find(".nc-icon.nc-unlink-icon")
          .should("not.exist");
        mainPage
          .getCell("Staff List", 1)
          .click()
          .find(".nc-icon.nc-action-icon.nc-plus")
          .should("not.exist");

        mainPage
          .getCell("Staff List", 1)
          .click()
          .find(".nc-icon.nc-action-icon.nc-arrow-expand")
          .click({ force: true });

        // // reload button
        // Fix me : ncv2@fixme
        // cy.getActiveModal().find(".nc-icon").should("exist");
        // cy.getActiveModal()
        //     .find("button")
        //     .contains("Link to")
        //     .should("not.exist");
        // cy.get('button.ant-modal-close:visible').last().click();
      });

      it(`Delete ${viewType.toUpperCase()} view`, () => {
        // go back to base page
        loginPage.loginAndOpenProject(apiType, dbType);
        cy.openTableTab("Address", 25);

        // number of view entries should be 2 before we delete
        cy.get(".nc-view-item").its("length").should("eq", 2);

        cy.get(".nc-view-delete-icon").eq(0).click({ force: true });
        cy.getActiveModal(".nc-modal-view-delete")
          .find(".ant-btn-dangerous")
          .click();
        cy.toastWait("View deleted successfully");

        // confirm if the number of veiw entries is reduced by 1
        cy.get(".nc-view-item").its("length").should("eq", 1);
      });
    };

    // below scenario's will be invoked twice, once for rest & then for graphql
    viewTest("grid");
  });

  describe(`${apiType.toUpperCase()} api - Grid view/ row-column update verification`, () => {
    before(() => {
      cy.restoreLocalStorage();

      // Address table has belongs to, has many & many-to-many
      cy.openTableTab("Country", 25);

      // store base URL- to re-visit and delete form view later
      cy.url().then((url) => {
        storedURL = url;
        generateViewLink("rowColUpdate");
      });
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

    it(`Generate default Shared GRID view URL`, () => {
      // add row
      cy.get(".nc-add-new-row-btn").click();
      cy.get(".nc-expand-col-Country")
        .find(".nc-cell > input")
        .should("exist")
        .first()
        .clear({ force: true })
        .type("a");
      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Save row")
        .should("exist")
        .click();
      cy.toastWait("updated successfully");
      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Cancel")
        .should("exist")
        .click();
      // add column
      mainPage.addColumn("dummy", "Country");

      cy.signOut();

      // visit public view
      cy.log(viewURL["rowColUpdate"]);
      cy.visit(viewURL["rowColUpdate"], {
        baseUrl: null,
      });
      cy.wait(5000);

      // wait for public view page to load!
      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 25);
    });

    it(`Share GRID view : new row visible`, () => {
      // verify row
      // cy.get(`.v-pagination > li:contains('5') button`).click();
      cy.get(
        `.nc-pagination > .ant-pagination-item.ant-pagination-item-5`
      ).click();
      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 10);
      mainPage.getCell("Country", 10).contains("a").should("exist");
    });

    it(`Share GRID view : new column visible`, () => {
      // verify column headers
      cy.get('[data-title="dummy"]').should("exist");
    });

    it(`Clean up`, () => {
      loginPage.loginAndOpenProject(apiType, dbType);
      cy.openTableTab("Country", 25);

      // delete row
      mainPage.getPagination(5).click();
      // kludge: flicker on load
      cy.wait(3000);

      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 10);
      mainPage.getCell("Country", 10).rightclick();
      cy.getActiveMenu(".nc-dropdown-grid-context-menu")
        .find('.ant-dropdown-menu-item:contains("Delete Row")')
        .first()
        .click();

      // delete column
      mainPage.deleteColumn("dummy");
      mainPage.deleteCreatedViews();
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
