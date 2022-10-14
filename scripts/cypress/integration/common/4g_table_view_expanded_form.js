import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { loginPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// function verifyExpandFormHeader(title) {
//   cy.getActiveDrawer(".nc-drawer-expanded-form")
//     .should("exist")
//     .find(".nc-expanded-form-header")
//     .contains(title)
//     .should("exist");
// }

function verifyExpandFormHeader(title) {
  cy.get(
    `.nc-drawer-expanded-form .nc-expanded-form-header :contains("${title}")`
  ).should("exist");
}

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  let clear;

  describe(`${apiType.toUpperCase()} api - Table views: Expanded form`, () => {
    before(() => {
      cy.restoreLocalStorage();

      // open a table to work on views
      //
      cy.openTableTab("Country", 25);

      clear = Cypress.LocalStorage.clear;
      Cypress.LocalStorage.clear = () => {};
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
      Cypress.LocalStorage.clear = clear;
    });

    // Common routine to create/edit/delete GRID & GALLERY view
    // Input: viewType - 'grid'/'gallery'
    //
    const viewTest = (viewType) => {
      it(`Create ${viewType} view`, () => {
        // click on 'Grid/Gallery' button on Views bar
        cy.get(`.nc-create-${viewType}-view`).click();

        // Pop up window, click Submit (accepting default name for view)
        cy.getActiveModal(".nc-modal-view-create")
          .find(".ant-btn-primary")
          .click();
        cy.toastWait("View created successfully");

        // validate if view was created && contains default name 'Country1'
        cy.get(`.nc-${viewType}-view-item`)
          .contains(`${capitalizeFirstLetter(viewType)}-1`)
          .should("exist");

        if (viewType === "gallery") {
          // http://localhost:8080/api/v1/db/data/noco/p_4ufoizgrorwyey/md_g0zc9d40w8zpmy/views/vw_xauikhkm8r49fy?offset=0&limit=25
          cy.intercept("/api/v1/db/data/noco/**").as("getGalleryViewData");

          // mainPage.unhideField("City List");
          cy.get(".nc-fields-menu-btn").click();
          cy.getActiveMenu(".nc-dropdown-fields-menu")
            .find(`.nc-fields-list label:contains("City List"):visible`)
            .click();
          cy.get(".nc-fields-menu-btn").click();

          cy.wait(["@getGalleryViewData"]);
          cy.get('.ant-card-body [title="City List"]').should("exist");
        }
      });

      it(`Expand a row in ${viewType} and verify url`, () => {
        // click on first row-expand if grid & first card if its gallery
        if (viewType === "grid") {
          cy.get(".nc-row-expand").first().click({ force: true });

          // wait for page render to complete
          cy.get('button:contains("Save row"):visible').should("exist");
        } else if (viewType === "gallery") {
          cy.get(".nc-gallery-container .ant-card").first().click();
        }

        // ensure expand draw is open
        verifyExpandFormHeader("Afghanistan");
        cy.url().should("include", "rowId=1");

        // spy on clipboard to verify copied text
        // creating alias for clipboard
        cy.window().then((win) => {
          cy.spy(win.navigator.clipboard, "writeText").as("copy");
        });

        // copy url
        cy.getActiveDrawer(".nc-drawer-expanded-form")
          .should("exist")
          .find(".nc-copy-row-url")
          .click();

        // use alias; verify if clipboard was called with correct text
        cy.get("@copy").should("be.calledWithMatch", `?rowId=1`);

        // close expanded form
        cy.getActiveDrawer(".nc-drawer-expanded-form")
          .find(".nc-expand-form-close-btn")
          .click();
      });

      it(`Visit a ${viewType} row url and verify expanded form`, () => {
        cy.url().then((url) => {
          cy.visit(
            "/" + url.split("/").slice(3).join("/").split("?")[0] + "?rowId=2"
          );

          verifyExpandFormHeader("Algeria");
        });
      });

      it(`Visit an invalid ${viewType} row url and verify expanded form`, () => {
        cy.url().then((url) => {
          cy.visit(
            "/" +
              url.split("/").slice(3).join("/").split("?")[0] +
              "?rowId=99999999"
          );

          cy.toastWait("Record not found");

          cy.get(`.nc-drawer-expanded-form .ant-drawer-content:visible`).should(
            "not.exist"
          );

          // defaults to corresponding grid / gallery view
          cy.get(viewType === "grid" ? ".nc-grid" : ".nc-gallery").should(
            "exist"
          );
        });
      });

      it(`Visit a ${viewType} row url and verify nested expanded form`, () => {
        cy.url().then((url) => {
          cy.visit(
            "/" + url.split("/").slice(3).join("/").split("?")[0] + "?rowId=1"
          );

          verifyExpandFormHeader("Afghanistan");

          cy.get(".nc-drawer-expanded-form .ant-drawer-content").should(
            "exist"
          );

          cy.getActiveDrawer(".nc-drawer-expanded-form")
            .find(".ant-card-body")
            .first()
            .click();

          cy.get(".nc-drawer-expanded-form .ant-drawer-content").should(
            "have.length",
            2
          );

          cy.wait(1000);

          verifyExpandFormHeader("Kabul");

          // close expanded forms
          cy.getActiveDrawer(".nc-drawer-expanded-form")
            .find(".ant-btn")
            .contains("Cancel")
            .click();

          verifyExpandFormHeader("Afghanistan");

          cy.getActiveDrawer(".nc-drawer-expanded-form")
            .find(".ant-btn")
            .contains("Cancel")
            .click();
        });
      });

      it("Delete view", () => {
        cy.get(".nc-view-delete-icon").click({ force: true });
        cy.getActiveModal(".nc-modal-view-delete")
          .find(".ant-btn-dangerous")
          .click();
        cy.toastWait("View deleted successfully");
      });
    };

    // viewTest("grid"); // grid view
    viewTest("gallery"); // gallery view
  });
};
