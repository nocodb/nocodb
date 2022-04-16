import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";
import {
    isPostgres,
    isXcdb,
    roles,
    staticProjects,
} from "../../support/page_objects/projectConstants";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import {
    _advSettings,
    _editSchema,
    _editData,
    _editComment,
    _viewMenu,
    _topRightMenu,
    disableTableAccess,
    _accessControl,
} from "../spec/roleValidation.spec";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe("Static user creations (different roles)", () => {
        before(() => {
            mainPage.tabReset();
            cy.get(".mdi-close").click();
            mainPage.navigationDraw(mainPage.TEAM_N_AUTH).click();
        });

        const addUser = (user) => {
            it(`RoleType: ${user.name}`, () => {
                // for first project, users need to be added explicitly using "New User" button
                // for subsequent projects, they will be required to just add to this project
                // using ROW count to identify if its former or latter scenario
                // 5 users (owner, creator, editor, viewer, commenter) + row header = 6
                cy.get(`tr`).then((obj) => {
                    cy.log(obj.length);
                    if (obj.length == 6) {
                        mainPage.addExistingUserToProject(
                            user.credentials.username,
                            user.name
                        );
                    } else {
                        mainPage.addNewUserToProject(
                            user.credentials,
                            user.name
                        );
                    }
                });
            });
        };

        addUser(roles.creator);
        addUser(roles.editor);
        addUser(roles.commenter);
        addUser(roles.viewer);

        // Access contrl list- configuration
        //
        it(`Access control list- configuration`, () => {
            mainPage.closeMetaTab();

            // open Project metadata tab
            //
            mainPage.navigationDraw(mainPage.PROJ_METADATA).click();
            cy.get(".nc-exp-imp-metadata").dblclick({ force: true });
            cy.get(".nc-ui-acl-tab").click({ force: true });

            cy.snip("Meta_Tab3");

            // validate if it has 19 entries representing tables & views
            if (isPostgres())
                cy.get(".nc-acl-table-row").should("have.length", 24);
            else if (isXcdb())
                cy.get(".nc-acl-table-row").should("have.length", 19);
            else cy.get(".nc-acl-table-row").should("have.length", 19);

            // disable table & view access
            //
            disableTableAccess("language", "editor");
            disableTableAccess("language", "commenter");
            disableTableAccess("language", "viewer");

            disableTableAccess("customerlist", "editor");
            disableTableAccess("customerlist", "commenter");
            disableTableAccess("customerlist", "viewer");

            mainPage.closeMetaTab();
        });
    });

    const roleValidation = (roleType) => {
        describe(`User role validation`, () => {
            if (roleType != "owner") {
                it(`[${roles[roleType].name}] SignIn, Open project`, () => {
                    cy.log(mainPage.roleURL[roleType]);
                    cy.visit(mainPage.roleURL[roleType], {
                        baseUrl: null,
                    });
                    cy.wait(5000);

                    // Redirected to new URL, feed details
                    //
                    cy.get('input[type="text"]')
                        .should("exist")
                        .type(roles[roleType].credentials.username);
                    cy.get('input[type="password"]').type(
                        roles[roleType].credentials.password
                    );
                    cy.get('button:contains("SIGN")').click();

                    cy.url({ timeout: 6000 }).should("contain", "#/project");

                    if (dbType === "xcdb") {
                        if ("rest" == apiType)
                            projectsPage.openProject(
                                staticProjects.sampleREST.basic.name
                            );
                        else
                            projectsPage.openProject(
                                staticProjects.sampleGQL.basic.name
                            );
                    } else if (dbType === "mysql") {
                        if ("rest" == apiType)
                            projectsPage.openProject(
                                staticProjects.externalREST.basic.name
                            );
                        else
                            projectsPage.openProject(
                                staticProjects.externalGQL.basic.name
                            );
                    } else if (dbType === "postgres") {
                        if ("rest" == apiType)
                            projectsPage.openProject(
                                staticProjects.pgExternalREST.basic.name
                            );
                        else
                            projectsPage.openProject(
                                staticProjects.pgExternalGQL.basic.name
                            );
                    }

                    if (roleType != "creator") {
                        cy.closeTableTab("Actor");
                    }
                });
            }

            ///////////////////////////////////////////////////////
            // Test suite

            it(`[${roles[roleType].name}] Left navigation menu, New User add`, () => {
                // project configuration settings
                //
                _advSettings(roleType, false);
            });

            it(`[${roles[roleType].name}] Access control`, () => {
                // Access control validation
                //
                _accessControl(roleType, false);
            });

            it(`[${roles[roleType].name}] Schema: create table, add/modify/delete column`, () => {
                // Schema related validations
                //  - Add/delete table
                //  - Add/Update/delete column
                //
                _editSchema(roleType, false);
            });

            it(`[${roles[roleType].name}] Data: add/modify/delete row, update cell contents`, () => {
                // Table data related validations
                //  - Add/delete/modify row
                //
                _editData(roleType, false);
            });

            it(`[${roles[roleType].name}] Comments: view/add`, () => {
                // read &/ update comment
                //      Viewer: only allowed to read
                //      Everyone else: read &/ update
                //
                if (roleType != "viewer") _editComment(roleType, false);
            });

            it(`[${roles[roleType].name}] Right navigation menu, share view`, () => {
                // right navigation menu bar
                //      Editor/Viewer/Commenter : can only view 'existing' views
                //      Rest: can create/edit
                _viewMenu(roleType, false);
            });

            it(`[${roles[roleType].name}] Top Right Menu bar`, () => {
                // Share button is conditional
                // Rest are static/ mandatory
                //
                _topRightMenu(roleType, false);
            });

            it(`[${roles[roleType].name}] Download files`, () => {
                // ncv2@fixme
                // viewer & commenter doesn't contain hideField option in ncv2
                if (roleType != "viewer" && roleType != "commenter") {
                    // #ID, City, LastUpdate, City => Address, Country <= City, +
                    mainPage.hideField("LastUpdate");

                    const verifyCsv = (retrievedRecords) => {
                        // expected output, statically configured
                        let storedRecords = [
                            `City,AddressList,CountryRead`,
                            `A Corua (La Corua),939 Probolinggo Loop,Spain`,
                            `Abha,733 Mandaluyong Place,Saudi Arabia`,
                            `Abu Dhabi,535 Ahmadnagar Manor,United Arab Emirates`,
                            `Acua,1789 Saint-Denis Parkway,Mexico`,
                        ];

                        // ncv2@fixme
                        // skip if xcdb
                        if (!isXcdb()) {
                            for (let i = 0; i < storedRecords.length; i++) {
                                // cy.log(retrievedRecords[i])
                                expect(retrievedRecords[i]).to.be.equal(
                                    storedRecords[i]
                                );
                            }
                        }
                    };

                    // download & verify
                    mainPage.downloadAndVerifyCsv(
                        `City_exported_1.csv`,
                        verifyCsv
                    );
                    mainPage.unhideField("LastUpdate");
                }
            });
        });
    };

    // skip owner validation as rest of the cases pretty much cover the same
    // roleValidation('owner')
    roleValidation("creator");
    roleValidation("editor");
    roleValidation("commenter");
    roleValidation("viewer");
};

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
