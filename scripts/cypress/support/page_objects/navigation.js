import { roles, staticProjects, defaultDbParams } from "./projectConstants";

///////////////////////////////////////////////////////////
// Sign in/ Sign up page

// list of hard-wired URL that can be used by nocodb
// suffix to baseUrl needs to be defined here
//
const urlPool = {
  ncUrlBase: "/",
  ncUrlSignUp: "#/signup",
  ncUrlSignIn: "#/signin",
};

export class _loginPage {
  // prefix: baseUrl
  go(urlKey) {
    cy.visit(urlKey);
  }

  // visit SignIn URL, enter credentials passed as parameters
  //
  signIn(userCredentials) {
    this.go(urlPool.ncUrlBase);

    cy.get('input[type="text"]', { timeout: 20000 }).type(
      userCredentials.username
    );
    cy.get('input[type="password"]').type(userCredentials.password);
    cy.get('button:contains("SIGN IN")').click();

    this.waitProjectPageLoad();
  }

  // visit SignUp URL, enter credentials passed as parameters
  //
  signUp(userCredentials) {
    this.go(urlPool.ncUrlSignUp);

    cy.get('input[type="text"]', { timeout: 20000 }).type(
      userCredentials.username
    );
    cy.get('input[type="password"]').type(userCredentials.password);
    cy.get('button:contains("SIGN UP")').click();

    this.waitProjectPageLoad();
  }

  // logout signed up user
  //
  signOut() {
    cy.get(".nc-user-menu").click();
    cy.get(".nc-user-menu-signout").click();

    this.waitLoginPageLoad();
  }

  // delay/ wait utility routines
  //
  waitProjectPageLoad() {
    cy.get(".nc-new-project-menu").should("exist");
  }

  waitLoginPageLoad() {
    cy.get(".nc-form-signin").should("exist");
  }

  // standard pre-project activity
  //
  loginAndOpenProject(apiType, dbType) {
    loginPage.signIn(roles.owner.credentials);
    projectsPage.openConfiguredProject(apiType, dbType);
    // if (dbType === "mysql") {
    //     projectsPage.openProject(staticProjects.externalREST.basic.name);
    // } else if (dbType === "xcdb") {
    //     projectsPage.openProject(staticProjects.sampleREST.basic.name);
    // } else if (dbType === "postgres") {
    //     projectsPage.openProject(staticProjects.pgExternalREST.basic.name);
    // }
    //
    // // close team & auth tab
    // cy.get('button.ant-tabs-tab-remove').should('exist').click();
  }
}

///////////////////////////////////////////////////////////
// Projects page

export class _projectsPage {
  // Project creation options
  //

  // {dbType, apiType, name}
  // for external database, {databaseType, hostAddress, portNumber, username, password, databaseName}

  openConfiguredProject(apiType, dbType) {
    // http://localhost:8080/api/v1/db/meta/projects/p_kfxgmcd5jpyrje/users?limit=10&offset=0&query=
    cy.intercept("/**/users?limit=*&offset=*&query=*").as("waitForPageLoad");

    if (dbType === "mysql") {
      projectsPage.openProject(staticProjects.externalREST.basic.name);
    } else if (dbType === "xcdb") {
      projectsPage.openProject(staticProjects.sampleREST.basic.name);
    } else if (dbType === "postgres") {
      projectsPage.openProject(staticProjects.pgExternalREST.basic.name);
    }

    cy.wait("@waitForPageLoad");

    cy.wait(2000);
    
    // close team & auth tab
    cy.get("button.ant-tabs-tab-remove").should("be.visible").click();
    cy.get("button.ant-tabs-tab-remove").should("not.exist");
  }

  // Open existing project
  //
  openProject(projectName) {
    cy.get(".ant-table-row").contains(`${projectName}`).should("exist").click();

    // takes a while to load project
    this.waitHomePageLoad();
  }

