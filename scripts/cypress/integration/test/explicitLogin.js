import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import {
    roles,
    staticProjects,
} from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";
let t01 = require("../common/00_pre_configurations");
let t5a = require("../common/5a_user_role");
import {
    disableTableAccess,
    _accessControl,
} from "../spec/roleValidation.spec";

const UITypes_1 = {
    SingleLineText: "SingleLineText",
    LongText: "LongText",
    Attachment: "Attachment",
    Checkbox: "Checkbox",
    MultiSelect: "MultiSelect",
    SingleSelect: "SingleSelect",
    Date: "Date",
    Year: "Year",
    PhoneNumber: "PhoneNumber",
    Email: "Email",
};

// Fix me
// Time: 'Time',

const UITypes_2 = {
    URL: "URL",
    Number: "Number",
    Decimal: "Decimal",
    Currency: "Currency",
    Percent: "Percent",
    Duration: "Duration",
    Rating: "Rating",
    Count: "Count",
    DateTime: "DateTime",
    AutoNumber: "AutoNumber",
};

const UITypes_3 = {
    Formula: "Formula",
    Geometry: "Geometry",
    JSON: "JSON",
    SpecificDBType: "SpecificDBType",
    Rollup: "Rollup",
    Lookup: "Lookup",
    LinkToAnotherRecord: "LinkToAnotherRecord",
};

const addRow_1 = (obj) => {
    let cellValue = "x";
    let filepath = `sampleFiles/${obj["Attachment"]}.json`;

    cy.get(".nc-add-new-row-btn").click();

    // SingleLineText: "SingleLineText",
    // LongText: "LongText",
    // Attachment: "Attachment",
    // Checkbox: "Checkbox",
    // MultiSelect: "MultiSelect",
    // SingleSelect: "SingleSelect",
    // Date: "Date",
    // Year: "Year",
    // PhoneNumber: "PhoneNumber",
    // Email: "Email",

    cy.get("#data-table-form-fAttachment")
        .find('input[type="file"]')
        .attachFile(filepath);

    // cy.get("#data-table-form-fCheckbox > input").first().click();
    if (obj["Checkbox"])
        cy.get("#data-table-form-fCheckbox > .d-flex > input").click();

    if (obj["MultiSelect"] === 1) {
        cy.get("#data-table-form-fMultiSelect").first().click();
        cy.getActiveMenu().find(`[role="option"]`).contains("Jan").click();
    } else if (obj["MultiSelect"] === 2) {
        cy.get("#data-table-form-fMultiSelect").first().click();
        cy.getActiveMenu().find(`[role="option"]`).contains("Feb").click();
        cy.getActiveMenu().find(`[role="option"]`).contains("Mar").click();
    } else if (obj["MultiSelect"] === 3) {
        cy.get("#data-table-form-fMultiSelect").first().click();
        cy.getActiveMenu().find(`[role="option"]`).contains("Apr").click();
        cy.getActiveMenu().find(`[role="option"]`).contains("May").click();
        cy.getActiveMenu().find(`[role="option"]`).contains("Jun").click();
    }

    cy.get("#data-table-form-fSingleSelect").first().click();
    cy.getActiveMenu()
        .find(`[role="option"]`)
        .contains(`Q${obj["SingleSelect"]}`)
        .click();

    cy.get("#data-table-form-fDate > input").first().click();
    cy.getActiveMenu().contains(`${obj["Date"]}`).click();
    cy.get("body").type("{esc}");

    cy.get("#data-table-form-title > input").first().type(obj["Title"]);
    cy.get("#data-table-form-fSingleLineText > input")
        .first()
        .type(obj["SingleLineText"]);
    cy.get("#data-table-form-fLongText > textarea")
        .first()
        .type(obj["LongText"]);
    cy.get("#data-table-form-fYear > input").first().type(obj["Year"]);
    cy.get("#data-table-form-fPhoneNumber > input")
        .first()
        .type(obj["PhoneNumber"]);
    cy.get("#data-table-form-fEmail > input").first().type(obj["Email"]);

    cy.getActiveModal()
        .find("button")
        .contains("Save row")
        .click({ force: true });

    cy.toastWait("updated successfully");
};

