import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { roles, staticProjects } from "../../support/page_objects/projectConstants"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { _advSettings, _editSchema, _editData, _editComment, _viewMenu } from "../spec/roleValidation.spec"

export const genTest = (type, xcdb) => {
    if (!isTestSuiteActive(type, xcdb)) return;

    describe('Static user creations (different roles)', () => {
        // beforeEach(() => {
        //     loginPage.signIn(roles.owner.credentials)
        //     projectsPage.openProject(getPrimarySuite().basic.name)
        // })
        before(() => {
            mainPage.navigationDraw(mainPage.TEAM_N_AUTH).click()
        })

        const addUser = (user) => {
            it(`RoleType: ${user.name}`, () => {
                // for first project, users need to be added explicitly using "New User" button
                // for subsequent projects, they will be required to just add to this project
                // using ROW count to identify if its former or latter scenario
                // 5 users (owner, creator, editor, viewer, commenter) + row header = 6
                cy.get(`tr`).then((obj) => {
                    cy.log(obj.length)
                    if (obj.length == 6) {
                        mainPage.addExistingUserToProject(user.credentials.username, user.name)
                    } else {
                        mainPage.addNewUserToProject(user.credentials, user.name)
                    }
                })
            })
        }

        addUser(roles.creator)
        addUser(roles.editor)
        addUser(roles.commenter)
        addUser(roles.viewer)                
    })    
    
    const roleValidation = (roleType) => {
        describe(`User role validation`, () => {

            if (roleType != 'owner') {
                it(`[${roles[roleType].name}] SignIn, Open project`, () => {
                    cy.log(mainPage.roleURL[roleType])
                    cy.visit(mainPage.roleURL[roleType])
                    cy.wait(3000)

                    // Redirected to new URL, feed details
                    //
                    cy.get('input[type="text"]').type(roles[roleType].credentials.username)
                    cy.get('input[type="password"]').type(roles[roleType].credentials.password)
                    cy.get('button:contains("SIGN")').click()

                    cy.url({ timeout: 6000 }).should('contain', '#/project')
                    cy.wait(1000)

                    if('rest' == type)
                        projectsPage.openProject(staticProjects.externalREST.basic.name)
                    else
                        projectsPage.openProject(staticProjects.externalGQL.basic.name)  
                })                    
            }

            ///////////////////////////////////////////////////////
            // Test suite

            const errHndl = (err, runnable, done) => {
                expect(err.message).to.include('Not allowed')
                done()
                return false
            }

            it(`[${roles[roleType].name}] Left navigation menu, New User add`, (done) => {
                cy.on('uncaught:exception', (err, runnable) => errHndl(err, runnable, done))

                // project configuration settings
                //
                _advSettings(roleType, false)
                
                cy.wait(2000).then(() => {
                    done()
                })
            })

            it(`[${roles[roleType].name}] Schema: create table, add/modify/delete column`, (done) => {
                cy.on('uncaught:exception', (err, runnable) => errHndl(err, runnable, done))
                
                // Schema related validations
                //  - Add/delete table
                //  - Add/Update/delete column
                //
                _editSchema(roleType, false)

                cy.wait(2000).then(() => {
                    done()
                })  
            })

            it(`[${roles[roleType].name}] Data: add/modify/delete row, update cell contents`, (done) => {

                // known issue: to be fixed
                // right click raising alarm 'not allowed' for viewer
                //
                cy.on('uncaught:exception', (err, runnable) => errHndl(err, runnable, done))

                // Table data related validations
                //  - Add/delete/modify row
                //
                _editData(roleType, false)

                cy.wait(2000).then(() => {
                    done()
                })
            })

            it(`[${roles[roleType].name}] Comments: view/add`, (done) => {

                cy.on('uncaught:exception', (err, runnable) => errHndl(err, runnable, done))

                // read &/ update comment
                //      Viewer: only allowed to read
                //      Everyone else: read &/ update
                //
                if (roleType != 'viewer')
                    _editComment(roleType, false)

                cy.wait(2000).then(() => {
                    done()
                })  
            })

            it(`[${roles[roleType].name}] Right navigation menu, share view`, (done) => {

                cy.on('uncaught:exception', (err, runnable) => errHndl(err, runnable, done))

                // right navigation menu bar
                //      Editor/Viewer/Commenter : can only view 'existing' views
                //      Rest: can create/edit                
                _viewMenu(roleType, false)

                cy.wait(2000).then(() => {
                    done()
                })
            })

            it(`[${roles[roleType].name}] Download files`, () => {
                mainPage.hideUnhideField('LastUpdate')
                const verifyCsv = (retrievedRecords) => {
                    // expected output, statically configured
                    let storedRecords = [
                        `City,City => Address,Country <= City`,
                        `A Corua (La Corua),939 Probolinggo Loop,Spain`,
                        `Abha,733 Mandaluyong Place,Saudi Arabia`,
                        `Abu Dhabi,535 Ahmadnagar Manor,United Arab Emirates`,
                        `Acua,1789 Saint-Denis Parkway,Mexico`
                    ]
                    
                    for (let i = 0; i < storedRecords.length; i++) {
                        // cy.log(retrievedRecords[i])
                        expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
                    }
                }                

                // download & verify
                mainPage.downloadAndVerifyCsv(`City_exported_1.csv`, verifyCsv)
                mainPage.hideUnhideField('LastUpdate')
            })            
        })        
    }

    // skip owner validation as rest of the cases pretty much cover the same
    // roleValidation('owner')
    roleValidation('creator')
    roleValidation('editor')
    roleValidation('commenter')
    roleValidation('viewer')
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
