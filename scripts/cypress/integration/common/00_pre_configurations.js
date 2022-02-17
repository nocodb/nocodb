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
        `ALTER TABLE "actor" RENAME TO "nc_${projId}__actor"`,
        `ALTER TABLE "address" RENAME TO "nc_${projId}__address"`,
        `ALTER TABLE "category" RENAME TO "nc_${projId}__category"`,
        `ALTER TABLE "city" RENAME TO "nc_${projId}__city"`,
        `ALTER TABLE "country" RENAME TO "nc_${projId}__country"`,
        `ALTER TABLE "customer" RENAME TO "nc_${projId}__customer"`,
        `ALTER TABLE "film" RENAME TO "nc_${projId}__film"`,
        `ALTER TABLE "film_actor" RENAME TO "nc_${projId}__film_actor"`,
        `ALTER TABLE "film_category" RENAME TO "nc_${projId}__film_category"`,
        `ALTER TABLE "film_text" RENAME TO "nc_${projId}__film_text"`,
        `ALTER TABLE "inventory" RENAME TO "nc_${projId}__inventory"`,
        `ALTER TABLE "language" RENAME TO "nc_${projId}__language"`,
        `ALTER TABLE "payment" RENAME TO "nc_${projId}__payment"`,
        `ALTER TABLE "rental" RENAME TO "nc_${projId}__rental"`,
        `ALTER TABLE "staff" RENAME TO "nc_${projId}__staff"`,
        `ALTER TABLE "store" RENAME TO "nc_${projId}__store"`,
        `CREATE VIEW nc_${projId}__customer_list
        AS
        SELECT cu.customer_id AS ID,
            cu.first_name||' '||cu.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "nc_${projId}__city".city AS city,
            "nc_${projId}__country".country AS country,
            case when cu.active=1 then 'active' else '' end AS notes,
            cu.store_id AS SID
        FROM "nc_${projId}__customer" AS cu JOIN "nc_${projId}__address" AS a ON cu.address_id = a.address_id JOIN "nc_${projId}__city" ON a.city_id = "nc_${projId}__city".city_id
        JOIN "nc_${projId}__country" ON "nc_${projId}__city".country_id = "nc_${projId}__country".country_id`,
        `CREATE VIEW nc_${projId}__film_list
        AS
        SELECT "nc_${projId}__film".film_id AS FID,
            "nc_${projId}__film".title AS title,
            "nc_${projId}__film".description AS description,
            "nc_${projId}__category".name AS category,
            "nc_${projId}__film".rental_rate AS price,
            "nc_${projId}__film".length AS length,
            "nc_${projId}__film".rating AS rating,
            "nc_${projId}__actor".first_name||' '||"nc_${projId}__actor".last_name AS actors
        FROM "nc_${projId}__category" LEFT JOIN "nc_${projId}__film_category" ON "nc_${projId}__category".category_id = "nc_${projId}__film_category".category_id LEFT JOIN "nc_${projId}__film" ON "nc_${projId}__Film_category".film_id = "nc_${projId}__film".film_id
        JOIN "nc_${projId}__film_actor" ON "nc_${projId}__film".film_id = "nc_${projId}__film_actor".film_id
        JOIN "nc_${projId}__actor" ON "nc_${projId}__film_actor".actor_id = "nc_${projId}__actor".actor_id`,
        `CREATE VIEW nc_${projId}__sales_by_film_category
        AS
        SELECT
            c.name AS category
            , SUM(p.amount) AS total_sales
        FROM "nc_${projId}__payment" AS p
        INNER JOIN "nc_${projId}__rental" AS r ON p.rental_id = r.rental_id
        INNER JOIN "nc_${projId}__inventory" AS i ON r.inventory_id = i.inventory_id
        INNER JOIN "nc_${projId}__film" AS f ON i.film_id = f.film_id
        INNER JOIN "nc_${projId}__film_category" AS fc ON f.film_id = fc.film_id
        INNER JOIN "nc_${projId}__category" AS c ON fc.category_id = c.category_id
        GROUP BY c.name`,
        `CREATE VIEW nc_${projId}__sales_by_store
        AS
        SELECT
            s.store_id
            ,c.city||','||cy.country AS store
            ,m.first_name||' '||m.last_name AS manager
            ,SUM(p.amount) AS total_sales
        FROM "nc_${projId}__payment" AS p
        INNER JOIN "nc_${projId}__rental" AS r ON p.rental_id = r.rental_id
        INNER JOIN "nc_${projId}__inventory" AS i ON r.inventory_id = i.inventory_id
        INNER JOIN "nc_${projId}__store" AS s ON i.store_id = s.store_id
        INNER JOIN "nc_${projId}__address" AS a ON s.address_id = a.address_id
        INNER JOIN "nc_${projId}__city" AS c ON a.city_id = c.city_id
        INNER JOIN "nc_${projId}__country" AS cy ON c.country_id = cy.country_id
        INNER JOIN "nc_${projId}__staff" AS m ON s.manager_staff_id = m.staff_id
        GROUP BY  
        s.store_id
        , c.city||','||cy.country
        , m.first_name||' '||m.last_name`,
        `CREATE VIEW nc_${projId}__staff_list
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "nc_${projId}__city".city AS city,
            "nc_${projId}__country".country AS country,
            s.store_id AS SID
        FROM "nc_${projId}__staff" AS s JOIN "nc_${projId}__address" AS a ON s.address_id = a.address_id JOIN "nc_${projId}__city" ON a.city_id = "nc_${projId}__city".city_id
            JOIN "nc_${projId}__country" ON "nc_${projId}__city".country_id = "nc_${projId}__country".country_id`,
        // below two are dummy entries to ensure view record exists
        `CREATE VIEW nc_${projId}__actor_info
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "nc_${projId}__city".city AS city,
            "nc_${projId}__country".country AS country,
            s.store_id AS SID
        FROM "nc_${projId}__staff" AS s JOIN "nc_${projId}__address" AS a ON s.address_id = a.address_id JOIN "nc_${projId}__city" ON a.city_id = "nc_${projId}__city".city_id
            JOIN "nc_${projId}__country" ON "nc_${projId}__city".country_id = "nc_${projId}__country".country_id`,
        `CREATE VIEW nc_${projId}__nice_but_slower_film_list
        AS
        SELECT s.staff_id AS ID,
            s.first_name||' '||s.last_name AS name,
            a.address AS address,
            a.postal_code AS zip_code,
            a.phone AS phone,
            "nc_${projId}__city".city AS city,
            "nc_${projId}__country".country AS country,
            s.store_id AS SID
        FROM "nc_${projId}__staff" AS s JOIN "nc_${projId}__address" AS a ON s.address_id = a.address_id JOIN "nc_${projId}__city" ON a.city_id = "nc_${projId}__city".city_id
            JOIN "nc_${projId}__country" ON "nc_${projId}__city".country_id = "nc_${projId}__country".country_id`,
        // `CREATE VIEW nc_${projId}__actor_info
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
        //                 ((nc_${projId}__film f
        //                 JOIN nc_${projId}__film_category fc ON ((f.film_id = fc.film_id)))
        //                 JOIN nc_${projId}__film_actor fa ON ((f.film_id = fa.film_id)))
        //             WHERE
        //                 ((fc.category_id = c.category_id)
        //                     AND (fa.actor_id = a.actor_id))))
        //         ORDER BY c.name ASC
        //         SEPARATOR '; ') AS nc_${projId}__film_info
        // FROM
        //     (((actor a
        //     LEFT JOIN nc_${projId}__film_actor fa ON ((a.actor_id = fa.actor_id)))
        //     LEFT JOIN nc_${projId}__film_category fc ON ((fa.film_id = fc.film_id)))
        //     LEFT JOIN nc_${projId}__category c ON ((fc.category_id = c.category_id)))
        // GROUP BY a.actor_id , a.first_name , a.last_name`,
    ];
    return sqliteQuery;
}

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;
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
                                cy.log(url, projId);
                                setProjectString(projId);

                                let query = prepareSqliteQuery(projId);
                                for (let i = 0; i < query.length; i++) {
                                    cy.task("sqliteExec", query[i]);
                                    cy.wait(1000);
                                }
                            })
                            .then(() => {
                                cy.log(projId);
                                mainPage.openMetaTab();
                                mainPage.metaSyncValidate(
                                    `nc_${projId}__actor`,
                                    `New table, New relation added`
                                );
                                mainPage.closeMetaTab();
                            });
                    }

                    // create requested project
                    // projectsPage.createProject(proj.basic, proj.config)
                });
            });
        };

        // if (isTestSuiteActive('rest', true)) createProject(staticProjects.sampleREST)
        // if (isTestSuiteActive('graphql', true)) createProject(staticProjects.sampleGQL)
        // if (isTestSuiteActive('rest', false)) createProject(staticProjects.externalREST)
        // if (isTestSuiteActive('graphql', false)) createProject(staticProjects.externalGQL)

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