const addRow_2 = (obj) => {
    let cellValue = "x";
    let filepath = `sampleFiles/1.json`;

    cy.get(".nc-add-new-row-btn").click();

    // URL: "URL",
    // Number: "Number",
    // Decimal: "Decimal",
    // Currency: "Currency",
    // Percent: "Percent",
    // Duration: "Duration",
    // Rating: "Rating",
    // Count: "Count",
    // DateTime: "DateTime",
    // AutoNumber: "AutoNumber",

    cy.get("#data-table-form-fDateTime").first().click();
    cy.getActiveModal().contains(`${obj["DateTime"]}`).first().click();
    cy.getActiveModal().find("button").contains("OK").click();
    // cy.get("body").type("{esc}");

    cy.get("#data-table-form-title > input").first().type(obj["Title"]);
    cy.get("#data-table-form-fURL > input").first().type(`${obj["URL"]}`);
    cy.get("#data-table-form-fNumber > input").first().type(`${obj["Number"]}`);
    cy.get("#data-table-form-fDecimal > input")
        .first()
        .type(`${obj["Decimal"]}`);
    cy.get("#data-table-form-fCurrency > input")
        .first()
        .type(`${obj["Currency"]}`);
    cy.get("#data-table-form-fPercent > input")
        .first()
        .type(`${obj["Percent"]}`);
    cy.get("#data-table-form-fDuration > input")
        .first()
        .type(`${obj["Duration"]}`);
    cy.get("#data-table-form-fRating > input").first().type(`${obj["Rating"]}`);
    cy.get("#data-table-form-fCount > input").first().type(`${obj["Count"]}`);
    cy.get("#data-table-form-fAutoNumber > input")
        .first()
        .type(`${obj["AutoNumber"]}`);

    cy.getActiveModal()
        .find("button")
        .contains("Save row")
        .click({ force: true });

    cy.toastWait("updated successfully");
};

function createView(viewType, viewName) {
    // click on 'Grid/Gallery' button on Views bar
    cy.get(`.nc-create-${viewType}-view`).click();

    // Pop up window, click Submit (accepting default name for view)
    cy.getActiveModal().find("button:contains(Submit)").click();
    cy.toastWait("View created successfully");

    // validate if view was creted && contains default name 'Country1'
    cy.get(`.nc-view-item.nc-${viewType}-view-item`)
        .contains(viewName)
        .should("exist");
}

function renameview(viewType, viewName, newName) {
    cy.get(`.nc-view-item.nc-${viewType}-view-item`)
        .contains(viewName)
        .parent()
        .parent()
        .parent()
        .find(".nc-view-edit-icon")
        .click({ force: true });

    // feed new name
    cy.get(`.nc-${viewType}-view-item input`).type(`${newName}{enter}`);
    cy.toastWait("View renamed successfully");

    // validate
    cy.get(`.nc-view-item.nc-${viewType}-view-item`)
        .contains(newName)
        .should("exist");
}

function reOrder(field1, field2) {
    cy.get(`.nc-child-draggable-icon-${field1}`).drag(
        `.nc-child-draggable-icon-${field2}`
    );
}

function openNcViewsTab(viewType, viewName) {
    cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains(viewName).click();
}

let viewURL = {};
const generateViewLink = (viewName) => {
    mainPage.shareView().click();

    // wait, as URL initially will be /undefined
    cy.getActiveModal()
        .find(".share-link-box")
        .contains("/nc/", { timeout: 10000 })
        .should("exist");

    // copy link text, visit URL
    cy.getActiveModal()
        .find(".share-link-box")
        .contains("/nc/", { timeout: 10000 })
        .then(($obj) => {
            cy.get("body").type("{esc}");
            // viewURL.push($obj.text())
            viewURL[viewName] = $obj.text().trim();
        });
};

