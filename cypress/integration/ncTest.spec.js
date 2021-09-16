
import { loginPage, projectsPage } from "../support/page_objects/navigation"

const activeCredentials = 0

const userCredentials = [
    { username: 'user@nocodb.com', password: 'Password123.' }]

describe('Login & project page', () => {

    beforeEach(() => {
        loginPage.signIn(userCredentials[activeCredentials])
    })

    let projectName = ''

    it('1. Create project: NC_DB_NONE, NC_REST', () => {
        const projectParams = { dbType: 0, apiType: 0, name: 'sampleREST' }
        projectName = projectsPage.createProject(projectParams)
    })

    it('1a. Open existing project & refresh project list', () => {
        projectsPage.refreshProject()
        projectsPage.searchProject('sample')
        projectsPage.openProject(projectName)
    })

    it('1b. Delete project:  NC_DB_NONE, NC_REST', () => {
        projectsPage.deleteProject(projectName)
    })

    it('2. Create project: NC_DB_NONE, NC_GQL', () => {
        const projectParams = { dbType: 0, apiType: 1, name: 'sampleGQL' }
        projectName = projectsPage.createProject(projectParams)
    })

    it('2a. Delete project:  NC_DB_NONE, NC_GQL', () => {
        projectsPage.deleteProject(projectName)
    })

    it('3. Create project: NC_DB_EXTERNAL, NC_REST', () => {
        const projectParams = { dbType: 1, apiType: 1, name: 'externalREST' }
        const databaseParams = {
            databaseType: 0,
            hostAddress: 'localhost',
            portNumber: '3306',
            username: 'root',
            password: 'password',
            databaseName: 'sakila'
        }

        projectName = projectsPage.createProject(projectParams, databaseParams)

    })

    it('3a. Delete project:  NC_DB_EXTERNAL, NC_REST', () => {
        projectsPage.deleteProject(projectName)
    })



    // Needs to be conditionally triggered if required
    //
    // it('N. Clean up: Delete call projects', () => {
    //     projectsPage.deleteAllProject()
    // })
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