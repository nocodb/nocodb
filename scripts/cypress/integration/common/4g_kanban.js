import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import {loginPage} from "../../support/page_objects/navigation";

// kanban grouping field configuration
//
function configureGroupingField(field, closeMenu = true) {
  cy.get(".nc-kanban-stacked-by-menu-btn").click();

  cy.getActiveMenu('.nc-dropdown-kanban-stacked-by-menu')
    .should('exist')
    .find('.nc-kanban-grouping-field-select')
    .click();
  cy.get('.ant-select-dropdown:visible')
    .should('exist')
    .find(`.ant-select-item`)
    .contains(new RegExp("^" + field + "$", "g"))
    .should('exist')
    .click();

  if (closeMenu) {
    cy.get('.nc-kanban-stacked-by-menu-btn').click();
  }

  cy.get('.nc-kanban-stacked-by-menu-btn')
    .contains(`Stacked By ${field}`)
    .should('exist');
}

// number of kanban stacks altogether
//
function verifyKanbanStackCount(count) {
  cy.get('.nc-kanban-stack').should('have.length', count);
}

// order of kanban stacks
//
function verifyKanbanStackOrder(order) {
  cy.get('.nc-kanban-stack').each(($el, index) => {
    cy.wrap($el).should('contain', order[index]);
  });
}

// kanban stack footer numbers
//
function verifyKanbanStackFooterCount(count) {
  cy.get('.nc-kanban-stack').each(($el, index) => {
    cy.wrap($el).find('.nc-kanban-data-count').should('contain', `${count[index]} records`);
  });
}

// kanban card count in a stack
//
function verifyKanbanStackCardCount(count) {
  cy.get('.nc-kanban-stack').each(($el, index) => {
    if(count[index] > 0) {
      cy.wrap($el).find('.nc-kanban-item').should('exist').should('have.length', count[index]);
    }
  });
}

// order of cards within a stack
//
function verifyKanbanStackCardOrder(order, stackIndex, cardIndex) {
  cy.get('.nc-kanban-stack').eq(stackIndex).find('.nc-kanban-item').eq(cardIndex).should('contain', order);
}

// drag drop kanban card
//
function dragAndDropKanbanCard(srcCard, dstCard) {
  cy.get(`.nc-kanban-item .ant-card :visible:contains("${srcCard}")`).drag(`.nc-kanban-item :visible:contains("${dstCard}")`);
}

// drag drop kanban stack
//
function dragAndDropKanbanStack(srcStack, dstStack) {
  cy.get(`.nc-kanban-stack-head :contains("${srcStack}")`).drag(`.nc-kanban-stack-head :contains("${dstStack}")`);
}

let localDebug = false;

