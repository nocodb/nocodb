/**
 *  file: ncTest.Spec.js
 *  purpose: test-suite-1
 *  author: raju udava
 *  date: 06 Sep 2020
 *
 **/

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

    // Needs to be conditionally triggered if required
    //
    // it('N. Clean up: Delete call projects', () => {
    //     projectsPage.deleteAllProject()
    // })
})
