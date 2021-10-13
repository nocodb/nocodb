const { loginPage } = require("../../support/page_objects/navigation")
const { roles } = require("../../support/page_objects/projectConstants")

describe(`Language support`, () => {

    before(()=> {
        loginPage.signIn(roles.owner.credentials)
    })

    const langVerification = (idx, lang) => {
        // pick json from the file specified
        it(`Language verification: ${ lang } > Projects page`, () => {
            let json = require(`../../../packages/nc-gui/lang/${ lang }`);
            
            // toggle menu as per index
            cy.get('.nc-menu-translate').click()
            cy.getActiveMenu().find('.v-list-item').eq(idx).click()

            // basic validations
            // 1. Page title: "My Projects"
            // 2. Button: "New Project"
            // 3. Search box palceholder text: "Search Projects"
            cy.get('b')
                .contains(json.projects.my_projects)
                .should('exist')
            cy.get('button.v-btn')
                .contains(json.projects.create_new_project_button.text)
                .should('exist')
            cy.get(`[placeholder="${ json.projects.search_project }"]`)
                .should('exist')
        })
    }

    // Index is the order in which menu options appear
    langVerification(0, 'da.json')
    langVerification(1, 'de.json')
    langVerification(2, 'en.json')
    langVerification(3, 'es.json')
    langVerification(4, 'fi.json')
    langVerification(5, 'fr.json')
    langVerification(6, 'hr.json')
    langVerification(7, 'id.json')     
    langVerification(8, 'it_IT.json')
    langVerification(9, 'iw.json')
    langVerification(10, 'ja.json')
    langVerification(11, 'ko.json')
    langVerification(12, 'nl.json')
    langVerification(13, 'no.json')
    langVerification(14, 'pt_BR.json')
    langVerification(15, 'ru.json')
    langVerification(16, 'sv.json')
    langVerification(17, 'th.json')
    langVerification(18, 'uk.json')
    langVerification(19, 'vi.json')
    langVerification(20, 'zh_CN.json')        
    langVerification(21, 'zh_HK.json')
    langVerification(22, 'zh_TW.json')
})

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