---
title: "Publishing Packages"
description: "Publishing Packages"
position: 100
category: "Usage"
menuTitle: "Publishing Packages"
---

> This is exclusive to NocoDB team members only

## Steps

1. When several features are included in develop branch and they are ready to be released, make a PR from `deveop` branach to `master` branch. At least one NocoDB team member approval is required.

2. Navigate to `packages/nc-gui` and execute following command.

   ```bash
   npm run build:copy:jsdeliver
   ```

3. Install the latest published version of `nc-lig-gui` in `packages/nocodb`, package version can be extracted from result of step 1 or copy it from `packages/nc-lib-gui/package.json`. While installing, add `-E` to install exact version of the package.

   Example: latest published version `0.84.8`

    ```bash
     npm i -E nc-lib-gui@0.84.8
   ```

4. Update package version in `packages/nocodb/package.json` file.

5. Publish the npm package by running following npm command in `packages/nocodb` folder.

   ```
   npm run obfuscate:build:publish
   ```

6. Populate release note by running following github action (on `master` branch) - `Release : Draft Notes`. While running the action you have to provide 2 inputs:
    - **Tag** : Provide current package version
    - **Previous Tag** : Provide previously released tag version

7. Publish docker image by running `Release : Docker` action in github (on `master` branch), where you have to provide the package version/tag. 

8. Finally update the populated release (remove issues which is not related to release) draft not and publish. In release note you can use `Auto-generate release notes` button to populate release content from commits & PR. 