import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Language support`, () => {
    before(() => {
      cy.restoreLocalStorage();

      cy.visit("/");
      cy.wait(5000);
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    // after(() => {
    // });

    const langVerification = (idx, lang) => {
      // pick json from the file specified
      it(`Language verification: ${lang} > Projects page`, () => {
        let json = require(`../../../../packages/nc-gui/lang/${lang}`);

        cy.wait(500);
        // toggle menu as per index
        cy.get(".nc-menu-translate").should("exist").last().click();
        cy.wait(500);
        cy.getActiveMenu(".nc-dropdown-menu-translate")
          .find(".ant-dropdown-menu-item")
          .eq(idx)
          .click();
        cy.wait(200);

        // basic validations
        // 1. Page title: "My Projects"
        // 2. Button: "New Project"
        // 3. Search box palceholder text: "Search Projects"
        // cy.get("b").contains(json.title.myProject).should("exist");
        cy.get(".nc-project-page-title")
          .contains(json.title.myProject)
          .should("exist");
        cy.get(".nc-new-project-menu")
          .contains(json.title.newProj)
          .should("exist");
        cy.get(`[placeholder="${json.activity.searchProject}"]`).should(
          "exist"
        );
      });
    };

    let langMenu = [
      "help-translate",
      "ar.json",
      "bn_IN.json",
      "da.json",
      "de.json",
      "en.json",
      "es.json",
      "fa.json",
      "fi.json",
      "fr.json",
      "he.json",
      "hi.json",
      "hr.json",
      "id.json",
      "it.json",
      "ja.json",
      "ko.json",
      "lv.json",
      "nl.json",
      "no.json",
      "pl.json",
      "pt.json",
      "pt_BR.json",
      "ru.json",
      "sl.json",
      "sv.json",
      "th.json",
      "tr.json",
      "uk.json",
      "vi.json",
      "zh-Hans.json",
      "zh-Hant.json",
    ];

    // Index is the order in which menu options appear
    for (let i = 1; i < langMenu.length; i++) langVerification(i, langMenu[i]);

    // reset to English
    langVerification(5, langMenu[5]);
  });
};


