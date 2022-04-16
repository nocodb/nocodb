// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
// @author Roman Rezinkin roman.rezinkin@hotmail.com
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import "cypress-file-upload";
import { isXcdb, isPostgres } from "./page_objects/projectConstants";

require("@4tw/cypress-drag-drop");

// for waiting until page load
Cypress.Commands.add("waitForSpinners", () => {
    cy.visit("http://localhost:3000", {
        retryOnNetworkFailure: true,
        timeout: 1200000,
        headers: {
            "Accept-Encoding": "gzip, deflate",
        },
    });
    cy.get("#nuxt-loading", { timeout: 10_0000 }).should("have.length", 0);
});

Cypress.Commands.add("signinOrSignup", (_args) => {
    const args = Object.assign(
        { username: "user@nocodb.com", password: "Password123." },
        _args
    );

    cy.wait(1000);

    // signin/signup
    cy.get("body").then(($body) => {
        // cy.wait(1000)
        cy.url().then((url) => {
            if (!url.includes("/projects")) {
                // handle initial load
                if ($body.find(".welcome-page").length > 0) {
                    cy.wait(8000);
                    cy.get("body").trigger("mousemove");
                    cy.snip("LetsBegin");
                    cy.contains("Let's Begin").click();
                    cy.get('input[type="text"]', { timeout: 12000 }).type(
                        args.username
                    );
                    cy.get('input[type="password"]').type(args.password);
                    cy.snip("SignUp");
                    cy.get('button:contains("SIGN UP")').click();

                    // handle signin
                } else {
                    cy.get('input[type="text"]', { timeout: 12000 }).type(
                        args.username
                    );
                    cy.get('input[type="password"]').type(args.password);
                    cy.snip("SignIn");
                    cy.get('button:contains("SIGN IN")').click();
                }
            } else if (url.includes("/signin")) {
                cy.get('input[type="text"]', { timeout: 12000 }).type(
                    args.username
                );
                cy.get('input[type="password"]').type(args.password);
                cy.snip("SignIn");
                cy.get('button:contains("SIGN IN")').click();
            }
        });
    });

    // indicates page-load complete
    cy.get(".nc-noco-brand-icon", { timeout: 12000 }).should("exist");
});

// for opening/creating a rest project
Cypress.Commands.add("openOrCreateRestProject", (_args) => {
    const args = Object.assign({ new: false }, _args);

    // signin/signup
    cy.signinOrSignup();
    cy.get(".nc-new-project-menu").should("exist");
    cy.snip("ProjectPage");
    cy.get("body").then(($body) => {
        const filter = args.meta
            ? ".nc-meta-project-row"
            : ":not(.nc-meta-project-row)";
        // if project exist open
        if (
            $body.find(".nc-rest-project-row").filter(filter).length &&
            !args.new
        ) {
            cy.get(".nc-rest-project-row").filter(filter).first().click();
        } else {
            cy.contains("New Project")
                .trigger("onmouseover")
                .trigger("mouseenter");
            if (args.meta) {
                cy.get(".nc-create-xc-db-project").click();
                cy.url({ timeout: 6000 }).should("contain", "#/project/xcdb");
                cy.get(".nc-metadb-project-name").type(
                    "test_proj" + Date.now()
                );
                cy.contains("button", "Create", { timeout: 3000 }).click();
            } else {
                cy.get(".nc-create-external-db-project").click();
                cy.url({ timeout: 6000 }).should("contain", "#/project");
                cy.get(".database-field input").click().clear().type("sakila");
                cy.contains("Test Database Connection").click();
                cy.contains("Ok & Save Project", { timeout: 3000 }).click();
            }
        }
    });
    cy.url({ timeout: 20000 }).should("contain", "#/nc/");
});

Cypress.Commands.add("refreshTableTab", () => {
    cy.task("log", `[refreshTableTab]`);

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .should("exist")
        .first()
        .rightclick({ force: true });

    cy.getActiveMenu()
        .find('[role="menuitem"]')
        .contains("Tables Refresh")
        .should("exist")
        .click({ force: true });

    cy.toastWait("Tables refreshed");
});

// tn: table name
// rc: row count. validate row count if rc!=0
Cypress.Commands.add("openTableTab", (tn, rc) => {
    cy.task("log", `[openTableTab] ${tn} ${rc}`);

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .should("exist")
        .first()
        .click({ force: true });

    cy.get(".nc-project-tree")
        .contains(tn, { timeout: 6000 })
        .first()
        .click({ force: true });

    cy.get(`.project-tab`).contains(tn, { timeout: 10000 }).should("exist");

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click({ force: true });

    // wait for page rendering to complete
    if (rc != 0) {
        cy.get(".nc-grid-row").should("have.length", rc);
    }

    cy.snip(`GridView_${tn}`);
});

Cypress.Commands.add("closeTableTab", (tn) => {
    cy.task("log", `[closeTableTab] ${tn}`);
    cy.get(`.project-tab`).contains(tn, { timeout: 10000 }).should("exist");
    cy.get(`[href="#table||||${tn}"]`).find("button.mdi-close").click();
});

