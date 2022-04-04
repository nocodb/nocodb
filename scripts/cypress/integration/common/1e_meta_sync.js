import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";
import {
    getCurrentMode,
    getProjectString,
    isTestSuiteActive,
    isXcdb,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    let projPrefix = `sakila.`;
    let dbCmd = `queryDb`;
    let tblDisplayPrefix = ``;

    describe(`${apiType.toUpperCase()} api - Meta Sync`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            if (isXcdb()) {
                cy.log(getProjectString());
                projPrefix = `${getProjectString()}`;
                dbCmd = `sqliteExec`;
                tblDisplayPrefix = `${getProjectString()}`;
            }
            mainPage.tabReset();
            mainPage.openMetaTab();
        });

        after(() => {
            mainPage.closeMetaTab();
        });

        it(`Create table`, () => {
            // Create Table
            cy.task(
                dbCmd,
                `CREATE TABLE ${projPrefix}table1 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`
            );
            cy.task(
                dbCmd,
                `CREATE TABLE ${projPrefix}table2 (id INT NOT NULL, col1 INT NULL, PRIMARY KEY (id))`
            );
            mainPage.metaSyncValidate(`${tblDisplayPrefix}table1`, "New table");
        });

        it(`Add relation`, () => {
            // working with relations in sqlite requires table to be deleted & recreated
            //
            if (!isXcdb()) {
                // Add relation (FK)
                cy.task(
                    dbCmd,
                    `ALTER TABLE ${projPrefix}table1 ADD INDEX fk1_idx (col1 ASC) VISIBLE`
                );
                cy.task(
                    dbCmd,
                    `ALTER TABLE ${projPrefix}table1 ADD CONSTRAINT fk1 FOREIGN KEY (col1) REFERENCES ${projPrefix}table2 (id) ON DELETE NO ACTION ON UPDATE NO ACTION`
                );
                mainPage.metaSyncValidate(
                    `${tblDisplayPrefix}table1`,
                    "New relation added"
                );
            }
        });

        it(`Remove relation`, () => {
            // working with relations in sqlite requires table to be deleted & recreated
            //
            if (!isXcdb()) {
                // Remove relation (FK)
                cy.task(
                    dbCmd,
                    `ALTER TABLE ${projPrefix}table1 DROP FOREIGN KEY fk1`
                );
                cy.task(
                    dbCmd,
                    `ALTER TABLE ${projPrefix}table1 DROP INDEX fk1_idx`
                );
                mainPage.metaSyncValidate(
                    `${tblDisplayPrefix}table1`,
                    "Relation removed"
                );
            }
        });

        it(`Add column`, () => {
            // Add Column
            let queryString = `ALTER TABLE ${projPrefix}table1 ADD COLUMN newCol VARCHAR(45) NULL AFTER id`;
            if (isXcdb())
                queryString = `ALTER TABLE ${projPrefix}table1 ADD COLUMN newCol TEXT NULL`;
            cy.task(dbCmd, queryString);
            mainPage.metaSyncValidate(
                `${tblDisplayPrefix}table1`,
                "New column(newCol)"
            );
        });

        it(`Rename column`, () => {
            // Rename Column
            let queryString = `ALTER TABLE ${projPrefix}table1 CHANGE COLUMN newCol newColName VARCHAR(45) NULL DEFAULT NULL`;
            if (isXcdb())
                queryString = `ALTER TABLE ${projPrefix}table1 RENAME COLUMN newCol TO newColName`;
            cy.task(dbCmd, queryString);
            mainPage.metaSyncValidate(
                `${tblDisplayPrefix}table1`,
                "New column(newColName), Column removed(newCol)"
            );
        });

        it(`Delete column`, () => {
            // Remove Column
            // to be fixed for SQLITE
            if (!isXcdb()) {
                cy.task(
                    dbCmd,
                    `ALTER TABLE ${projPrefix}table1 DROP COLUMN newColName`
                );
                mainPage.metaSyncValidate(
                    `${tblDisplayPrefix}table1`,
                    "Column removed(newColName)"
                );
            }
        });

        it(`Delete table`, () => {
            // DROP TABLE
            cy.task(dbCmd, `DROP TABLE ${projPrefix}table1`);
            cy.task(dbCmd, `DROP TABLE ${projPrefix}table2`);
            mainPage.metaSyncValidate(
                `${tblDisplayPrefix}table1`,
                "Table removed"
            );
        });

        it(`Hide, Filter, Sort`, () => {
            cy.task(
                dbCmd,
                `CREATE TABLE ${projPrefix}table1 (id INT NOT NULL, col1 INT NULL, col2 INT NULL, col3 INT NULL, col4 INT NULL, PRIMARY KEY (id))`
            );
            cy.task(
                dbCmd,
                `INSERT INTO ${projPrefix}table1 (id, col1, col2, col3, col4) VALUES (1,1,1,1,1), (2,2,2,2,2), (3,3,3,3,3), (4,4,4,4,4), (5,5,5,5,5), (6,6,6,6,6), (7,7,7,7,7), (8,8,8,8,8), (9,9,9,9,9);`
            );
            mainPage.metaSyncValidate(`${tblDisplayPrefix}table1`, "New table");
            mainPage.closeMetaTab();

            cy.openTableTab("Table1", 9);
            mainPage.hideField("Col1");
            mainPage.sortField("Col1", "Z -> A");
            mainPage.filterField(`Col1`, ">=", "5");
            cy.get(".nc-grid-row").should("have.length", 5);
            cy.closeTableTab("Table1");
        });

        it(`Verify`, () => {
            mainPage.openMetaTab();
            // Rename Column
            let queryString = `ALTER TABLE ${projPrefix}table1 CHANGE COLUMN col1 newCol INT NULL DEFAULT NULL`;
            if (isXcdb())
                queryString = `ALTER TABLE ${projPrefix}table1 RENAME COLUMN col1 TO newCol`;
            cy.task(dbCmd, queryString);
            mainPage.metaSyncValidate(
                `${tblDisplayPrefix}table1`,
                "New column(newCol), Column removed(col1)"
            );
            mainPage.closeMetaTab();

            cy.openTableTab("Table1", 9);
            cy.deleteTable("Table1", dbType);
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
