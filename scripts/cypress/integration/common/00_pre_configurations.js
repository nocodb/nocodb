// Cypress test suite: project pre-configurations
//

import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";
import {
  staticProjects,
  roles,
  isTestSuiteActive,
  getCurrentMode,
  isXcdb,
  setProjectString,
} from "../../support/page_objects/projectConstants";

function prepareSqliteQuery(projId) {
  let sqliteQuery = [
    `ALTER TABLE "actor" RENAME TO "${projId}actor"`,
    `ALTER TABLE "address" RENAME TO "${projId}address"`,
    `ALTER TABLE "category" RENAME TO "${projId}category"`,
    `ALTER TABLE "city" RENAME TO "${projId}city"`,
    `ALTER TABLE "country" RENAME TO "${projId}country"`,
    `ALTER TABLE "customer" RENAME TO "${projId}customer"`,
    `ALTER TABLE "film" RENAME TO "${projId}film"`,
    `ALTER TABLE "film_actor" RENAME TO "${projId}film_actor"`,
    `ALTER TABLE "film_category" RENAME TO "${projId}film_category"`,
    `ALTER TABLE "film_text" RENAME TO "${projId}film_text"`,
    `ALTER TABLE "inventory" RENAME TO "${projId}inventory"`,
    `ALTER TABLE "language" RENAME TO "${projId}language"`,
    `ALTER TABLE "payment" RENAME TO "${projId}payment"`,
    `ALTER TABLE "rental" RENAME TO "${projId}rental"`,
    `ALTER TABLE "staff" RENAME TO "${projId}staff"`,
    `ALTER TABLE "store" RENAME TO "${projId}store"`,
    `CREATE VIEW ${projId}customer_list
        AS
        SELECT cu.customer_id AS ID,
            cu.first_name||' '||cu.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "${projId}city".city AS city,
            "${projId}country".country AS country,
            case when cu.active=1 then 'active' else '' end AS notes,
            cu.store_id AS SID
        FROM "${projId}customer" AS cu JOIN "${projId}address" AS a ON cu.address_id = a.address_id JOIN "${projId}city" ON a.city_id = "${projId}city".city_id
        JOIN "${projId}country" ON "${projId}city".country_id = "${projId}country".country_id`,
    `CREATE VIEW ${projId}film_list
        AS
        SELECT "${projId}film".film_id AS FID,
            "${projId}film".title AS title,
            "${projId}film".description AS description,
            "${projId}category".name AS category,
            "${projId}film".rental_rate AS price,
            "${projId}film".length AS length,
            "${projId}film".rating AS rating,
            "${projId}actor".first_name||' '||"${projId}actor".last_name AS actors
        FROM "${projId}category" LEFT JOIN "${projId}film_category" ON "${projId}category".category_id = "${projId}film_category".category_id LEFT JOIN "${projId}film" ON "${projId}Film_category".film_id = "${projId}film".film_id
        JOIN "${projId}film_actor" ON "${projId}film".film_id = "${projId}film_actor".film_id
        JOIN "${projId}actor" ON "${projId}film_actor".actor_id = "${projId}actor".actor_id`,
    `CREATE VIEW ${projId}sales_by_film_category
        AS
        SELECT
            c.name AS category
            , SUM(p.amount) AS total_sales
        FROM "${projId}payment" AS p
        INNER JOIN "${projId}rental" AS r ON p.rental_id = r.rental_id
        INNER JOIN "${projId}inventory" AS i ON r.inventory_id = i.inventory_id
        INNER JOIN "${projId}film" AS f ON i.film_id = f.film_id
        INNER JOIN "${projId}film_category" AS fc ON f.film_id = fc.film_id
        INNER JOIN "${projId}category" AS c ON fc.category_id = c.category_id
        GROUP BY c.name`,
    `CREATE VIEW ${projId}sales_by_store
        AS
        SELECT
            s.store_id
            ,c.city||','||cy.country AS store
            ,m.first_name||' '||m.last_name AS manager
            ,SUM(p.amount) AS total_sales
        FROM "${projId}payment" AS p
        INNER JOIN "${projId}rental" AS r ON p.rental_id = r.rental_id
        INNER JOIN "${projId}inventory" AS i ON r.inventory_id = i.inventory_id
        INNER JOIN "${projId}store" AS s ON i.store_id = s.store_id
        INNER JOIN "${projId}address" AS a ON s.address_id = a.address_id
        INNER JOIN "${projId}city" AS c ON a.city_id = c.city_id
        INNER JOIN "${projId}country" AS cy ON c.country_id = cy.country_id
        INNER JOIN "${projId}staff" AS m ON s.manager_staff_id = m.staff_id
        GROUP BY
        s.store_id
        , c.city||','||cy.country
        , m.first_name||' '||m.last_name`,
    `CREATE VIEW ${projId}staff_list
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "${projId}city".city AS city,
            "${projId}country".country AS country,
            s.store_id AS SID
        FROM "${projId}staff" AS s JOIN "${projId}address" AS a ON s.address_id = a.address_id JOIN "${projId}city" ON a.city_id = "${projId}city".city_id
            JOIN "${projId}country" ON "${projId}city".country_id = "${projId}country".country_id`,
    // below two are dummy entries to ensure view record exists
    `CREATE VIEW ${projId}actor_info
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "${projId}city".city AS city,
            "${projId}country".country AS country,
            s.store_id AS SID
        FROM "${projId}staff" AS s JOIN "${projId}address" AS a ON s.address_id = a.address_id JOIN "${projId}city" ON a.city_id = "${projId}city".city_id
            JOIN "${projId}country" ON "${projId}city".country_id = "${projId}country".country_id`,
    `CREATE VIEW ${projId}nice_but_slower_film_list
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "${projId}city".city AS city,
            "${projId}country".country AS country,
            s.store_id AS SID
        FROM "${projId}staff" AS s JOIN "${projId}address" AS a ON s.address_id = a.address_id JOIN "${projId}city" ON a.city_id = "${projId}city".city_id
            JOIN "${projId}country" ON "${projId}city".country_id = "${projId}country".country_id`,
    // `CREATE VIEW ${projId}actor_info
    //     AS
    //     SELECT
    //       a.actor_id AS actor_id,
    //       a.first_name AS first_name,
    //       a.last_name AS last_name,
    //       GROUP_CONCAT(DISTINCT CONCAT(c.name,
    //         ': ',
    //         (SELECT
    //                 GROUP_CONCAT(f.title
    //                         ORDER BY f.title ASC
    //                         SEPARATOR ', ')
    //             FROM
    //                 ((${projId}film f
    //                 JOIN ${projId}film_category fc ON ((f.film_id = fc.film_id)))
    //                 JOIN ${projId}film_actor fa ON ((f.film_id = fa.film_id)))
    //             WHERE
    //                 ((fc.category_id = c.category_id)
    //                     AND (fa.actor_id = a.actor_id))))
    //         ORDER BY c.name ASC
    //         SEPARATOR '; ') AS ${projId}film_info
    // FROM
    //     (((actor a
    //     LEFT JOIN ${projId}film_actor fa ON ((a.actor_id = fa.actor_id)))
    //     LEFT JOIN ${projId}film_category fc ON ((fa.film_id = fc.film_id)))
    //     LEFT JOIN ${projId}category c ON ((fc.category_id = c.category_id)))
    // GROUP BY a.actor_id , a.first_name , a.last_name`,
  ];
  return sqliteQuery;
}

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Project pre-configurations`, () => {
    before(() => {
      cy.fileHook();
    });

    it("Admin SignUp", () => {
      cy.task("log", "This will be output to the terminal");
      loginPage.signUp(roles.owner.credentials);
    });

    function cy_createProjectBlock(proj, apiType, dbType) {
      // click home button
      cy.get(".nc-noco-brand-icon").click();
      cy.get(".ant-table-content").then((obj) => {
        // if project already created, open
        // else, create a new one
        if (true == obj[0].innerHTML.includes(proj.basic.name)) {
          projectsPage.openProject(proj.basic.name);
          let projId;
          if (dbType === "xcdb") {
            let query = `SELECT prefix from nc_projects_v2 where title = "sampleREST"; `;
            cy.task("sqliteExecReturnValue", query).then((resolve) => {
              cy.log(resolve);
              projId = resolve.prefix;
              setProjectString(projId);
              cy.log(projId);
            });
          }
        } else {
          projectsPage.createProject(proj.basic, proj.config);
          if (dbType === "xcdb") {
            // store base URL- to re-visit and delete form view later
            let projId;
            cy.url()
              .then((url) => {
                // project prefix code can include "_"
                // projId = url.split("_")[1].split("?")[0];
                let startIdx = url.indexOf("_");
                let endIdx = url.indexOf("?");
                projId = url.slice(startIdx + 1, endIdx);

                let query = `SELECT prefix from nc_projects_v2 where title = "sampleREST"; `;
                cy.task("sqliteExecReturnValue", query)
                  .then((resolve) => {
                    cy.log(resolve);
                    projId = resolve.prefix;
                    cy.log(projId);
                    setProjectString(projId);
                  })
                  .then(() => {
                    let query = prepareSqliteQuery(projId);
                    for (let i = 0; i < query.length; i++) {
                      cy.task("sqliteExec", query[i]);
                      cy.wait(1000);
                    }
                  });
              })
              .then(() => {
                cy.log(projId);
                mainPage.openMetaTab();
                mainPage.metaSyncValidate(
                  `${projId}actor`,
                  `New table, New relation added`
                );
                mainPage.closeMetaTab();
              });
          }
        }
      });
    }

    const createProject = (proj) => {
      it(`Create ${proj.basic.name} project`, () => {
        if (dbType === "postgres") {
          // wait for docker compose to start
          cy.task("pgExecTest", `SELECT 1+1`, { timeout: 120000 }).then(() =>
            cy_createProjectBlock(proj, apiType, dbType)
          );
        } else {
          cy_createProjectBlock(proj, apiType, dbType);
        }

        cy.wait(2000);
        // close team & auth tab
        cy.get("button.ant-tabs-tab-remove").should("be.visible").click();
        cy.get("button.ant-tabs-tab-remove").should("not.exist");

        // first instance of updating local storage information
        cy.saveLocalStorage();
      });
    };

    if ("xcdb" === dbType) {
      createProject(staticProjects.sampleREST);
    } else if (dbType === "mysql") {
      createProject(staticProjects.externalREST);
    } else if (dbType === "postgres") {
      createProject(staticProjects.pgExternalREST);
    }
  });
};

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
