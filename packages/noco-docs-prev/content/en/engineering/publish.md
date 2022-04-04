---
title: "Making a release"
description: "Making a release"
position: 2000
category: "Engineering"
menuTitle: "Making a release"
---

<alert>
   This is exclusive to NocoDB team members only.
</alert>

<alert types='danger'>
   The version 0.84.8 will be used as an example. Please change it during the release.
</alert>

## 1. Merge ```develop``` to ```master``` 
- When several features are included in ``develop`` branch and they are ready to be released, make a PR with the title ``0.84.8 Pre-Release`` from `develop` branch to `master` branch. At least one NocoDB team member approval is required. 

## 2. Publish frontend
- Navigate to `packages/nc-gui` and execute following command.
   ```bash
   npm run build:copy:jsdeliver
   ```
## 3. Install frontend
- Install the latest published version of `nc-lib-gui` in `packages/nocodb`, package version can be extracted from result of step 1 or copy it from `packages/nc-lib-gui/package.json`. While installing, add `-E` to install exact version of the package.

- Example: for latest published version `0.84.8`
   ```bash
     npm i -E nc-lib-gui@0.84.8
   ```

## 4. Publish backend
- Bump package version in `packages/nocodb/package.json` file.
- Publish the npm package by running following npm command in `packages/nocodb` folder.
   ```
   npm run obfuscate:build:publish
   ```

## 5. Close all issues
- Go to Issue page and close all issues with tags ``Fixed`` or ``Resolved``. 

## 6. Commit release changes
- Commit those changes made by previous steps with the commit message ``chore(publish): v0.84.8``.

## 7. Prepare release notes 
- Populate release note by running following github action (on `master` branch) - `Release : Draft Notes`. While running the action you have to provide 2 inputs:
    - **Tag** : Provide current package version
    - **Previous Tag** : Provide previously released tag version

## 8. Publish docker & release
- Publish docker image by running `Release : Docker` action in github (on `master` branch), where you have to provide the package version/tag. It may take half an hour. Test it locally after it is done.

- Update the populated release (remove issues which is not related to release) draft and publish. In release note you can use `Auto-generate release notes` button to populate release content from commits & PR. 

## 9. Sync the changes back to develop branch

- Pull the latest chagnes for both branches to your local
- Switch to ``develop`` branch
- Run ``git merge master``
- Push the diff to remote repository