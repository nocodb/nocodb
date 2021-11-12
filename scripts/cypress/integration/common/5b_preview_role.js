
// pre-requisite: 
//      user@nocodb.com signed up as admin
//      sakilaDb database created already 

import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { _advSettings, _editSchema, _editData, _editComment, _viewMenu, _topRightMenu } from "../spec/roleValidation.spec"


export const genTest = (type, xcdb, roleType) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    ///////////////////////////////////////////////////////////
    //// Test Suite

    describe('Role preview validations', () => {
        // Sign in/ open project
        before(() => {
            loginPage.loginAndOpenProject(type, xcdb)
        })

        after(() => {
            cy.get('.nc-preview-reset').click({ force: true })
            cy.wait(20000)

            // mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').should('not.exist')
            // cy.get('.nc-preview-reset').should('not-exist')
            cy.closeTableTab('City')
        })

        const genTestSub = (roleType) => {
        
            it(`Role preview: ${roleType}: Enable preview`, () => {
                cy.get(`.nc-preview-${roleType}`).click()
                cy.wait(3000)
                cy.openTableTab('City')
            })

            it(`Role preview: ${roleType}: Advance settings`, () => {
                // project configuration settings
                //
                _advSettings(roleType, true)
            })

            it(`Role preview: ${roleType}: Edit data`, () => {
                // Table data related validations
                //  - Add/delete/modify row
                //                
                _editData(roleType, true)
            })

            it(`Role preview: ${roleType}: Edit comment`, () => {
                // read &/ update comment
                //      Viewer: only allowed to read
                //      Everyone else: read &/ update
                //
                _editComment(roleType, true)
            })

            it(`Role preview: ${roleType}: Preview menu`, () => {
                // right navigation menu bar
                //      Editor/Viewer/Commenter : can only view 'existing' views
                //      Rest: can create/edit
                _viewMenu(roleType, true)
            })

            it(`Role preview: ${roleType}: Top Right Menu bar`, () => {
                // Share button is conditional
                // Rest are static/ mandatory
                //
                _topRightMenu(roleType, false)    
            })            

            it(`Role preview: ${roleType}: Edit Schema`, () => {
                // Schema related validations
                //  - Add/delete table
                //  - Add/Update/delete column
                //                
                _editSchema(roleType, true)
            })
        }

        genTestSub('editor')
        genTestSub('commenter')
        genTestSub('viewer')
    })
}


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