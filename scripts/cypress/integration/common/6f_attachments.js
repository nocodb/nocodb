
import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} Columns of type attachment`, () => {
        before(() => {
            loginPage.loginAndOpenProject(type)
            cy.openTableTab('Country');
        })

        after(() => {
            mainPage.deleteColumn('testAttach')
            cy.get('[href="#table||db||Country"]').find('button.mdi-close').click()
        })
        
        it(`Add column of type attachments`, () => {
            mainPage.addColumnWithType('testAttach', 'Attachment')
            cy.wait(4000)
            for (let i = 1; i <= 6; i++) {
                let filepath = `sampleFiles/${i}.json`
                mainPage.getCell('testAttach', i).click().find('input[type="file"]').attachFile(filepath)
                cy.wait(4000)      
            }
        })
    })
}

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
