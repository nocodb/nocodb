import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { ProjectsPage } from '../pages/ProjectsPage';
import setup from '../setup';

const langMenu = [
  'help-translate',
  'ar.json',
  'bn_IN.json',
  'cs.json',
  'da.json',
  'de.json',
  'en.json',
  'es.json',
  'eu.json',
  'fa.json',
  'fi.json',
  'fr.json',
  'he.json',
  'hi.json',
  'hr.json',
  'id.json',
  'it.json',
  'ja.json',
  'ko.json',
  'lv.json',
  'nl.json',
  'no.json',
  'pl.json',
  'pt.json',
  'pt_BR.json',
  'ru.json',
  'sk.json',
  'sl.json',
  'sv.json',
  'th.json',
  'tr.json',
  'uk.json',
  'vi.json',
  'zh-Hans.json',
  'zh-Hant.json',
];

test.describe('Common', () => {
  let context: any;
  let dashboard: DashboardPage;
  let projectsPage: ProjectsPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    projectsPage = new ProjectsPage(page);
  });

  test('Language', async () => {
    await dashboard.clickHome();

    // Index is the order in which menu options appear
    for (let i = 1; i < langMenu.length; i++) {
      // scripts/playwright/tests/language.spec.ts
      const json = require(`../../../packages/nc-gui/lang/${langMenu[i]}`);
      await projectsPage.openLanguageMenu();
      await projectsPage.selectLanguage({ index: i });
      await projectsPage.verifyLanguage({ json });
    }
  });
});
