# NocoDB Contributing Guide

Thanks for spending your time to contribute! The following is a set of guidelines for contributing to NocoDB. 

## Table of Contents

- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
  * [Committing Changes](#committing-changes)
  * [Applying License](#applying-license)

## Pull Request Guidelines

- When you create a PR, you should fill in all the info defined in this [template](https://github.com/nocodb/nocodb/blob/master/.github/PULL_REQUEST_TEMPLATE.md).

- We adopt [Gitflow Design](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow). However, we do not have release branches. 

- The `master` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches (e.g. `feat/foo`, `fix/bar`, `enhancement/baz`). All approved PRs will go to `develop` branch. **Do not submit PRs against the `master` branch.**

- Checkout a topic branch from the relevant branch, e.g. `develop`, and merge back against that branch.

- Multiple small commits are allowed on the PR - They will be squashed into one commit before merging.

- If your changes are related to a special issue, add `ref: #xxx` to link the issue where `xxx` is the issue id. If your changes are meant to solve the issue, then add `closes: #xxx` instead.

- If your changes doesn't relate to any issues, we suggest you to create a new issue first and ask for assignment. Also, it'd be better to discuss the design or solutions with the team members via Discord first. 

## Development Setup

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup).

### Committing Changes

We encourage all contributors to commit messages following [Commit Message Convention](./COMMIT_CONVENTION.md).

### Applying License

We require a CLA (Contributor License Agreement). This is a one-time process. Please click this [link](https://cla-assistant.io/nocodb/nocodb) to agree to the CLA for nocodb/nocodb. 