// test suite
//
export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Kanban`, () => {
    before(() => {
      if (localDebug) {
        // for standalone tests
        cy.restoreLocalStorage();
        loginPage.loginAndOpenProject(apiType, dbType);

        cy.openTableTab('Film', 25);
        cy.openTableView('kanban', 'Kanban-1');
      }
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
    });


    /**
      class name specific to kanban
        .nc-kanban-stacked-by-menu-btn
        .nc-dropdown-kanban-stacked-by-menu
        .nc-kanban-add-edit-stack-menu-btn
        .nc-dropdown-kanban-add-edit-stack-menu
        .nc-kanban-grouping-field-select
        .nc-dropdown-kanban-stack-context-menu
     **/


    it("Create Kanban view", () => {
      if(localDebug === false) {
        cy.openTableTab("Film", 25);
        cy.viewCreate("kanban");
      }
    });

    it("Rename Kanban view", () => {
      cy.viewRename("kanban", 0, "Film Kanban");
    })

    it("Configure grouping field", () => {
      configureGroupingField("Rating", true);
    })

    it("Verify kanban stacks", () => {
      verifyKanbanStackCount(6);
      verifyKanbanStackOrder(["uncategorized", "G", "PG", "PG-13", "R", "NC-17"]);
      verifyKanbanStackFooterCount(["0", "178", "194", "223", "195", "210"]);
      verifyKanbanStackCardCount([0, 25, 25, 25, 25, 25]);
    })

    it("Hide fields", () => {
      mainPage.hideAllColumns();
      mainPage.unhideField("Title", 'kanban');

      verifyKanbanStackCardCount([0, 25, 25, 25, 25, 25]);
    })

    it("Verify card order", () => {
      // verify 3 cards from each stack
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 0);
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 1);
      verifyKanbanStackCardOrder("AFRICAN EGG", 1, 2);

      verifyKanbanStackCardOrder("ACADEMY DINOSAUR", 2, 0);
      verifyKanbanStackCardOrder("AGENT TRUMAN", 2, 1);
      verifyKanbanStackCardOrder("ALASKA PHANTOM", 2, 2);

      verifyKanbanStackCardOrder("AIRPLANE SIERRA", 3, 0);
      verifyKanbanStackCardOrder("ALABAMA DEVIL", 3, 1);
      verifyKanbanStackCardOrder("ALTER VICTORY", 3, 2);

      verifyKanbanStackCardOrder("AIRPORT POLLOCK", 4, 0);
      verifyKanbanStackCardOrder("ALONE TRIP", 4, 1);
      verifyKanbanStackCardOrder("AMELIE HELLFIGHTERS", 4, 2);

      verifyKanbanStackCardOrder("ADAPTATION HOLES", 5, 0);
      verifyKanbanStackCardOrder("ALADDIN CALENDAR", 5, 1);
      verifyKanbanStackCardOrder("ALICE FANTASIA", 5, 2);
    })

    it.skip("Verify inter-stack drag and drop", () => {
      dragAndDropKanbanCard("ACE GOLDFINGER", "ACADEMY DINOSAUR");
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 0);
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 2, 0);
      verifyKanbanStackCardOrder("ACADEMY DINOSAUR", 2, 1);

      dragAndDropKanbanCard("ACE GOLDFINGER", "AFFAIR PREJUDICE");
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 0);
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 1);
      verifyKanbanStackCardOrder("ACADEMY DINOSAUR", 2, 0);
    })

    it.skip("Verify intra-stack drag and drop", () => {
      dragAndDropKanbanCard("ACE GOLDFINGER", "AFFAIR PREJUDICE");
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 0);
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 1);

      dragAndDropKanbanCard("ACE GOLDFINGER", "AFFAIR PREJUDICE");
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 0);
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 1);
    })

    it("Verify stack drag drop", () => {
      verifyKanbanStackOrder(["uncategorized", "G", "PG", "PG-13", "R", "NC-17"]);
      dragAndDropKanbanStack("PG-13", "R");
      verifyKanbanStackOrder(["uncategorized", "G", "PG", "R", "PG-13", "NC-17"]);
      dragAndDropKanbanStack("PG-13", "R");
      verifyKanbanStackOrder(["uncategorized", "G", "PG", "PG-13", "R", "NC-17"]);
    })

    it("Verify Sort", () => {
      mainPage.sortField("Title", "Z → A");
      verifyKanbanStackCardOrder("YOUNG LANGUAGE", 1, 0);
      verifyKanbanStackCardOrder("WEST LION", 1, 1);
      verifyKanbanStackCardOrder("WORST BANGER", 2, 0);
      verifyKanbanStackCardOrder("WORDS HUNTER", 2, 1);

      mainPage.clearSort();
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 0);
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 1);
      verifyKanbanStackCardOrder("ACADEMY DINOSAUR", 2, 0);
      verifyKanbanStackCardOrder("AGENT TRUMAN", 2, 1);
    })

    it("Verify Filter", () => {
      mainPage.filterField("Title", "is like", "BA");
      verifyKanbanStackCardOrder("BAKED CLEOPATRA", 1, 0);
      verifyKanbanStackCardOrder("BALLROOM MOCKINGBIRD", 1, 1);
      verifyKanbanStackCardOrder("ARIZONA BANG", 2, 0);
      verifyKanbanStackCardOrder("EGYPT TENENBAUMS", 2, 1);

      mainPage.filterReset();
      verifyKanbanStackCardOrder("ACE GOLDFINGER", 1, 0);
      verifyKanbanStackCardOrder("AFFAIR PREJUDICE", 1, 1);
      verifyKanbanStackCardOrder("ACADEMY DINOSAUR", 2, 0);
      verifyKanbanStackCardOrder("AGENT TRUMAN", 2, 1);
    })

    // it("Stack context menu- rename stack", () => {
    //   verifyKanbanStackCount(6);
    //   cy.get('.nc-kanban-stack-head').eq(1).find('.ant-dropdown-trigger').click();
    //   cy.getActiveMenu('.nc-dropdown-kanban-stack-context-menu').should('be.visible');
    //   cy.getActiveMenu('.nc-dropdown-kanban-stack-context-menu')
    //     .find('.ant-dropdown-menu-item')
    //     .contains('Rename Stack')
    //     .click();
    // })

    it("Stack context menu- delete stack", () => {

    })

    it("Stack context menu- collapse stack", () => {

    })

    it("Copy view", () => {
      mainPage.sortField("Title", "Z → A");
      mainPage.filterField("Title", "is like", "BA");

      cy.viewCopy(1);

      // verify copied view
      cy.get('.nc-kanban-stacked-by-menu-btn')
        .contains(`Stacked By Rating`)
        .should('exist');
      verifyKanbanStackCount(6);
      verifyKanbanStackOrder(["uncategorized", "G", "PG", "PG-13", "R", "NC-17"]);
      verifyKanbanStackFooterCount(["0", "4", "5", "8", "6", "6"]);
      verifyKanbanStackCardOrder("BAREFOOT MANCHURIAN", 1, 0);
      verifyKanbanStackCardOrder("WORST BANGER", 2, 0);

      cy.viewDelete(1);
    })

    it("Delete Kanban view",  () => {
      cy.viewDelete(0);
      cy.closeTableTab("Film");
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
