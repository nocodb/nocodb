  
// Cypress test suite: project pre-configurations
//

import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { staticProjects, roles, isTestSuiteActive, getPrimarySuite, isSecondarySuite } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;
    describe(`Project pre-configurations`, () => {

        it('Admin SignUp', () => {
            cy.waitForSpinners();
            cy.signinOrSignup(roles.owner.credentials)
            cy.wait(2000)
        })

        const createProject = (proj) => {
            it(`Create ${proj.basic.name} project`, () => {

                // click home button
                mainPage.toolBarTopLeft(mainPage.HOME).click()
                // create requested project
                projectsPage.createProject(proj.basic, proj.config)
            })
        }

        if (isTestSuiteActive('rest', true)) createProject(staticProjects.sampleREST)
        if (isTestSuiteActive('graphql', true)) createProject(staticProjects.sampleGQL)
        if (isTestSuiteActive('rest', false)) createProject(staticProjects.externalREST)
        if (isTestSuiteActive('graphql', false)) createProject(staticProjects.externalGQL)
    })

    // describe('Static user creations (different roles)', () => {

    //     beforeEach(() => {
    //         loginPage.signIn(roles.owner.credentials)
    //         projectsPage.openProject(getPrimarySuite().basic.name)
    //     })

    //     const addUser = (user) => {
    //         it(`RoleType: ${user.name}`, () => {
    //             mainPage.addNewUserToProject(user.credentials, user.name)
    //         })
    //     }

    //     addUser(roles.creator)
    //     addUser(roles.editor)
    //     addUser(roles.commenter)
    //     addUser(roles.viewer)
    // })

    // describe('Static users- add to other static projects', () => {

    //     const addUserToProject = (proj) => {
    //         it(`Add users to ${proj.basic.name}`, () => {
    //             loginPage.signIn(roles.owner.credentials)
    //             projectsPage.openProject(proj.basic.name)

    //             mainPage.addExistingUserToProject(roles.creator.credentials.username, roles.creator.name)
    //             mainPage.addExistingUserToProject(roles.editor.credentials.username, roles.editor.name)
    //             mainPage.addExistingUserToProject(roles.commenter.credentials.username, roles.commenter.name)
    //             mainPage.addExistingUserToProject(roles.viewer.credentials.username, roles.viewer.name)
    //         })
    //     }

    //     if (isSecondarySuite('rest', true)) addUserToProject(staticProjects.sampleREST)
    //     if (isSecondarySuite('graphql', true)) addUserToProject(staticProjects.sampleGQL)
    //     if (isSecondarySuite('rest', false)) addUserToProject(staticProjects.externalREST)
    //     if (isSecondarySuite('graphql', false)) addUserToProject(staticProjects.externalGQL)
    // })

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
