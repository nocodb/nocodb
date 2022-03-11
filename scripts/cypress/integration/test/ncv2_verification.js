import { mainPage } from "../../support/page_objects/mainPage";
let t01 = require("../common/00_pre_configurations");

let tableOrder = [
    "renamed-table-6",
    "table-1",
    "table-5",
    "table-2",
    "table-3",
    "table-4",
];
let columnOrder = [
    [
        "title",
        "fSingleLineText",
        "fLongText",
        "fAttachment",
        "fCheckbox",
        "fMultiSelect",
        "fSingleSelect",
        "fDate",
        "fYear",
        "fPhoneNumber",
        "fEmail",
        "table-1 => table-2",
    ],
    [
        "fDuration",
        "title",
        "fURL",
        "fNumber",
        "fCurrency",
        "fPercent",
        "fRating",
        "fCount",
        "fDateTime",
        "fDecimal",
        "fAutoNumber",
        "table-1 <= table-2",
    ],
];
let viewOrder = [
    "table-2",
    "renamed-table-212",
    "table-21",
    "table-211",
    "table-22",
    "table-23",
    "renamed-table-24",
    "table-25",
    "table-26",
    "table-27",
    "renamed-table-28",
    "table-29",
    "table-210",
];
let hiddenFields = ["fURL", "fNumber"];
let filterFields = [
    ["fRating", ">", "2"],
    ["fCurrency", ">", "10"],
];
let sortFields = [
    ["fRating", "Z -> A"],
    ["fCurrency", "Z -> A"],
];
let formHiddenFields = [
    "fPercent",
    "fDuration",
    "fRating",
    "fCount",
    "fDateTime",
    "fAutoNumber",
    "table-1 <= table-2",
];
let formFieldsOrder = ["title", "fNumber", "fURL", "fCurrency", "fDecimal"];
let formDetails = {
    title: "A B C D",
    description: "Some description about form comes here",
    message: "Congratulations",
    enabledRadio: [0, 1],
};
let sharedView = ["table-21", "table-25", "table-29"];
let sharedBase = {
    mode: "Anyone with the link",
    access: "Editor",
};
let appStoreConfig = {
    smtp: {
        from: "admin@ex.com",
        host: "smtp.ex.com",
        port: "8080",
        secure: "TLS",
        uname: "user@nocodb.com",
        pwd: "Password123.",
    },
};
let UI_ACL = ["table-4", "table-5", "table-27", "table-29"];
let rolesConfigured = {
    owner: "user@nocodb.com",
    editor: "editor@nocodb.com",
    creator: "creator@nocodb.com",
    viewer: "viewer@nocodb.com",
    commenter: "commenter@nocodb.com",
};
let multiSelectOptions = [
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
let singleSelectOptions = ["Q1", "Q2", "Q3", "Q4"];

export const genTest = (apiType, dbType) => {
    describe(`NC V2 verification`, () => {
        it(`table accessibility & row count verification`, () => {
            cy.openTableTab("table-1", 5);
            cy.closeTableTab("table-1");

            cy.openTableTab("table-2", 3);
            cy.closeTableTab("table-2");

            cy.openTableTab("table-3", 0);
            cy.closeTableTab("table-3");

            cy.openTableTab("table-4", 0);
            cy.closeTableTab("table-4");

            cy.openTableTab("table-5", 0);
            cy.closeTableTab("table-5");

            cy.openTableTab("renamed-table-6", 0);
            cy.closeTableTab("renamed-table-6");
        });

        it(`table order`, () => {
            // open project tree
            cy.get(".nc-project-tree")
                .find(".v-list-item__title:contains(Tables)", {
                    timeout: 10000,
                })
                .should("exist")
                .first()
                .click({ force: true });

            for (let i = 0; i < tableOrder.length; i++) {
                cy.get(".nc-project-tree")
                    .find('[role="option"]')
                    .eq(i)
                    .contains(tableOrder[i])
                    .should("exist");
            }
        });

        it(`column order`, () => {
            cy.openTableTab("table-1", 0);
            cy.get(".nc-grid-header-cell").should(
                "have.length",
                columnOrder[0].length + 1
            );
            for (let i = 0; i < columnOrder[0].length; i++) {
                cy.get(".nc-grid-header-cell")
                    .eq(i)
                    .contains(columnOrder[0][i])
                    .should("exist");
            }
            cy.closeTableTab("table-1");

            cy.openTableTab("table-2", 0);
            cy.get(".nc-grid-header-cell").should(
                "have.length",
                columnOrder[1].length + 1
            );
            for (let i = 0; i < columnOrder[1].length; i++) {
                cy.get(".nc-grid-header-cell")
                    .eq(i)
                    .contains(columnOrder[1][i])
                    .should("exist");
            }
            cy.closeTableTab("table-2");
        });

        it(`view order`, () => {
            cy.openTableTab("table-2", 0);
            cy.get(".view.nc-view-item").should(
                "have.length",
                viewOrder.length
            );
            for (let i = 0; i < viewOrder.length; i++) {
                cy.get(".view.nc-view-item")
                    .eq(i)
                    .contains(viewOrder[i])
                    .should("exist");
            }
            cy.closeTableTab("table-2");
        });

        it(`hidden fields`, () => {
            // fURL & fNumber fields in table-2 are hidden
            cy.openTableTab("table-2", 0);

            for (let i = 0; i < columnOrder[1].length; i++) {
                let cStr = "be.visible";
                if (i === 2 || i === 3) cStr = "not.be.visible";
                cy.get(".nc-grid-header-cell")
                    .contains(columnOrder[1][i])
                    .scrollIntoView()
                    .should(cStr);
            }

            // verify fields menu
            cy.get(".nc-fields-menu-btn").click();
            for (let i = 0; i < columnOrder[1].length; i++) {
                let cStr = "be.checked";
                if (i === 2 || i === 3) cStr = "not.be.checked";
                cy.getActiveMenu().find('[type="checkbox"]').eq(i).should(cStr);
            }
            cy.get(".nc-fields-menu-btn").click();

            cy.closeTableTab("table-2");
        });

        it(`filter fields`, () => {
            cy.openTableTab("table-2", 0);
            cy.get(".nc-filter-menu-btn").click();
            cy.get(".nc-filter-field-select").should("have.length", 2);
            cy.get(".nc-filter-operation-select").should("have.length", 2);
            cy.get(".nc-filter-value-select").should("have.length", 2);
            cy.get(".nc-filter-menu-btn").click();

            for (let i = 0; i < filterFields.length; i++) {
                cy.get(".nc-filter-field-select")
                    .eq(i)
                    .contains(filterFields[i][0])
                    .should("exist");
                cy.get(".nc-filter-operation-select")
                    .eq(i)
                    .contains(filterFields[i][1])
                    .should("exist");
                // cy.get(".nc-filter-value-select")
                //     .eq(i)
                //     .contains(filterFields[i][2])
                //     .should("exist");
            }
            cy.closeTableTab("table-2");
        });

        it(`sort fields`, () => {
            cy.openTableTab("table-2", 0);
            cy.get(".nc-sort-menu-btn").click();
            cy.getActiveMenu()
                .find(".nc-sort-item-remove-btn")
                .should("have.length", 2);
            cy.getActiveMenu()
                .find(".nc-sort-field-select")
                .should("have.length", 2);
            cy.getActiveMenu()
                .find(".nc-sort-dir-select")
                .should("have.length", 2);

            cy.getActiveMenu()
                .find(".nc-sort-field-select")
                .eq(0)
                .contains(sortFields[0][0])
                .should("exist");

            cy.getActiveMenu()
                .find(".nc-sort-field-select")
                .eq(1)
                .contains(sortFields[1][0])
                .should("exist");

            cy.getActiveMenu()
                .find(".nc-sort-dir-select")
                .eq(0)
                .contains(sortFields[0][1])
                .should("exist");

            cy.getActiveMenu()
                .find(".nc-sort-dir-select")
                .eq(0)
                .contains(sortFields[1][1])
                .should("exist");

            cy.get(".nc-sort-menu-btn").click();
            cy.closeTableTab("table-2");
        });

        it(`form verification`, () => {
            cy.openTableTab("table-2", 0);
            cy.get(`.nc-view-item.nc-form-view-item`)
                .contains("table-210")
                .click();

            // disabled fields
            cy.get(".pa-2.my-2.item.pointer.elevation-0.v-card").should(
                "have.length",
                formHiddenFields.length
            );
            for (let i = 0; i < formHiddenFields.length; i++) {
                cy.get(".pa-2.my-2.item.pointer.elevation-0.v-card")
                    .eq(i)
                    .contains(formHiddenFields[i])
                    .should("exist");
            }

            // active fields
            cy.get(
                ".nc-field-wrapper.item.px-4.my-3.pointer.nc-editable"
            ).should("have.length", formFieldsOrder.length);
            for (let i = 0; i < formFieldsOrder.length; i++) {
                cy.get(".nc-field-wrapper.item.px-4.my-3.pointer.nc-editable")
                    .eq(i)
                    .contains(formFieldsOrder[i])
                    .should("exist");
            }

            // form meta
            // New form appeared? Header & description should exist
            cy.get(".nc-form")
                .find('[placeholder="Form Title"]')
                .contains("A B C D")
                .should("exist");
            cy.get(".nc-form")
                .find('[placeholder="Add form description"]')
                .contains("Some description about form comes here")
                .should("exist");

            cy.get(".nc-form > .mx-auto")
                .find('[type="checkbox"]')
                .eq(0)
                .should("be.checked");
            cy.get(".nc-form > .mx-auto")
                .find('[type="checkbox"]')
                .eq(1)
                .should("be.checked");
            cy.get(".nc-form > .mx-auto")
                .find('[type="checkbox"]')
                .eq(2)
                .should("not.be.checked");

            cy.closeTableTab("table-2");
        });

        it(`shared view`, () => {});
        it(`shared base`, () => {
            cy.get(".nc-topright-menu").find(".nc-menu-share").click();
            cy.get(".nc-shared-base-role").contains("editor").should("exist");
            cy.get(".nc-disable-shared-base")
                .contains("Anyone with the link")
                .should("exist");
            cy.get("body").type("{esc}");
        });

        it(`app store`, () => {
            mainPage.navigationDraw(mainPage.APPSTORE).click();
            cy.get(".v-card__title.title")
                .contains("SMTP")
                .parents(".elevatio")
                .find("button")
                .contains(" Edit ")
                .should("exist");
        });

        it(`UI ACL`, () => {
            function checkAcl(tbl, role, checked) {
                const cls = `.nc-acl-${tbl}-${role}-chkbox`;
                if (checked) cy.get(cls).find("input").should("be.checked");
                else cy.get(cls).find("input").should("not.be.checked");
            }

            mainPage.navigationDraw(mainPage.PROJ_METADATA).click();
            cy.get(".nc-exp-imp-metadata").dblclick({ force: true });
            cy.get(".nc-ui-acl-tab").click({ force: true });
            cy.get(".nc-acl-table-row").should("have.length", 18);

            for (let i = 0; i < tableOrder.length; i++) {
                checkAcl(
                    tableOrder[i],
                    "editor",
                    UI_ACL.includes(tableOrder[i]) ? false : true
                );
                checkAcl(
                    tableOrder[i],
                    "viewer",
                    UI_ACL.includes(tableOrder[i]) ? false : true
                );
                checkAcl(
                    tableOrder[i],
                    "commenter",
                    UI_ACL.includes(tableOrder[i]) ? false : true
                );
            }

            for (let i = 0; i < viewOrder.length; i++) {
                checkAcl(
                    viewOrder[i],
                    "editor",
                    UI_ACL.includes(viewOrder[i]) ? false : true
                );
                checkAcl(
                    viewOrder[i],
                    "viewer",
                    UI_ACL.includes(viewOrder[i]) ? false : true
                );
                checkAcl(
                    viewOrder[i],
                    "commenter",
                    UI_ACL.includes(viewOrder[i]) ? false : true
                );
            }
        });

        it(`single select`, () => {
            cy.openTableTab("table-1", 0);
            mainPage.getCell("fSingleSelect", 1).click().click();
            for (let i = 0; i < singleSelectOptions.length; i++) {
                cy.getActiveMenu()
                    .find('[role="option"]')
                    .eq(i)
                    .contains(singleSelectOptions[i])
                    .should("exist");
            }
            cy.closeTableTab("table-1");
        });

        it(`multi select`, () => {
            cy.openTableTab("table-1", 0);
            mainPage.getCell("fMultiSelect", 1).click().click();
            for (let i = 0; i < multiSelectOptions.length; i++) {
                cy.getActiveMenu()
                    .find('[role="option"]')
                    .eq(i)
                    .contains(multiSelectOptions[i])
                    .should("exist");
            }
            cy.closeTableTab("table-1");
        });

        it(`roles configured`, () => {
            function validateRole(idx, email, role) {
                cy.get(`tbody > :nth-child(${idx}) > :nth-child(1)`)
                    .contains(email)
                    .should("exist");

                cy.get(
                    `:nth-child(${idx}) > :nth-child(2) > .mr-1 > .v-chip__content`
                )
                    .contains(role)
                    .should("exist");
            }

            validateRole(1, "user@nocodb.com", "owner");
            validateRole(2, "creator@nocodb.com", "creator");
            validateRole(3, "editor@nocodb.com", "editor");
            validateRole(4, "commenter@nocodb.com", "commenter");
            validateRole(5, "viewer@nocodb.com", "viewer");
        });
        it(``, () => {});
    });
};

// plain project creation
t01.genTest("rest", "xcdb");

// local activities
genTest("rest", "xcdb");

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