function addSingleSelect(key) {
    let colName = `f${UITypes_1[key]}`;
    let colType = UITypes_1[key];
    let options = ["Q1", "Q2", "Q3", "Q4"];

    cy.get(".v-window-item--active .nc-grid  tr > th:last button").click({
        force: true,
    });
    cy.get(".nc-column-name-input input", { timeout: 3000 })
        .clear()
        .type(colName);
    // Column data type: to be set to lookup in this context
    cy.get(".nc-ui-dt-dropdown").click().clear().type(colType);
    cy.getActiveMenu().contains(` ${colType} `).first().click();
    cy.getActiveMenu()
        .find(`.d-flex.py-1 input[type="text"]`)
        .last()
        .type(options[0]);
    for (let i = 0; i < options.length - 1; i++) {
        cy.getActiveMenu().find("button").contains("Add option").click();
        cy.getActiveMenu()
            .find(`.d-flex.py-1 input[type="text"]`)
            .last()
            .type(options[i + 1]);
    }
    cy.get(".nc-col-create-or-edit-card").contains("Save").click();
    cy.toastWait(`Update table successful`);
}

function addMultiSelect(key) {
    let colName = `f${UITypes_1[key]}`;
    let colType = UITypes_1[key];
    let options = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    cy.get(".v-window-item--active .nc-grid  tr > th:last button").click({
        force: true,
    });
    cy.get(".nc-column-name-input input", { timeout: 3000 })
        .clear()
        .type(colName);
    // Column data type: to be set to lookup in this context
    cy.get(".nc-ui-dt-dropdown").click().clear().type(colType);
    cy.getActiveMenu().contains(` ${colType} `).first().click();
    cy.getActiveMenu()
        .find(`.d-flex.py-1 input[type="text"]`)
        .last()
        .type(options[0]);
    for (let i = 0; i < options.length - 1; i++) {
        cy.getActiveMenu().find("button").contains("Add option").click();
        cy.getActiveMenu()
            .find(`.d-flex.py-1 input[type="text"]`)
            .last()
            .type(options[i + 1]);
    }
    cy.get(".nc-col-create-or-edit-card").contains("Save").click();
    cy.toastWait(`Update table successful`);
}

