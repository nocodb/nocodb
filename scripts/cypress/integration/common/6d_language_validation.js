const { mainPage } = require("../../support/page_objects/mainPage");
const { loginPage } = require("../../support/page_objects/navigation");
const { roles } = require("../../support/page_objects/projectConstants");
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;
    describe(`Language support`, () => {
        before(() => {
            //loginPage.signIn(roles.owner.credentials)
            mainPage.toolBarTopLeft(mainPage.HOME).click();
            cy.screenshot("Debug 6d-1", { overwrite: true });
        });

        const langVerification = (idx, lang) => {
            // pick json from the file specified
            it(`Language verification: ${lang} > Projects page`, () => {
                let json = require(`../../../../packages/nc-gui/lang/${lang}`);

                // toggle menu as per index
                cy.get(".nc-menu-translate").click();

                cy.snipActiveMenu("Menu_Translation");

                cy.getActiveMenu().find(".v-list-item").eq(idx).click();

                cy.screenshot("Debug 6d-2", { overwrite: true });

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
            "da.json",
            "de.json",
            "en.json",
            "es.json",
            "fa.json",
            "fi.json",
            "fr.json",
            "hr.json",
            "id.json",
            "it_IT.json",
            "iw.json",
            "ja.json",
            "ko.json",
            "lv.json",
            "nl.json",
            "no.json",
            "pt_BR.json",
            "ru.json",
            "sl.json",
            "sv.json",
            "th.json",
            "tr.json",
            "uk.json",
            "vi.json",
            "zh_CN.json",
            "zh_HK.json",
            "zh_TW.json",
        ];

        // Index is the order in which menu options appear
        for (let i = 0; i < langMenu.length; i++)
            langVerification(i, langMenu[i]);
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
