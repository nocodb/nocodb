const { mainPage } = require("../../support/page_objects/mainPage");
const { loginPage } = require("../../support/page_objects/navigation");
const { roles } = require("../../support/page_objects/projectConstants");
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;
    describe(`Language support`, () => {
        before(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);

            cy.visit("/")
            cy.wait(5000);

            cy.saveLocalStorage();
            cy.wait(1000);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);
        });

        after(() => {
            cy.get('.nc-menu-accounts').should('exist').click();
            cy.getActiveMenu('.nc-dropdown-user-accounts-menu').find('.ant-dropdown-menu-item').eq(1).click();

            cy.wait(5000);
            cy.get('button:contains("SIGN")').should('exist')
        })

        const langVerification = (idx, lang) => {
            // pick json from the file specified
            it(`Language verification: ${lang} > Projects page`, () => {
                let json = require(`../../../../packages/nc-gui/lang/${lang}`);

                cy.wait(500);
                // toggle menu as per index
                cy.get(".nc-menu-translate").should('exist').last().click();
                cy.wait(500);
                cy.getActiveMenu(".nc-dropdown-menu-translate").find(".ant-dropdown-menu-item").eq(idx).click();
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
        for (let i = 0; i < langMenu.length; i++)
            langVerification(i, langMenu[i]);

        // reset to English
        langVerification(4, langMenu[4]);
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
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