Cypress.Commands.add("openOrCreateGqlProject", (_args) => {
    const args = Object.assign({ new: false, meta: false }, _args);

    cy.signinOrSignup();

    cy.get(".nc-new-project-menu").should("exist");
    cy.get("body").then(($body) => {
        const filter = args.meta
            ? ".nc-meta-project-row"
            : ":not(.nc-meta-project-row)";
        // if project exist open
        if (
            $body.find(".nc-graphql-project-row").filter(filter).length &&
            !args.new
        ) {
            cy.get(".nc-graphql-project-row").filter(filter).first().click();
        } else {
            cy.contains("New Project")
                .trigger("onmouseover")
                .trigger("mouseenter");
            if (args.meta) {
                cy.get(".nc-create-xc-db-project").click();
                cy.url({ timeout: 6000 }).should("contain", "#/project/xcdb");
                cy.contains("GRAPHQL APIs").closest("label").click();
                cy.get(".nc-metadb-project-name").type(
                    "test_proj" + Date.now()
                );
                cy.contains("button", "Create", { timeout: 3000 }).click();
            } else {
                cy.get(".nc-create-external-db-project").click();
                cy.url({ timeout: 6000 }).should("contain", "#/project");
                cy.contains("GRAPHQL APIs").closest("label").click();
                cy.get(".database-field input").click().clear().type("sakila");
                cy.contains("Test Database Connection").click();
                cy.contains("Ok & Save Project", { timeout: 3000 }).click();
            }
        }
    });
    cy.url({ timeout: 20000 }).should("contain", "#/nc/");
});

let LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add("saveLocalStorage", () => {
    Object.keys(localStorage).forEach((key) => {
        LOCAL_STORAGE_MEMORY[key] = localStorage[key];
    });
});

Cypress.Commands.add("restoreLocalStorage", () => {
    Object.keys(LOCAL_STORAGE_MEMORY).forEach((key) => {
        localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
    });
});

Cypress.Commands.add("getActiveModal", () => {
    return cy.get(".v-dialog.v-dialog--active").last();
});

Cypress.Commands.add("getActiveMenu", () => {
    return cy.get(".menuable__content__active").last();
});

Cypress.Commands.add("getActiveContentModal", () => {
    return cy.get(".v-dialog__content--active").last();
});

Cypress.Commands.add("createTable", (name) => {
    cy.get(".add-btn").click();
    cy.get('.nc-create-table-card .nc-table-name input[type="text"]')
        .first()
        .click()
        .clear()
        .type(name);

    // cy.log(isXcdb());
    // if (!isXcdb()) {
    //   cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]')
    //     .first()
    //     .should("have.value", name.toLowerCase());
    // }

    cy.snip("CreateTable");
    cy.snipActiveModal("Modal_CreateTable");

    cy.get(".nc-create-table-card .nc-create-table-submit").first().click();
    cy.toastWait(`Create table successful`);
    cy.get(`.project-tab:contains(${name})`).should("exist");
    cy.url().should("contain", `name=${name}`);
});

Cypress.Commands.add("deleteTable", (name, dbType) => {
    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click();
    cy.get(".nc-project-tree")
        .contains(name, { timeout: 6000 })
        .first()
        .click({ force: true });
    cy.get(`.project-tab:contains(${name}):visible`).should("exist");
    cy.get(".nc-table-delete-btn:visible").click();
    cy.snipActiveModal("Modal_DeleteTable");
    cy.get("button:contains(Submit)").click();

    // only for postgre project
    if (dbType === "postgres") cy.toastWait(`Delete trigger successful`);

    cy.toastWait(`Delete table successful`);
});

Cypress.Commands.add("renameTable", (oldName, newName) => {
    // expand project tree
    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click();

    // right click on project table name
    cy.get(".nc-project-tree")
        .contains(oldName, { timeout: 6000 })
        .first()
        .rightclick();

    // choose rename option from menu
    cy.getActiveMenu()
        .find('[role="menuitem"]')
        .contains("Table Rename")
        .click({ force: true });

    // feed new name
    cy.getActiveContentModal().find("input").clear().type(newName);

    cy.snipActiveModal("Modal_RenameTable");
    // submit
    cy.getActiveContentModal().find("button").contains("Submit").click();

    cy.toastWait("Table renamed successfully");

    // close expanded project tree
    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click();
});

Cypress.Commands.add("createColumn", (table, columnName) => {
    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click();
    cy.get(".nc-project-tree")
        .contains(table, { timeout: 6000 })
        .first()
        .click({ force: true });
    cy.get(`.project-tab:contains(${table}):visible`).should("exist");
    cy.get(".v-window-item--active .nc-grid  tr > th:last button").click({
        force: true,
    });
    cy.get(".nc-column-name-input input").clear().type(columnName);
    cy.getActiveMenu("Menu_CreateColumn");
    cy.get(".nc-col-create-or-edit-card").contains("Save").click();
    cy.get("th:contains(new_column)").should("exist");
});

Cypress.Commands.add("toastWait", (msg) => {
    // cy.get(".toasted:visible", { timout: 12000 }).contains(msg).should("exist");
    // cy.get(".toasted:visible", { timout: 12000 })
    //     .contains(msg)
    //     .should("not.exist");
    cy.wait(3000);
});

