import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
    isXcdb,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - FORMULA`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("City", 25);
        });

        after(() => {
            cy.closeTableTab("City");
        });

        // Given rowname & expected result for first 10 entries, validate
        // NOTE: Scroll issue with Cypress automation, to fix
        // validating partial data, row number 5 to 9
        //
        const rowValidation = (rowName, result) => {
            // scroll back
            cy.get(
                `tbody > :nth-child(1) > [data-col="City"]`
            ).scrollIntoView();

            // for (let i = 0; i < 10; i++)
            for (let i = 3; i < 6; i++)
                cy.get(`tbody > :nth-child(${i + 1}) > [data-col="${rowName}"]`)
                    .contains(result[i].toString())
                    .should("exist");
        };

        // Routine to create a new look up column
        //
        const addFormulaBasedColumn = (columnName, formula) => {
            // (+) icon at end of column header (to add a new column)
            // opens up a pop up window
            //
            cy.get(".new-column-header").click();

            // Column name
            cy.get(".nc-column-name-input input").clear().type(`${columnName}`);

            // Column data type: to be set to formula in this context
            cy.get(".nc-ui-dt-dropdown").click().type("Formula");

            cy.snipActiveMenu("Formula");

            cy.getActiveMenu().contains("Formula").click({ force: true });

            // Configure formula
            cy.get("label")
                .contains("Formula")
                .parent()
                .click()
                .type(formula)
                .click();

            // click on Save
            cy.get(".nc-col-create-or-edit-card")
                .contains("Save")
                .click({ force: true });

            cy.toastWait("Formula column saved successfully");

            // Verify if column exists.
            //
            cy.get(`th:contains(${columnName})`).should("exist");
        };

        // routine to delete column
        //
        const deleteColumnByName = (columnName) => {
            // verify if column exists before delete
            cy.get(`th:contains(${columnName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${columnName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // delete/ confirm on pop-up
            cy.get(".nc-column-delete").click();
            cy.getActiveModal().find("button:contains(Confirm)").click();

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${columnName})`).should("not.exist");
        };

        // routine to edit column
        //
        const editColumnByName = (oldName, newName, newFormula) => {
            // verify if column exists before delete
            cy.get(`th:contains(${oldName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${oldName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // edit/ save on pop-up
            cy.get(".nc-column-edit").click();
            cy.get(".nc-column-name-input input").clear().type(newName);

            cy.get("label")
                .contains("Formula")
                .parent()
                .find("input")
                .clear()
                .type(newFormula)
                .click();

            cy.get(".nc-col-create-or-edit-card")
                .contains("Save")
                .click({ force: true });

            cy.toastWait("Formula column updated successfully");

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${oldName})`).should("not.exist");
            cy.get(`th:contains(${newName})`).should("exist");
        };

        ///////////////////////////////////////////////////
        // Test case

        // On City table (from Sakila DB), first 10 entries recorded here for verification
        let cityId = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let countryId = [87, 82, 101, 60, 97, 31, 107, 44, 44, 50];
        let city = [
            "A corua (La Corua)",
            "Abha",
            "Abu Dhabi",
            "Acua",
            "Adana",
            "Addis Abeba",
            "Aden",
            "Adoni",
            "Ahmadnagar",
            "Akishima",
        ];

        // Temporary locally computed expected results
        let RESULT_STRING = [];
        let RESULT_MATH_0 = [];
        let RESULT_MATH_1 = [];
        let RESULT_MATH_2 = [];

        for (let i = 0; i < 10; i++) {
            // CONCAT, LOWER, UPPER, TRIM
            RESULT_STRING[i] = `${city[i].toUpperCase()}${city[
                i
            ].toLowerCase()}trimmed`;

            // ADD, AVG, LEN
            RESULT_MATH_0[i] =
                cityId[i] +
                countryId[i] +
                (cityId[i] + countryId[i]) / 2 +
                city[i].length;

            // CEILING, FLOOR, ROUND, MOD, MIN, MAX
            RESULT_MATH_1[i] =
                Math.ceil(1.4) +
                Math.floor(1.6) +
                Math.round(2.5) +
                (cityId[i] % 3) +
                Math.min(cityId[i], countryId[i]) +
                Math.max(cityId[i], countryId[i]);

            // LOG, EXP, POWER, SQRT
            // only integer verification being computed, hence trunc
            RESULT_MATH_2[i] = Math.trunc(
                Math.log(cityId[i]) +
                    Math.exp(cityId[i]) +
                    Math.pow(cityId[i], 3) +
                    Math.sqrt(countryId[i])
            );
        }

        it("Formula: ADD, AVG, LEN", () => {
            addFormulaBasedColumn(
                "NC_MATH_0",
                "ADD(CityId, CountryId) + AVG(CityId, CountryId) + LEN(City)"
            );
            rowValidation("NC_MATH_0", RESULT_MATH_0);
        });

        it("Formula: CONCAT, LOWER, UPPER, TRIM", () => {
            editColumnByName(
                "NC_MATH_0",
                "NC_STR_1",
                `CONCAT(UPPER(City), LOWER(City), TRIM('    trimmed    '))`
            );
            rowValidation("NC_STR_1", RESULT_STRING);
        });

        it("Formula: CEILING, FLOOR, ROUND, MOD, MIN, MAX", () => {
            editColumnByName(
                "NC_STR_1",
                "NC_MATH_1",
                `CEILING(1.4) + FLOOR(1.6) + ROUND(2.5) + MOD(CityId, 3) + MIN(CityId, CountryId) + MAX(CityId, CountryId)`
            );
            rowValidation("NC_MATH_1", RESULT_MATH_1);
        });

        it("Formula: LOG, EXP, POWER, SQRT", () => {
            if (!isXcdb()) {
                // SQLITE doesnt support LOG, EXP, POWER SQRT construct
                editColumnByName(
                    "NC_MATH_1",
                    "NC_MATH_2",
                    `LOG(CityId) + EXP(CityId) + POWER(CityId, 3) + SQRT(CountryId)`
                );
                rowValidation("NC_MATH_2", RESULT_MATH_2);
            }
        });

        it("Formula: NOW, EDIT & Delete column", () => {
            if (!isXcdb()) editColumnByName("NC_MATH_2", "NC_NOW", `NOW()`);
            else editColumnByName("NC_MATH_1", "NC_NOW", `NOW()`);
            deleteColumnByName("NC_NOW");
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
