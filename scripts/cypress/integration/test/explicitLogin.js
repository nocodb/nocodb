import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    // if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Login & Open project`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            // loginPage.loginAndOpenProject(apiType, dbType);
            // open a table to work on views
            //
            // cy.openTableTab('City');
        });

        it(``, () => {
            cy.log("Test-1");

            let projId = "";
            let query = `SELECT prefix from nc_projects_v2 where title = "sampleREST"; `;
            cy.task("sqliteExecReturnValue", query)
                .then((resolve) => {
                    cy.log(resolve);
                    projId = resolve.prefix.split("_")[1];
                    cy.log(projId);
                })
                .then(() => {
                    let query = `ALTER TABLE "actor" RENAME TO "${projId}actor"`;
                    cy.task("sqliteExec", query);
                    cy.wait(1000);
                });
        });
    });
};

// genTest("rest", "mysql");

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
