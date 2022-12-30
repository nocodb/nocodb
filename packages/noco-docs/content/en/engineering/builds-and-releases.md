---
title: "Releases & Builds"
description: "NocoDB creates Docker and Binaries for each PR"
position: 3300
category: "Engineering"
menuTitle: "Releases & Builds"
---
## Builds of NocoDB

There are 3 kinds of docker builds in NocoDB

- Release builds [nocodb/nocodb](https://hub.docker.com/r/nocodb/nocodb) : built during NocoDB release. 
- Daily builds [nocodb/nocodb-daily](https://hub.docker.com/r/nocodb/nocodb-daily) : built every 6 hours from Develop branch.
- Daily builds [nocodb/nocodb-timely](https://hub.docker.com/r/nocodb/nocodb-timely): built for every PR.

Below is an overview of how to make these builds and what happens behind the scenes.

## Release builds

### How to make a release build  ?

- Click [NocoDB release action](https://github.com/nocodb/nocodb/actions/workflows/release-nocodb.yml)
- You should see the below screen

  ![image](https://user-images.githubusercontent.com/35857179/167240353-a02f690f-c865-4ade-8645-64382405c9ea.png)
- Change `Use workflow from` to `Branch: master`. If you choose the wrong branch, the workflow will be ended.

  ![image](https://user-images.githubusercontent.com/35857179/167240383-dda05f76-8323-4f4a-b3e7-9db886dbd68d.png)
- Then there would be two cases - you can either leave target tag and pervious tag blank or manually input some values

- Target Tag means the target deployment version, while Previous Tag means the latest version as of now. Previous Tag is used for Release Note only - showing the file / commit differences between two tags.

### Tagging

The naming convention would be following given the actual release tag is `0.100.0`

- `0.100.0-beta.0` (first version of pre-release)
- `0.100.0-beta.1` (include bug fix changes on top of the previous version)
- `0.100.0-beta.2`(include bug fix changes on top of the previous version)
-  and so on ...
- `0.100.0` (actual release)
- `0.100.1` (minor bug fix release)
- `0.100.2` (minor bug fix release)

### Case 1: Leaving inputs blank

- If Previous Tag is blank, then the value will be fetched from [latest](https://github.com/nocodb/nocodb/releases/latest)
- If Target Tag is blank, then the value will be Previous Tag plus one. Example: 0.90.11 (Previous Tag) + 0.0.1 = 0.90.12 (Target Tag)

### Case 2: Manually Input

Why? Sometimes we may mess up in NPM deployment. As NPM doesn't allow us to redeploy to the same tag again, in this case we cannot just use the previous tag + 1. Therefore, we need to use previous tag + 2 instead and we manually configure it.

- After that, click `Run workflow` to start
- You can see Summary for the overall job status.
- Once `release-draft-note` and `release-executables` is finished, then go to [releases](https://github.com/nocodb/nocodb/releases), edit the draft note and save as draft for time being.
    - Example: Adding header, update content if necessary, and click `Auto-generate release notes` to include more info.
- Once `release-docker` is finished, then test it locally first. You'll be expected to see `Upgrade Available` notification in UI as we haven't published the release note. (the version is retrieved from there)
- Once everything is finished, then publish the release note and the deployment is considered as DONE.

### How does release action work ?

#### validate-branch

To check if `github.ref` is master. Otherwise, other branches will be not accepted.

#### process-input

To enrich target tag or previous tag if necessary.

#### pr-to-master

Automate a PR from develop to master branch so that we know the actual differences between the previous tag and the current tag. We choose master branch for a deployment base.

#### release-npm

Build frontend and backend and release them to NPM. The changes during built such as version bumping will be committed and pushed to a temporary branch and an automated PR will be created and merged to master branch.

Note that once you publish with a certain tag, you cannot publish with the same tag again.

#### release-draft-note

Generate a draft release note. Some actions need to be done after this step.

#### release-docker

Build docker image and publish it to Docker Hub. It may take around 15 - 30 mins.

#### close-issues

Open issues marked with label `Status: Fixed` and `Status: Resolved` will be closed by bot automatically with comment mentioning the fix is included in which version.

Example:

![image](https://user-images.githubusercontent.com/35857179/167241574-f8f7061f-c689-444a-b761-0a727974c53f.png)

#### publish-docs

Publish Documentations

#### update-sdk-path

`nocodb-sdk` is used in frontend and backend. However, in develop branch, the value would be `file:../nocodb-sdk` for development purpose (so that the changes done in nocodb-sdk in develop will be included in frontend and backend). During the deployment, the value will be changed to the target tag. This job is to update them back.

#### sync-to-develop

Once the deployment is finished, there would be some new changes being pushed to master branch. This job is to sync the changes back to develop so that both branch won't have any difference.

## Daily builds

### What are daily builds ?
- NocoDB creates every 6 hours from develop branches and publishes as nocodb/nocodb-daily
- This is so that we can easily try what is in the develop branch easily.

### Docker images
- The docker images will be built and pushed to Docker Hub (See [nocodb/nocodb-daily](https://hub.docker.com/r/nocodb/nocodb-daily/tags) for the full list). 

## Timely builds

### What are timely builds ?
NocoDB creates docker and binaries for each PR!

This is to
- reduce pull request cycle time
- allow issue reporters / reviewers to verify the fix without setting up their local machines

### Docker images
When a non-draft Pull Request is created, reopened or synchronized, a timely build for Docker would be triggered for the changes only included in the following paths.
- `packages/nocodb-sdk/**`
- `packages/nc-gui/**`
- `packages/nc-plugin/**`
- `packages/nocodb/**`

The docker images will be built and pushed to Docker Hub (See [nocodb/nocodb-timely](https://hub.docker.com/r/nocodb/nocodb-timely/tags) for the full list). Once the image is ready, Github bot will add a comment with the command in the pull request. The tag would be `<NOCODB_CURRENT_VERSION>-pr-<PR_NUMBER>-<YYYYMMDD>-<HHMM>`.

![image](https://user-images.githubusercontent.com/35857179/175012097-240dab05-da93-4c4e-87c1-1c36fb1350bd.png)

## Executables or Binariess

Similarly, we provide a timely build for executables for non-docker users. The source code will be built, packaged as binary files, and pushed to Github (See [nocodb/nocodb-timely](https://github.com/nocodb/nocodb-timely/releases) for the full list).

Currently, we only support the following targets:

- `node16-linux-arm64`
- `node16-macos-arm64`
- `node16-win-arm64`
- `node16-linux-x64`
- `node16-macos-x64`
- `node16-win-x64`

Once the executables are ready, Github bot will add a comment with the commands in the pull request.

![image](https://user-images.githubusercontent.com/35857179/175012070-f5f3e7b8-6dc5-4d1c-9f7e-654bc5039521.png)

NocoDB creates Docker and Binaries for each PR.

This is to
- reduce pull request cycle time
- allow issue reporters / reviewers to verify the fix without setting up their local machines

