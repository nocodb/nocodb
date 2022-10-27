// test suite
//
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";

let linkText = "";
const generateShareLink_surveyMode = () => {
  mainPage.shareView().click();

  // ensure modal is rendered and visible
  cy.getActiveModal(".nc-modal-share-view")
    .find(".ant-modal-title")
    .contains("This view is shared via a private link")
    .should("be.visible");

  // enable survey mode
  cy.get('[data-cy="nc-modal-share-view__survey-mode"]').click();

  // copy link text, save URL
  cy.get('[data-cy="nc-modal-share-view__link"]').then(($el) => {
    linkText = $el.text();
    cy.log(linkText);
  });
};

// Options:
//  footer
//  btnSubmit
//  fieldLabel
//
function validateFormPage(options) {
  // header & description
  cy.get('[data-cy="nc-survey-form__heading"]')
    .contains("A B C D")
    .should("be.visible");
  cy.get('[data-cy="nc-survey-form__sub-heading"]')
    .contains("Survey form for testing")
    .should("be.visible");

  // footer (page index)
  cy.get('[data-cy="nc-survey-form__footer"]')
    .contains(options.footer)
    .should("be.visible");

  // submit button: will be either OK or Submit
  cy.get(`[data-cy="nc-survey-form__${options.btnSubmit}"]`).should(
    "be.visible"
  );

  // field label
  cy.get(
    `[data-cy="nc-survey-form__input-${options.fieldLabel.replaceAll(
      " ",
      ""
    )}"]`
  ).should("be.visible");
}

// test suite
//
export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  let clear;

  /**
   * class names specific to survey mode
   *    data-cy="nc-survey-form__heading"
   *    data-cy="nc-survey-form__sub-heading"
   *    data-cy="nc-survey-form__input-${fieldTitle}"
   *    data-cy="nc-survey-form__field-description"
   *    data-cy="nc-survey-form__btn-submit"
   *    data-cy="nc-survey-form__btn-next"
   *    data-cy="nc-survey-form__success-msg"
   *    data-cy="nc-survey-form__btn-submit-another-form"
   *    data-cy="nc-survey-form__footer"
   *    data-cy="nc-survey-form__icon-next"
   *    data-cy="nc-survey-form__icon-prev"
   */

  describe(`${apiType.toUpperCase()} api - Kanban`, () => {
    before(() => {
      cy.restoreLocalStorage();

      // disable CY storage handling
      clear = Cypress.LocalStorage.clear;
      Cypress.LocalStorage.clear = () => {};
    });

    after(() => {
      // re-enable CY storage handling
      Cypress.LocalStorage.clear = clear;
      cy.saveLocalStorage();
    });

    it("Create form view", () => {
      cy.openTableTab("Country", 25);
      cy.viewCreate("form");

      // prepare form
      // wait for input fields to be rendered as enabled
      cy.wait(2000);

      // Update header & add some description
      cy.get(".nc-form")
        .find('[placeholder="Form Title"]')
        .clear()
        .type("A B C D");
      cy.get(".nc-form")
        .find('[placeholder="Add form description"]')
        .type("Survey form for testing");
      cy.get(".nc-form").click();

      // add success message
      cy.get("textarea.nc-form-after-submit-msg").type("Congratulations!");

      // enable "Submit another form" check box
      cy.get("button.nc-form-checkbox-submit-another-form").click();

      // show another form after 5 seconds
      cy.get("button.nc-form-checkbox-show-blank-form").click();
    });

    it("Share form, enable survey mode", () => {
      generateShareLink_surveyMode();
      cy.signOut();
    });

    it("Visit link, validate form", () => {
      cy.visit(linkText);

      // validate form
      validateFormPage({
        footer: "1 / 3",
        btnSubmit: "btn-next",
        fieldLabel: "Country",
      });
      cy.get('[data-cy="nc-survey-form__input-Country"]').type("x{enter}");

      validateFormPage({
        footer: "2 / 3",
        btnSubmit: "btn-next",
        fieldLabel: "LastUpdate",
      });
      cy.get('[data-cy="nc-survey-form__input-LastUpdate"]').click();
      cy.get(".ant-picker-now-btn:visible").contains("Now").click();
      cy.get(".ant-btn-primary:visible").contains("Ok").click();
      cy.get('[data-cy="nc-survey-form__btn-next"]').click();

      // takes time for the link field to be rendered
      cy.wait(2000);

      validateFormPage({
        footer: "3 / 3",
        btnSubmit: "btn-submit",
        fieldLabel: "City List",
      });
      cy.get('[data-cy="nc-survey-form__btn-submit"]').click();

      // validate success message
      cy.get('[data-cy="nc-survey-form__success-msg"]')
        .should("be.visible")
        .contains("Congratulations!")
        .should("be.visible");

      // validate "Submit another form" button
      cy.get('[data-cy="nc-survey-form__btn-submit-another-form"]').should(
        "be.visible"
      );
    });

    it("Delete form view", () => {
      loginPage.loginAndOpenProject(apiType, dbType);
      cy.openTableTab("Country", 25);

      // clean up newly added rows into Country table operations
      // this auto verifies successfull addition of rows to table as well
      mainPage.getPagination(5).click();

      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 10);

      mainPage.getCell("Country", 10).rightclick();
      cy.getActiveMenu(".nc-dropdown-grid-context-menu")
        .contains("Delete Row")
        .click();

      cy.viewDelete(0);
    });
  });
};
