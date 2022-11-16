import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  // if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Login & Open project`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      // loginPage.loginAndOpenProject(apiType, dbType);
      // open a table to work on views
      // cy.openTableTab('City');
    });

    it(``, () => {
      cy.log("Test-1");

      let projId = "";
      let query = `SELECT prefix from nc_projects_v2 where title = "sampleREST"; `;
      cy.task("sqliteExecReturnValue", query)
        .then((resolve) => {
          cy.log(resolve);
          projId = resolve.prefix.split("_")[1];
          cy.log(projId);
        })
        .then(() => {
          let query = `ALTER TABLE "actor" RENAME TO "${projId}actor"`;
          cy.task("sqliteExec", query);
        });
    });
  });
};

// genTest("rest", "mysql");
