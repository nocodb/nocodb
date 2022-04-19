import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
    isXcdb,
    getProjectString,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} Table/view drag-drop reorder`, () => {
        function validateTreeField(index, tblName) {
            cy.get(`:nth-child(${index}) > .v-list-item__title > .caption`)
                .contains(tblName)
                .should("exist");
        }

        /*
            Original order of list items
            Actor, Address, Category, City, Country, Customer, FIlm, FilmText, Language, Payment, Rental Staff
            ActorInfo, CustomerList, FilmList, NiceButSlowerFilmList, SalesByFilmCategory, SalesByStore, StaffList
        */

        before(() => {
            mainPage.tabReset();
        });

        it(`Table & SQL View list, Drag/drop`, () => {
            // expand tree-view menu
            // cy.get(".nc-project-tree")
            //   .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
            //   .should("exist")
            //   .first()
            //   .click({ force: true });

            validateTreeField(1, "Actor");

            // move Actor field down, above Staff (drag, drop)
            cy.get(".nc-child-draggable-icon-Actor").drag(
                ".nc-child-draggable-icon-Staff"
            );

            validateTreeField(12, "Actor");

            // move ActorInfo (View) field up to first place (drag, drop)
            cy.get(".nc-child-draggable-icon-ActorInfo").drag(
                ".nc-child-draggable-icon-Address"
            );

            validateTreeField(1, "ActorInfo");
            validateTreeField(2, "Address");
            validateTreeField(13, "Actor");

            // restore ActorInfo field (drag, drop)
            cy.get(".nc-child-draggable-icon-ActorInfo").drag(
                ".nc-child-draggable-icon-Actor"
            );

            // restore Actor field (drag, drop)
            cy.get(".nc-child-draggable-icon-Actor").drag(
                ".nc-child-draggable-icon-Address"
            );

            validateTreeField(1, "Actor");
            validateTreeField(2, "Address");
            validateTreeField(12, "Staff");
            validateTreeField(13, "ActorInfo");
            validateTreeField(14, "CustomerList");

            // undo project-tree expand operation
            cy.get(".nc-project-tree")
                .find(".v-list-item__title:contains(Tables)", {
                    timeout: 10000,
                })
                .should("exist")
                .first()
                .click({ force: true });
        });

        // create new view as specified by 'viewType'
        // can be - grid/ gallery/ form
        // wait for toast to appear
        //
        function createView(viewType) {
            // click on 'Grid/Gallery' button on Views bar
            cy.get(`.nc-create-${viewType}-view`).click();

            cy.snipActiveModal(`Modal_createView_${viewType}`);

            // Pop up window, click Submit (accepting default name for view)
            cy.getActiveModal().find("button:contains(Submit)").click();

            cy.toastWait("View created successfully");
        }

        // verify view 'viewName' to be present at position 'index'
        // index starts from 0
        function validateViewField(index, viewName) {
            cy.get(".nc-view-item.nc-draggable-child")
                .eq(index)
                .contains(viewName)
                .should("exist");
        }

        // exclude@ncv2: to be investigated & fixed
        it.skip(`View (Gallery/ Grid/ Form) re-order`, () => {
            cy.openTableTab("Actor", 25);

            // create 3 views, use default names
            // Actor1, Actor2, Actor3
            createView("grid");
            createView("gallery");
            createView("form");

            // validate position order
            validateViewField(0, "Actor");
            validateViewField(1, "Actor1");
            validateViewField(2, "Actor2");
            validateViewField(3, "Actor3");

            // move Actor3 field on top (drag, drop)
            cy.get(".nc-child-draggable-icon-Actor3").drag(
                `.nc-child-draggable-icon-${
                    isXcdb() ? `${getProjectString()}` : ``
                }Actor`
            );

            // validate new position order, Actor3 on top
            validateViewField(0, "Actor3");
            validateViewField(1, "Actor");
            validateViewField(2, "Actor1");
            validateViewField(3, "Actor2");

            // delete all created views
            // click on delete icon (becomes visible on hovering mouse)
            cy.get(".nc-view-delete-icon").eq(0).click({ force: true });
            cy.toastWait("View deleted successfully");
            cy.get(".nc-view-delete-icon").eq(0).click({ force: true });
            cy.toastWait("View deleted successfully");
            cy.get(".nc-view-delete-icon").eq(0).click({ force: true });
            cy.toastWait("View deleted successfully");

            // wind up
            cy.closeTableTab("Actor");
        });
    });
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
