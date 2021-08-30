// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
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

// require('@4tw/cypress-drag-drop')

// for waiting until page load
Cypress.Commands.add('waitForSpinners', () => {
  cy.visit('http://localhost:3000', {
    retryOnNetworkFailure: true,
    timeout: 1200000,
    headers: {
      "Accept-Encoding": "gzip, deflate"
    }
  })
  cy.get('#nuxt-loading', {timeout: 10_0000}).should('have.length', 0)
})
Cypress.Commands.add('signinOrSignup', () => {

  // signin/signup
  cy.get('body').then(($body) => {
    cy.wait(1000)
    cy.url().then(url => {
      if (!url.includes('/projects')) {
        // handle initial load
        if ($body.find('.welcome-page').length > 0) {
          cy.wait(8000);
          cy.get('body').trigger('mousemove');
          cy.contains('Let\'s Begin').click();
          cy.get('input[type="text"]', {timeout: 12000}).type('pranavc@gmail.com');
          cy.get('input[type="password"]').type('Password123.');
          cy.get('button:contains("SIGN UP")').click()

          // handle signin
        } else {
          cy.get('input[type="text"]').type('pranavc@gmail.com');
          cy.get('input[type="password"]').type('Password123.');
          cy.get('button:contains("SIGN IN")').click()
        }
      }

    })
  })
});
// for opening/creating a rest project
Cypress.Commands.add('openOrCreateRestProject', (_args) => {
    const args = Object.assign({new: false}, _args)

    // signin/signup
    cy.signinOrSignup()
    cy.wait(2000);
    cy.get('body').then($body => {
      const filter = args.meta ? '.nc-meta-project-row' : ':not(.nc-meta-project-row)';
      // if project exist open
      if ($body.find('.nc-rest-project-row').filter(filter).length && !args.new) {
        cy.get('.nc-rest-project-row').filter(filter).first().click()
      } else {
        cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
        if (args.meta) {
          cy.get('.nc-create-xc-db-project').click()
          cy.url({timeout: 6000}).should('contain', '#/project/xcdb')
          cy.get('.nc-metadb-project-name').type('test_proj' + Date.now())
          cy.contains('button','Create', {timeout: 3000}).click()
        } else {
          cy.get('.nc-create-external-db-project').click()
          cy.url({timeout: 6000}).should('contain', '#/project')
          cy.get('.database-field input').click().clear().type('sakila')
          cy.contains('Test Database Connection').click()
          cy.contains('Ok & Save Project', {timeout: 3000}).click()
        }
      }
    })
    cy.url({timeout: 20000}).should('contain', '#/nc/')

  }
)


Cypress.Commands.add('openTableTab', (tn) => {
  cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
    .first().click()

  cy.get('.nc-project-tree').contains(tn, {timeout: 6000}).first().click({force: true});

  cy.get(`.project-tab:contains(${tn}):visible`).should('exist')

});
Cypress.Commands.add('openOrCreateGqlProject', (_args) => {
  const args = Object.assign({new: false, meta: false}, _args)

  cy.signinOrSignup()

  cy.wait(2000);
  cy.get('body').then($body => {
    const filter = args.meta ? '.nc-meta-project-row' : ':not(.nc-meta-project-row)';
    // if project exist open
    if ($body.find('.nc-graphql-project-row').filter(filter).length && !args.new) {
      cy.get('.nc-graphql-project-row').filter(filter).first().click()
    } else {
      cy.contains('New Project').trigger('onmouseover').trigger('mouseenter');
      if (args.meta) {
        cy.get('.nc-create-xc-db-project').click()
        cy.url({timeout: 6000}).should('contain', '#/project/xcdb')
        cy.contains('GRAPHQL APIs').closest('label').click();
        cy.get('.nc-metadb-project-name').type('test_proj' + Date.now())
        cy.contains('button','Create', {timeout: 3000}).click()
      } else {
        cy.get('.nc-create-external-db-project').click()
        cy.url({timeout: 6000}).should('contain', '#/project')
        cy.contains('GRAPHQL APIs').closest('label').click()
        cy.get('.database-field input').click().clear().type('sakila')
        cy.contains('Test Database Connection').click()
        cy.contains('Ok & Save Project', {timeout: 3000}).click()
      }
    }
  })
  cy.url({timeout: 20000}).should('contain', '#/nc/')

})

let LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add("saveLocalStorage", () => {
  Object.keys(localStorage).forEach(key => {
    LOCAL_STORAGE_MEMORY[key] = localStorage[key];
  });
});

Cypress.Commands.add("restoreLocalStorage", () => {
  Object.keys(LOCAL_STORAGE_MEMORY).forEach(key => {
    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
  });
});

Cypress.Commands.add("getActiveModal", () => {
  return cy.get('.v-dialog.v-dialog--active')
});

Cypress.Commands.add("getActiveMenu", () => {
  return cy.get('.menuable__content__active')
});

Cypress.Commands.add("getActiveModal", () => {
  return cy.get('.v-dialog__content--active')
});


Cypress.Commands.add('createTable', (name) => {
  cy.get('.add-btn').click();
  cy.get('.nc-create-table-card .nc-table-name input[type="text"]').first().click().clear().type(name)
  cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]').first().should('have.value', name.toLowerCase())
  cy.wait(5000)
  cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
  cy.get(`.project-tab:contains(${name})`).should('exist')
  cy.url().should('contain', `?name=${name}&`)
})

Cypress.Commands.add('deleteTable', (name) => {
  cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
    .first().click()

  cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});

  cy.get(`.project-tab:contains(${name}):visible`).should('exist')

  cy.get('.nc-table-delete-btn:visible').click()

  cy.get('button:contains(Submit)').click()
  cy.get(`.project-tab:contains(${name}):visible`).first().should('not.exist')
})

Cypress.Commands.add('createColumn', (table, columnName) => {
  cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
    .first().click()

  cy.get('.nc-project-tree').contains(table, {timeout: 6000}).first().click({force: true});

  cy.get(`.project-tab:contains(${table}):visible`).should('exist')

  cy.get('.v-window-item--active .nc-grid  tr > th:last button').click({force: true});
  cy.get('.nc-column-name-input input').clear().type(columnName)
  cy.get('.nc-col-create-or-edit-card').contains('Save').click()
  cy
    .get('th:contains(new_column)')
    .should('exist');
})


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


