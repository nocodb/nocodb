
import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} Upload/ Download CSV`, () => {
        before(() => {
            // loginPage.loginAndOpenProject(type)
            cy.openTableTab('Country');
        })

        after(() => {
            cy.closeTableTab('Country')
        })              

        it('Download verification- base view, default columns', () => {
            mainPage.hideUnhideField('LastUpdate')
            const verifyCsv = (retrievedRecords) => {
                // expected output, statically configured
                let storedRecords = [
                    `Country,Country => City`,
                    `Afghanistan,Kabul`,
                    `Algeria,"Batna,Bchar,Skikda"`,
                    `American Samoa,Tafuna`,
                    `Angola,"Benguela,Namibe"`
                ]
                
                for (let i = 0; i < storedRecords.length; i++) {
                    cy.log(retrievedRecords[i])
                    expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
                }
            }                

            // download & verify
            mainPage.downloadAndVerifyCsv(`Country_exported_1.csv`, verifyCsv)
            mainPage.hideUnhideField('LastUpdate')
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