  // Create new project
  // Input:
  //          projectData     {dbType, apiType, name}
  //          dbCredentials   {databaseType, hostAddress, portNumber, username, password, databaseName}
  // Returns: projectName
  //
  // To configure
  //      SSL & advanced parameters
  //      Database type selection
  //
  createProject(projectData, cred) {
    cy.get("body", { timeout: 2000 });

    let projectName = projectData.name;
    if (projectData.name == "") projectName = "test_proj" + Date.now();

    // click on "New Project"
    cy.get(".nc-new-project-menu").should("exist").click();

    if ("none" == projectData.dbType) {
      // Subsequent form, select (+ Create) option
      cy.get(".nc-create-xc-db-project", { timeout: 20000 }).last().click({
        force: true,
      });

      // wait for page load by verifying required elements
      cy.get(".nc-metadb-project-name").should("exist");
      cy.contains("button", "Create").should("exist");

      // fix me! wait till the modal rendering (input highlight) is completed
      // focus shifts back to the input field to select text after the dropdown is rendered
      cy.wait(1000);

      // feed project name
      cy.get(".nc-metadb-project-name", { timeout: 20000 })
        .clear()
        .type(projectName);

      // Submit
      cy.contains("button", "Create", { timeout: 20000 }).click();

      // takes a while to load project
      this.waitHomePageLoad();

      return projectName;
    }

    // dbType == 'external'
    else {
      // Subsequent form, select (+ Create by connection to external database) option
      cy.get(".nc-create-external-db-project", { timeout: 20000 })
        .last()
        .click({
          force: true,
        });

      // wait for page load by verifying required elements
      cy.get(".nc-extdb-host-database").should("exist");
      cy.get(".nc-extdb-proj-name").should("exist");
      cy.get(".nc-extdb-btn-test-connection").should("exist");

      // fix me! wait till the modal rendering (input highlight) is completed
      // focus shifts back to the input field to select text after the dropdown is rendered
      cy.wait(1000);

      cy.get(".nc-extdb-proj-name").clear().type(projectName);

      if (cred.databaseType === 1) {
        cy.get(".nc-extdb-db-type").should("exist").click();
        cy.getActiveSelection(".nc-dropdown-ext-db-type")
          .find(".ant-select-item-option")
          .contains("PostgreSQL")
          .click();
      }

      if (cred.databaseName !== "") {
        cy.get(".nc-extdb-host-database").clear().type(cred.databaseName);
      }

      // Test database connection
      cy.contains("Test Database Connection", { timeout: 20000 }).click();

      // Create project
      cy.contains("Ok & Save Project", { timeout: 20000 }).click();

      // takes a while to load project
      this.waitHomePageLoad();

      return projectName;
    }
  }

  // // create REST default project (sakila DB)
  // //
  // createDefaulRestProject() {
  //     return this.createProject(
  //         { dbType: 1, apiType: 0, name: "" },
  //         defaultDbParams
  //     );
  // }

  // // search project with given key
  // // return project-name array
  // //
  // searchProject(projectNameKey) {
  //     cy.get('input[placeholder="Search Project"]').type(projectNameKey);
  //
  //     const projectName = [];
  //
  //     cy.get("table tr")
  //         .each((tableRow) => {
  //             cy.wrap(tableRow)
  //                 .find("td")
  //                 .eq(0)
  //                 .find(".title")
  //                 .then((input) => {
  //                     projectName.push(input.text());
  //                 });
  //         })
  //         .then(() => {
  //             // TBD: validate project name to contain search key
  //             console.log(projectName);
  //             return projectName;
  //         });
  // }

  // remove specified project entry
  //
  deleteProject(projectName) {
    cy.log("Delete project: " + projectName);
    cy.get(".nc-noco-brand-icon").should("exist").click();
    cy.get(".ant-table-row")
      .contains(`${projectName}`)
      .should("exist")
      .then(($obj) => {
        cy.log($obj);
        cy.wrap($obj).parent().parent().find(".ant-table-cell").last().click();
      });

    // pop-up, submit
    cy.getActiveModal().find('button:contains("Yes")').click({});
  }

  // remove all projects created
  //
  // 1. read all project names to be deleted, store in array
  // 2. invoke delete project for each entry in array
  //
  // deleteAllProject() {

  //     const projectName = []

  //     cy.get('table tr').each((tableRow) => {

  //         cy.wrap(tableRow).find('td').eq(0).find('.title').then((input) => {
  //             projectName.push(input.text())
  //         })
  //     })
  //         .then(() => {
  //             console.log(projectName)
  //             projectName.forEach(element => {

  //                 // bring back the DOM to normalcy
  //                 cy.get('div').parentsUntil('body')
  //                 this.deleteProject(element)

  //                 // wait needed for pop up to disapper
  //                 this.waitDeletePageLoad()
  //             })
  //         })
  // }

  waitHomePageLoad() {
    cy.url({ timeout: 50000 }).should("contain", "/#/nc/p_");
  }
}

export const loginPage = new _loginPage();
export const projectsPage = new _projectsPage();

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
