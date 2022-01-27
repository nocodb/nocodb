---
title: "Publishing Packages"
description: "Publishing Packages"
position: 100
category: "Usage"
menuTitle: "Publishing Packages"
---

## Steps

1. Navigate to `packages/nc-gui` and execute following command.
    ```
   npm run build:copy:jsdeliver
   ```
2. Install the latest published version of `nc-lig-gui` in `packages/nocodb`, package version can be extracted from result of step 1 or copy it from `packages/nc-lib-gui/package.json`. While installing add `-E` to install exact version of the package.

   Example:  

    ```
     npm i -E nc-lib-gui@0.84.8
      ```
3. Update package version in `packages/nocodb/package.json` file.

4. Commit and push changes to develop branch.
5. Raise a release pull request.
6. After merging develop branch to master publish the npm package by running following npm command in `packages/nocodb` folder.
   ```
   npm run obfuscate:build:publish
   ```
7. Populate release not by running following github action(on `master` branch) - `Release : Draft Notes`. While running the action you have to provide 2 inputs:
    - **Tag** : Provide current package version
    - **Previous Tag** : Provide previously released tag version
8. Publish docker image by running `Release : Docker` action in github(on `master` branch), where you have to provide the package version/tag. 
9. Finally update the populated release(remove issues which is not related to release) draft not and publish. In release not you can use `Auto-generate release notes` button to populate release content from commits & PR. 