export const genTest = (apiType, dbType) => {
    // set 1

    describe(`Project pre-configurations`, () => {
        it("Admin SignUp", () => {
            cy.task("log", "This will be output to the terminal");
            cy.waitForSpinners();
            cy.signinOrSignup(roles.owner.credentials);
        });

        const createProject = (proj) => {
            it(`Create ${proj.basic.name} project`, () => {
                cy.snip("ProjectPage");
                // click home button
                cy.get(".nc-noco-brand-icon").click();

                cy.get(".nc-container").then((obj) => {
                    cy.log(obj);

                    // if project already created, open
                    // else, create a new one
                    if (true == obj[0].innerHTML.includes(proj.basic.name)) {
                        projectsPage.openProject(proj.basic.name);
                    } else {
                        projectsPage.createProject(proj.basic, proj.config);
                    }
                });
            });
        };

        if ("rest" === apiType) {
            if ("xcdb" === dbType) {
                createProject(staticProjects.sampleREST);
            } else if (dbType === "mysql") {
                createProject(staticProjects.externalREST);
            } else if (dbType === "postgres") {
                createProject(staticProjects.pgExternalREST);
            }
        } else if ("graphql" === apiType) {
            if ("xcdb" === dbType) {
                createProject(staticProjects.sampleGQL);
            } else if (dbType === "mysql") {
                createProject(staticProjects.externalGQL);
            } else if (dbType === "postgres") {
                createProject(staticProjects.pgExternalGQL);
            }
        }
    });

    // set 2

    describe("Static user creations (different roles)", () => {
        before(() => {
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
    });

    // set 3

    describe(`${apiType.toUpperCase()} api - Login & Open project`, () => {
        before(() => {
            loginPage.loginAndOpenProject(apiType, dbType);
            cy.toastWait("No tables in this schema");
        });

        it(`Create Table-1`, () => {
            cy.createTable("table-1");

            // Add columns
            // SingleLineText: "SingleLineText",
            // LongText: "LongText",
            // Attachment: "Attachment",
            // Checkbox: "Checkbox",
            // MultiSelect: "MultiSelect",
            // SingleSelect: "SingleSelect",
            // Date: "Date",
            // Year: "Year",
            // PhoneNumber: "PhoneNumber",
            // Email: "Email",

            for (let key of Object.keys(UITypes_1)) {
                if (key === "SingleSelect") {
                    addSingleSelect(key);
                } else if (key === "MultiSelect") {
                    addMultiSelect(key);
                } else {
                    mainPage.addColumnWithType(
                        `f${UITypes_1[key]}`,
                        UITypes_1[key],
                        "table-1"
                    );
                }
            }
            cy.closeTableTab("table-1");
        });

        it(`Table-1 Data`, () => {
            cy.openTableTab("table-1", 0);
            cy.wait(3000);

            let insertObj = {
                Title: "x",
                SingleLineText: "abcd",
                LongText: "abcd",
                Attachment: 1,
                Checkbox: 0,
                MultiSelect: 0,
                SingleSelect: 0,
                Date: 10,
                Year: 1920,
                PhoneNumber: 9886098860,
                Email: "abc@x.com",
            };
            for (let i = 0; i < 5; i++) {
                insertObj["Title"] = `x${i}`;
                insertObj["SingleLineText"] += "a";
                insertObj["LongText"] += "\nabcd";
                insertObj["Attachment"] = (i % 5) + 1;
                insertObj["Checkbox"] = i % 2;
                insertObj["MultiSelect"] = i % 6;
                insertObj["SingleSelect"] = (i % 4) + 1;
                insertObj["Date"] = i % 28;
                insertObj["Year"] += i;
                insertObj["PhoneNumber"] += i;
                addRow_1(insertObj);
            }

            cy.closeTableTab("table-1");
        });

        it(`Create Table-2`, () => {
            // add columns
            // URL: "URL",
            // Number: "Number",
            // Decimal: "Decimal",
            // Currency: "Currency",
            // Percent: "Percent",
            // Duration: "Duration",
            // Rating: "Rating",
            // Count: "Count",
            // DateTime: "DateTime",
            // AutoNumber: "AutoNumber",

            cy.createTable("table-2");
            for (let key of Object.keys(UITypes_2)) {
                cy.log(key + " -> " + UITypes_2[key]);
                mainPage.addColumnWithType(
                    `f${UITypes_2[key]}`,
                    UITypes_2[key],
                    "table-2"
                );
            }
            cy.closeTableTab("table-2");
        });

        it(`Table-2 Data`, () => {
            cy.openTableTab("table-2", 0);
            cy.wait(3000);

            let insertObj = {
                Title: "x",
                URL: "https://www.nocodb.com",
                Number: 10,
                Decimal: 10.8,
                Currency: 10,
                Percent: 10,
                Duration: 10,
                Rating: 1,
                Count: 10,
                DateTime: 10,
                AutoNumber: 1,
            };
            for (let iCnt = 0; iCnt < 5; iCnt++) {
                insertObj["Title"] = `y${iCnt}`;
                insertObj["Number"] += iCnt;
                insertObj["Decimal"] += iCnt;
                insertObj["Currency"] += iCnt;
                insertObj["Percent"] += iCnt;
                insertObj["Duration"] += iCnt;
                insertObj["Rating"] += iCnt % 4;
                insertObj["Count"] += iCnt;
                insertObj["DateTime"] = iCnt % 28;
                insertObj["AutoNumber"] += iCnt;
                addRow_2(insertObj);
            }

            cy.closeTableTab("table-2");
        });

        it(`Create Views`, () => {
            cy.openTableTab("table-2", 0);
            let tableName = "table-2";

            createView("grid", `${tableName}1`);
            createView("grid", `${tableName}2`);
            createView("grid", `${tableName}3`);
            createView("grid", `${tableName}4`);
            createView("gallery", `${tableName}5`);
            createView("gallery", `${tableName}6`);
            createView("gallery", `${tableName}7`);
            createView("gallery", `${tableName}8`);
            createView("form", `${tableName}9`);
            createView("form", `${tableName}10`);
            createView("form", `${tableName}11`);
            createView("form", `${tableName}12`);

            cy.closeTableTab("table-2");
        });

        it(`Reorder Views`, () => {
            // // reorder views
            let tableName = "table-2";

            cy.openTableTab("table-2", 0);
            reOrder(`${tableName}12`, `${tableName}1`);
            reOrder(`${tableName}11`, `${tableName}2`);
            cy.closeTableTab("table-2");
        });

        it(`Add more tables, reorder`, () => {
            // add more tables
            cy.createTable("table-3");
            cy.createTable("table-4");
            cy.createTable("table-5");
            cy.createTable("table-6");
            // re-order tables
            reOrder(`table-6`, `table-1`);
            reOrder(`table-5`, `table-2`);
            cy.closeTableTab("table-3");
            cy.closeTableTab("table-4");
            cy.closeTableTab("table-5");
            cy.closeTableTab("table-6");
        });

        it(`Reorder columns`, () => {
            cy.openTableTab("table-2", 0);

            // reorder fields
            cy.get(".nc-fields-menu-btn").click();
            reOrder("fDecimal", "fDateTime");
            reOrder("fDuration", "title");
            cy.get(".nc-fields-menu-btn").click();

            cy.closeTableTab("table-2");
        });

        it(`rename view`, () => {
            // rename view
            let tableName = "table-2";

            cy.openTableTab("table-2", 0);
            renameview("grid", `${tableName}4`, `renamed-${tableName}4`);
            renameview("gallery", `${tableName}8`, `renamed-${tableName}8`);
            renameview("form", `${tableName}12`, `renamed-${tableName}12`);
            cy.closeTableTab("table-2");
        });

        it(`rename table`, () => {
            // rename table
            cy.get(".nc-project-tree")
                .find(".v-list-item__title:contains(Tables)", {
                    timeout: 10000,
                })
                .should("exist")
                .first()
                .click({ force: true });
            cy.renameTable("table-6", "renamed-table-6");
            cy.get(".nc-project-tree")
                .find(".v-list-item__title:contains(Tables)", {
                    timeout: 10000,
                })
                .should("exist")
                .first()
                .click({ force: true });

            cy.closeTableTab("renamed-table-6");
        });

        it(`custom form`, () => {
            let tableName = "table-2";

            cy.openTableTab("table-2", 0);

            // form enable options, hide few fields
            openNcViewsTab("form", `${tableName}10`);
            cy.get(".nc-form")
                .find('[placeholder="Form Title"]')
                .clear()
                .type("A B C D");
            cy.get(".nc-form")
                .find('[placeholder="Add form description"]')
                .clear()
                .type("Some description about form comes here");
            cy.get(".nc-form > .mx-auto")
                .find("textarea")
                .type("Congratulations!");
            cy.get("#data-table-form-fNumber").drag("#data-table-form-fURL");
            cy.get("#data-table-form-fCurrency").drag(
                "#data-table-form-fDecimal"
            );
            cy.get('[title="fPercent"]').drag(".nc-drag-n-drop-to-hide");
            cy.get('[title="fDuration"]').drag(".nc-drag-n-drop-to-hide");
            cy.get('[title="fRating"]').drag(".nc-drag-n-drop-to-hide");
            cy.get('[title="fCount"]').drag(".nc-drag-n-drop-to-hide");
            cy.get('[title="fDateTime"]').drag(".nc-drag-n-drop-to-hide");
            cy.get('[title="fAutoNumber"]').drag(".nc-drag-n-drop-to-hide");
            cy.get(".nc-form > .mx-auto")
                .find('[type="checkbox"]')
                .eq(0)
                .click({ force: true });
            cy.get(".nc-form > .mx-auto")
                .find('[type="checkbox"]')
                .eq(1)
                .click({ force: true });

            cy.closeTableTab("table-2");
        });

        it(`add smtp`, () => {
            mainPage.navigationDraw(mainPage.APPSTORE).click();
            mainPage.configureSMTP(
                "admin@ex.com",
                "smtp.ex.com",
                "8080",
                "TLS"
            );
            cy.get(`[href="#appStore||||App Store "]`)
                .find(".mdi-close")
                .click();
        });

        it(`share view`, () => {
            // share view
            let tableName = "table-2";
            cy.openTableTab("table-2", 0);

            openNcViewsTab("grid", `${tableName}1`);
            generateViewLink(`${tableName}1`);
            openNcViewsTab("gallery", `${tableName}5`);
            generateViewLink(`${tableName}5`);
            openNcViewsTab("form", `${tableName}9`);
            generateViewLink(`${tableName}9`);

            cy.closeTableTab("table-2");
        });

        it(`hide sort filter`, () => {
            // hide sort filter
            cy.openTableTab("table-2", 0);

            mainPage.hideField("fURL");
            mainPage.hideField("fNumber");
            mainPage.sortField("fNumber", "Z -> A");
            mainPage.sortField("fRating", "Z -> A");
            mainPage.filterField("fRating", ">", "2");
            mainPage.filterField("fCurrency", ">", "10");

            cy.closeTableTab("table-2");
        });

        it(`Share Base`, () => {
            // base share
            cy.get(".nc-topright-menu").find(".nc-menu-share").click();
            // Click on readonly base text
            cy.getActiveModal().find(".nc-disable-shared-base").click();
            // Select 'Readonly link'
            cy.getActiveMenu()
                .find(".caption")
                .contains("Anyone with the link")
                .click();
            cy.getActiveModal().find(".nc-shared-base-role").click();
            cy.getActiveMenu()
                .find('[role="menuitem"]')
                .contains("Editor")
                .click();
            cy.getActiveModal().type("{esc}");
        });

        it(`UI ACL`, () => {
            // UI Access control
            // open Project metadata tab
            //
            mainPage.navigationDraw(mainPage.PROJ_METADATA).click();
            cy.get(".nc-exp-imp-metadata").dblclick({ force: true });
            cy.get(".nc-ui-acl-tab").click({ force: true });
            cy.wait(3000);
            // disable table & view access
            //
            disableTableAccess("table-5", "editor");
            disableTableAccess("table-5", "commenter");
            disableTableAccess("table-5", "viewer");
            disableTableAccess("table-4", "editor");
            disableTableAccess("table-4", "commenter");
            disableTableAccess("table-4", "viewer");
            disableTableAccess("table-27", "editor");
            disableTableAccess("table-27", "commenter");
            disableTableAccess("table-27", "viewer");
            disableTableAccess("table-29", "editor");
            disableTableAccess("table-29", "commenter");
            disableTableAccess("table-29", "viewer");
        });

        it(`Link to another record`, () => {
            // lookup, rollup
            cy.openTableTab("table-1", 0);

            // link to another record
            let colType = "LinkToAnotherRecord";
            cy.get(
                ".v-window-item--active .nc-grid  tr > th:last button"
            ).click({
                force: true,
            });
            cy.get(".nc-column-name-input input", { timeout: 3000 })
                .clear()
                .type("fLink");

            // Column data type: to be set to lookup in this context
            cy.get(".nc-ui-dt-dropdown").click().clear().type(colType);
            cy.getActiveMenu().contains(` ${colType} `).first().click();

            cy.get(`[role="combobox"]`).last().click();
            cy.getActiveMenu()
                .find(`[role="option"]`)
                .contains("table-2")
                .click();

            cy.get(".nc-col-create-or-edit-card").contains("Save").click();

            cy.closeTableTab("table-1");
        });
    });
};

// plain project creation
// t01.genTest("rest", "xcdb");

// local activities
genTest("rest", "xcdb");

// user creation
// t5a.genTest("rest", "xcdb");

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
