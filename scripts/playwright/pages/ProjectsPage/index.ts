// playwright-dev-page.ts
import { expect, Page } from "@playwright/test";
import BasePage from "../Base";

export class ProjectsPage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  get() {
    return this.rootPage.locator("html");
  }

  async selectAndGetProject(projectName: string) {
    let project: any;

    await Promise.all([
      this.rootPage.waitForResponse(async (res) => {
        let json:any = {}
        try{
          json = await res.json()
        } catch(e) {
          return false;
        }

        const isRequiredResponse = res.request().url().includes('/api/v1/db/meta/projects') &&
        ['GET'].includes(res.request().method()) &&
        json?.title === projectName;

        if(isRequiredResponse){
          project = json;
        }

        return isRequiredResponse;
      }),
      this.get().locator(`.ant-table-cell`,{
        hasText: projectName
      }).click()
    ]);

    return project;
  }

}
