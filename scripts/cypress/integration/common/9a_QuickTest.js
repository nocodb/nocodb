import { isTestSuiteActive, roles } from "../../support/page_objects/projectConstants";
import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

let records = {
  Name: "Movie-1",
  Notes: "Good",
  Status: "Todo",
  Tags: "Jan",
  Phone: "123123123",
  Email: "a@b.com",
  URL: "www.a.com",
  Number: "1",
  Value: "$1.00",
  Percent: "0.01",
  Duration: "60",
}

let records2 = {
  Done: true,
  Date: "2022-05-31",
  Rating: "1",
  Actor: ["Actor1", "Actor2"],
  "Status (from Actor)": ["Todo", "In progress"],
  RollUp: "128",
  Computation: "4.04"
}

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Webhook`, () => {
    before(() => {
      // cy.waitForSpinners();
      // cy.signinOrSignup(roles.owner.credentials);
      loginPage.signIn(roles.owner.credentials);
      projectsPage.openProject("sample")
    });

    after(() => {
    });

    it("Verify Data types", () => {
      cy.openTableTab("Film", 3)

      // normal cells
      for (let [key, value] of Object.entries(records)) {
        mainPage.getCell(key, 1).contains(value).should("exist");
      }

      // checkbox
      mainPage.getCell("Done", 1).find(".mdi-check-circle-outline").should(records2.Done?'exist':'not.exist')

      // date

      // rating
      mainPage.getCell("Rating", 1).find("button.mdi-star").should("have.length", records2.Rating)

      // ltar
      mainPage.getCell("Actor", 1).scrollIntoView();
      cy.get(':nth-child(1) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name').contains(records2.Actor[0]).should('exist')
      cy.get(':nth-child(1) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(2) > .v-chip__content > .name').contains(records2.Actor[1]).should('exist')
      // mainPage.getCell("Actor", 1).find(".nc-virtual-cell > .v-lazy > .d-100 > .chips").eq(0).contains("Actor1").should('exist')
      // mainPage.getCell("Actor", 1).find(".nc-virtual-cell > .v-lazy > .d-100 > .chips").eq(1).contains("Actor2").should('exist')

      // lookup
      mainPage.getCell("Status (from Actor)", 1).scrollIntoView();
      cy.get(':nth-child(1) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(1) > .v-chip__content > div > .set-item').contains(records2["Status (from Actor)"][0]).should('exist')
      cy.get(':nth-child(1) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(2) > .v-chip__content > div > .set-item').contains(records2["Status (from Actor)"][1]).should('exist')

      // rollup
      mainPage.getCell("RollUp", 1).scrollIntoView();
      // cy.get(':nth-child(1) > [data-col="RollUp"] > .nc-virtual-cell > .v-lazy > span').contains(records2.RollUp).should('exist')
      cy.get(`:nth-child(1) > [data-col="RollUp"] > .nc-virtual-cell`).contains(records2.RollUp).should('exist')

      // formula
      mainPage.getCell("Computation", 1).scrollIntoView();
      cy.get(`:nth-child(1) > [data-col="Computation"] > .nc-virtual-cell`).contains(records2.Computation).should('exist')


      cy.closeTableTab("Film")
    })

    it("Verify Views & Shared base", () => {
      cy.openTableTab("Film", 3)
    })

    it("Verify Webhooks", () => {
    })

    it("Verify Fields, Filter & Sort", () => {
    })
  })
}

genTest("rest", "xcdb")


/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
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

