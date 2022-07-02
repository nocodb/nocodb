# NocoDB Contributing Guide

Thanks for spending your time to contribute! The following is a set of guidelines for contributing to NocoDB. 

## Table of Contents

- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
  * [Committing Changes](#committing-changes)
  * [Applying License](#applying-license)
    + [Modifying existing file](#modifying-existing-file)
    + [Creating new file](#creating-new-file)
    + [Sign your existing work](#sign-your-existing-work)
    + [Sign your previous work](#sign-your-previous-work)
- [Project Structure](#project-structure)
- [Financial Contribution](#financial-contribution)
- [Credits](#credits)

## Pull Request Guidelines

- When you create a PR, you should fill in all the info defined in this [template](https://github.com/nocodb/nocodb/blob/master/.github/pull_request_template.md).

- We adopt [Gitflow Design](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow). However, we do not have release branches. 

    ![git flow design](https://wac-cdn.atlassian.com/dam/jcr:cc0b526e-adb7-4d45-874e-9bcea9898b4a/04%20Hotfix%20branches.svg?cdnVersion=176)

- The `master` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches. 
**Do not submit PRs against the `master` branch.**

- Checkout a topic branch from the relevant branch, e.g. `develop`, and merge back against that branch.

- Multiple small commits are allowed on the PR - They will be squashed into one commit before merging.

- If your changes are related to a special issue, add `ref: #xxx` to link the issue where xxx is the issue id.

## Development Setup

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup).

### Committing Changes

We encourage all contributors to commit messages following [Commit Message Convention](./COMMIT_CONVENTION.md).

### Applying License

We require a CLA (Contributor License Agreement). This is a one-time process. Please click this [link](https://cla-assistant.io/nocodb/nocodb) to agree to the CLA for nocodb/nocodb. 

