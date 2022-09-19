import { isTestSuiteActive } from '../../support/page_objects/projectConstants';

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} api - Table views: Expanded form`, () => {

    before(() => {
      cy.restoreLocalStorage();

      // open a table to work on views
      //
      cy.openTableTab('Country', 25);
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      cy.restoreLocalStorage();
      cy.closeTableTab('Country');
      cy.saveLocalStorage();
    });

    // Common routine to create/edit/delete GRID & GALLERY view
    // Input: viewType - 'grid'/'gallery'
    //
    const viewTest = (viewType) => {
      it(`Create ${viewType} view`, () => {
        // click on 'Grid/Gallery' button on Views bar
        cy.get(`.nc-create-${viewType}-view`).click();

        // Pop up window, click Submit (accepting default name for view)
        cy.getActiveModal('.nc-modal-view-create').find('.ant-btn-primary').click();
        cy.toastWait('View created successfully');

        // validate if view was created && contains default name 'Country1'
        cy.get(`.nc-${viewType}-view-item`)
          .contains(`${capitalizeFirstLetter(viewType)}-1`)
          .should('exist');
      });


      it(`Expand a row in ${viewType} and verify url`, () => {

        if (viewType === 'grid') {
          cy.get('.nc-row-expand')
            .first()
            .click({ force: true });
        } else if (viewType === 'gallery') {
          cy.get('.nc-gallery-container .ant-card')
            .first()
            .click({ force: true });
        }
        cy.url().should('include', 'rowId=1');

        // spy on clipboard to verify copied text
        cy.window().then((win) => {
          cy.spy(win.navigator.clipboard, 'writeText').as('copy');
        })

        // copy url
        cy.get('.nc-copy-row-url').click();

        cy.get('@copy').should('be.calledWithMatch', `?rowId=1`);

        cy.get('.nc-expand-form-close-btn').click();

      });

      it(`Visit a ${viewType} row url and verify expanded form`, () => {
        cy.url()
          .then((url) => {
            cy.visit('/' + url.split('/').slice(3).join('/').split('?')[0] + '?rowId=2');
            cy.get('.nc-expanded-form-header').should('exist');
          });
      });

      it(`Visit an invalid ${viewType} row url and verify expanded form`, () => {
        cy.url()
          .then((url) => {
            cy.visit('/' + url.split('/').slice(3).join('/').split('?')[0] + '?rowId=99999999');
            cy.get('.nc-expanded-form-header').should('not.exist');
          });
      });


    };

    viewTest('grid');  // grid view
    viewTest('gallery');  // gallery view
  });
};