// vn: view name
// rc: expected row count. validate row count if rc!=0
Cypress.Commands.add("openViewsTab", (vn, rc) => {
    cy.task("log", `[openViewsTab] ${vn} ${rc}`);

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .should("exist")
        .first()
        .click({ force: true });

    cy.get(".nc-project-tree")
        .contains(vn, { timeout: 6000 })
        .first()
        .click({ force: true });

    cy.get(`.project-tab`).contains(vn, { timeout: 10000 }).should("exist");

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click({ force: true });

    // wait for page rendering to complete
    if (rc != 0) {
        cy.get(".nc-grid-row").should("have.length", rc);
    }
});

Cypress.Commands.add("closeViewsTab", (vn) => {
    cy.task("log", `[closeViewsTab] ${vn}`);
    cy.get(`.project-tab`).contains(vn, { timeout: 10000 }).should("exist");
    cy.get(`[href="#view||||${vn}"]`)
        .find("button.mdi-close")
        .click({ force: true });
});

// Support for screen-shots
//

let screenShotDb = [];

// snip entire screen
Cypress.Commands.add("snip", (filename) => {
    if (
        true === Cypress.env("screenshot") &&
        false === screenShotDb.includes(filename)
    ) {
        let storeName = `${screenShotDb.length}_${filename}`;
        screenShotDb.push(filename);
        cy.wait(1000);
        cy.screenshot(storeName, { overwrite: true });
    }
});

// snip current modal
Cypress.Commands.add("snipActiveModal", (filename) => {
    if (
        true === Cypress.env("screenshot") &&
        false === screenShotDb.includes(filename)
    ) {
        let storeName = `${screenShotDb.length}_${filename}`;
        screenShotDb.push(filename);
        cy.wait(1000);
        // cy.getActiveModal().screenshot(filename, {
        //     padding: 0,
        //     overwrite: true,
        // });
        cy.screenshot(storeName, { overwrite: true });
    }
});

// snip current menu
Cypress.Commands.add("snipActiveMenu", (filename) => {
    if (
        true === Cypress.env("screenshot") &&
        false === screenShotDb.includes(filename)
    ) {
        let storeName = `${screenShotDb.length}_${filename}`;
        screenShotDb.push(filename);
        cy.wait(1000);
        // cy.getActiveMenu().screenshot(filename, {
        //     padding: 0,
        //     overwrite: true,
        // });
        cy.screenshot(storeName, { overwrite: true });
    }
});


// Drag n Drop
// refer: https://stackoverflow.com/a/55409853
/*

const getCoords = ($el) => {
  const domRect = $el[0].getBoundingClientRect()
  const coords = { x: domRect.left + (domRect.width / 2 || 0), y: domRect.top + (domRect.height / 2 || 0) }

  return coords
}

const dragTo = (subject, to, opts) => {

  opts = Cypress._.defaults(opts, {
    // delay inbetween steps
    delay: 0,
    // interpolation between coords
    steps: 0,
    // >=10 steps
    smooth: false,
  })

  if (opts.smooth) {
    opts.steps = Math.max(opts.steps, 10)
  }

  const win = subject[0].ownerDocument.defaultView

  const elFromCoords = (coords) => win.document.elementFromPoint(coords.x, coords.y)
  const winMouseEvent = win.MouseEvent

  const send = (type, coords, el) => {

    el = el || elFromCoords(coords)

    el.dispatchEvent(
      new winMouseEvent(type, Object.assign({}, { clientX: coords.x, clientY: coords.y }, { bubbles: true, cancelable: true }))
    )
  }

  const toSel = to

  function drag (from, to, steps = 1) {

    const fromEl = elFromCoords(from)

    const _log = Cypress.log({
      $el: fromEl,
      name: 'drag to',
      message: toSel,
    })

    _log.snapshot('before', { next: 'after', at: 0 })

    _log.set({ coords: to })

    send('mouseover', from, fromEl)
    send('mousedown', from, fromEl)

    cy.then(() => {
      return Cypress.Promise.try(() => {

        if (steps > 0) {

          const dx = (to.x - from.x) / steps
          const dy = (to.y - from.y) / steps

          return Cypress.Promise.map(Array(steps).fill(), (v, i) => {
            i = steps - 1 - i

            let _to = {
              x: from.x + dx * (i),
              y: from.y + dy * (i),
            }

            send('mousemove', _to, fromEl)

            return Cypress.Promise.delay(opts.delay)

          }, { concurrency: 1 })
        }
      })
        .then(() => {

          send('mousemove', to, fromEl)
          send('mouseover', to)
          send('mousemove', to)
          send('mouseup', to)
          _log.snapshot('after', { at: 1 }).end()

        })

    })

  }

  const $el = subject
  const fromCoords = getCoords($el)
  const toCoords = getCoords(cy.$$(to))

  drag(fromCoords, toCoords, opts.steps)
}

Cypress.Commands.addAll(
  { prevSubject: 'element' },
  {
    dragTo,
  }
)
*/
