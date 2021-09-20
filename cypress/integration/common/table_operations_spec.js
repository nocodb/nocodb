
import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { roles, staticProjects } from "../../support/page_objects/projectConstants";

const genTest = (type, meta) => {

  describe(`${meta ? 'Meta - ' : ''}${type.toUpperCase()} api - Table`, () => {

    before(() => {
      loginPage.signIn(roles.owner.credentials)
      if(!meta)
      {
        if(type=='rest')
          projectsPage.openProject(staticProjects.externalREST.basic.name)
        else
          projectsPage.openProject(staticProjects.externalGQL.basic.name)
      }
      else
      {
        if(type=='rest')
          projectsPage.openProject(staticProjects.sampleREST.basic.name)
        else
          projectsPage.openProject(staticProjects.sampleGQL.basic.name)
      }  
    })

    const name = 'Test' + Date.now();

    // create a new random table
    it('Create Table', () => {
      cy.get('.add-btn').click();
      cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
      if (!meta) {
        cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
      }
      cy.wait(5000)
      cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
      cy.get(`.project-tab:contains(${name})`).should('exist')
      cy.url().should('contain', `?name=${name}&`)

      cy.wait(3000)
    })


    // delete newly created table
    it('Delete Table', () => {

      cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
        .first().click()

      cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});

      cy.get(`.project-tab:contains(${name}):visible`).should('exist')

      cy.get('.nc-table-delete-btn:visible').click()

      cy.get('button:contains(Submit)').click()
      cy.get(`.project-tab:contains(${name}):visible`).first().should('not.exist')
    });
  })
}


genTest('rest')
genTest('graphql')
genTest('rest', true)
genTest('graphql', true)

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