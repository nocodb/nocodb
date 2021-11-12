
import { mainPage } from "../../support/page_objects/mainPage"
import { projectsPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { _advSettings, _editSchema, _editData, _editComment, _viewMenu, _topRightMenu } from "../spec/roleValidation.spec"

let linkText = ''

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} Columns of type attachment`, () => {
        // before(() => {
        //     cy.openTableTab('Country');
        // })

        // after(() => {
        //     cy.closeTableTab('Country')          
        // })
        
        it(`Generate base share URL`, () => {
            // click SHARE
            cy.get('.nc-topright-menu')
                .find('.nc-menu-share')
                .click()
            
            // Click on readonly base text
            cy.getActiveModal()
                .find('.nc-container')
                .contains('Generate publicly shareable readonly base')
                .click()
            
            // Select 'Readonly link'
            cy.getActiveMenu()
                .find('.caption')
                .contains('Readonly link')
                .click()
            
            // Copy URL
            cy.getActiveModal()
                .find('.nc-url')
                .then(($obj) => {
                    cy.log($obj[0])
                    linkText = $obj[0].innerText
            })
        })

        it(`Visit base shared URL`, () => {
            cy.log(linkText)

            // visit URL & wait for page load to complete
            cy.visit(linkText)
            projectsPage.waitHomePageLoad()
        })

        it(`Validate access permissions`, () => {

            let roleType = 'viewer'
            cy.get(`[href="#roles||||Team & Auth "]`).find('button.mdi-close').click()

            _advSettings(roleType, false)
            _editSchema(roleType, false)
            _editData(roleType, false)
            _editComment(roleType, false)
            _viewMenu(roleType, false)
            _topRightMenu(roleType, false)   
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
