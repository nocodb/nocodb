import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (type, xcdb) => {
  if (!isTestSuiteActive(type, xcdb)) return;

  describe(`${type.toUpperCase()} api - Meta Sync`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      // loginPage.loginAndOpenProject(type);
    });

    function openMetaTab() {
      // open Project metadata tab
      //
      mainPage.navigationDraw(mainPage.PROJ_METADATA).click();
      cy.get(".nc-meta-mgmt-metadata-tab")
        .should("exist")
        .click({ force: true });
      // kludge, at times test failed to open tab on click
      cy.get(".nc-meta-mgmt-metadata-tab")
        .should("exist")
        .click({ force: true });
    }

    function closeMetaTab() {
      // user href link to find meta mgmt tab
      cy.get('[href="#disableOrEnableModel||||Meta Management"]')
        .find("button.mdi-close")
        .click({ force: true });
      // refresh
      cy.refreshTableTab();
    }

    function metaSyncValidate(tbl, msg) {
      cy.get(".nc-btn-metasync-reload").should("exist").click({ force: true });
      cy.get(`.nc-metasync-row-${tbl}`).contains(msg).should("exist");
      cy.get(".nc-btn-metasync-sync-now")
        .should("exist")
        .click({ force: true });
      cy.toastWait(`Table metadata recreated successfully`);
      // cy.get(`.nc-metasync-row-${tbl}`).should("exist");
    }

    before(() => {
      openMetaTab();
    });

    after(() => {
      closeMetaTab();
    });

    it(`Create table`, () => {
      // Create Table
      cy.task(
        "queryDb",
        `CREATE TABLE sakila.table1 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`
      );
      cy.task(
        "queryDb",
        `CREATE TABLE sakila.table2 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`
      );
      metaSyncValidate("table1", "New table");
      // metaSyncValidate("table2", "Table added");
    });

    it(`Add relation`, () => {
      // Add relation (FK)
      cy.task(
        "queryDb",
        `ALTER TABLE sakila.table1 ADD INDEX fk1_idx (col1 ASC) VISIBLE`
      );
      cy.task(
        "queryDb",
        `ALTER TABLE sakila.table1 ADD CONSTRAINT fk1 FOREIGN KEY (col1) REFERENCES sakila.table2 (id) ON DELETE NO ACTION ON UPDATE NO ACTION`
      );
      // fix me
      metaSyncValidate("table1", "New relation added");
    });

    it(`Remove relation`, () => {
      // Remove relation (FK)
      cy.task("queryDb", `ALTER TABLE sakila.table1 DROP FOREIGN KEY fk1`);
      cy.task("queryDb", `ALTER TABLE sakila.table1 DROP INDEX fk1_idx`);
      // fix me
      metaSyncValidate("table1", "Relation removed");
    });

    it(`Add column`, () => {
      // Add Column
      cy.task(
        "queryDb",
        `ALTER TABLE sakila.table1 ADD COLUMN newCol VARCHAR(45) NULL AFTER id`
      );
      // fix me
      metaSyncValidate("table1", "New column(newCol)");
    });

    it(`Rename column`, () => {
      // Rename Column
      cy.task(
        "queryDb",
        `ALTER TABLE sakila.table1 CHANGE COLUMN newCol newColName VARCHAR(45) NULL DEFAULT NULL`
      );
      // fix me
      metaSyncValidate(
        "table1",
        "New column(newColName), Column removed(newCol)"
      );
    });

    it(`Delete column`, () => {
      // Remove Column
      cy.task("queryDb", `ALTER TABLE sakila.table1 DROP COLUMN newColName`);
      // fix me
      metaSyncValidate("table1", "Column removed(newColName)");
    });

    it(`Delete table`, () => {
      // DROP TABLE
      cy.task("queryDb", `DROP TABLE sakila.table1`);
      cy.task("queryDb", `DROP TABLE sakila.table2`);
      metaSyncValidate("table1", "Table removed");
      // metaSyncValidate("table2", "out of sync");
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
