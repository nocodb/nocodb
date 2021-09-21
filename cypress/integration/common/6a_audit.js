
import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"

const genTest = (type) => {

    describe(`${type.toUpperCase()} api - Filter, Fields, Sort`, () => {
        before(() => {
            loginPage.loginAndOpenProject(type)
            cy.get('.mdi-close').click({ multiple: true })
        })

        const getAuditCell = (row, col) => {
            return cy.get('table > tbody > tr').eq(row).find('td').eq(col)
        }

        it('Open Audit tab', ()=> {
            cy.createTable('Table-x')
            cy.deleteTable('Table-x')
            cy.wait(2000)

            mainPage.navigationDraw(mainPage.AUDIT).click()
            cy.wait(2000)

            // Audit table entries
            //  [Header] Operation Type, Operation Sub Type, Description, User, Created
            //  [0] TABLE, DELETED, delete table table-x, user@nocodb.com, ...
            //  [1] TABLE, Created, created table table-x, user@nocodb.com, ...

            getAuditCell(0,0).contains('TABLE').should('exist')
            getAuditCell(0,1).contains('DELETED').should('exist')
            getAuditCell(0,3).contains('user@nocodb.com').should('exist')

            getAuditCell(1,0).contains('TABLE').should('exist')
            getAuditCell(1,1).contains('CREATED').should('exist')
            getAuditCell(1,3).contains('user@nocodb.com').should('exist')        
        })
    })
}

genTest('rest')
genTest('graphql')

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
