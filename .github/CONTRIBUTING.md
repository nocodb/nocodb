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

Please refer to [Development Setup](https://github.com/nocodb/nocodb#development-setup).

### Committing Changes

We encourage all contributors to commit messages following [Commit Message Convention](./COMMIT_CONVENTION.md).

### Applying License

NocoDB doesn't require a CLA (Contributor License Agreement). 
We require [Developer Certificate of Origin (DCO)](https://github.com/nocodb/nocodb/blob/master/.github/developer-certificate-of-origin) as an additional safeguard
for the NocoDB project. This is a well established and widely used
mechanism to assure contributors have confirmed their right to license
their contribution under the project's license.

#### Modifying existing file
If you modify an existing file, please keep the existing license header as
it is and just add your copyright notice and author:

````
@author <your name> <your email address>
````

#### Creating new file

````
/**
 * @copyright Copyright (c) <year>, <your name> (<your email address>)
 *
 * @author <your name> <your email address>
 * 
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
````

#### Sign your existing work

Usually email will be already configured with your Github.

```bash
git config --global user.name "FirstName LastName"
git config --global user.email "email@provider.com"
```
Refer [here](https://support.atlassian.com/bitbucket-cloud/docs/configure-your-dvcs-username-for-commits/) for additional details.

```bash
git add .
git commit -s -m "commit message"
```

Please note : Use your real name (sorry, no pseudonyms or anonymous contributions).

Once pushed - you should see the commit have the following template in github
````
Signed-off-by: FirstName Initials/Lastname <email@provider.com>
````

#### Sign your previous work

In case you forget to sign your work, you can do the following:

```bash
# sign the last N commits - replace N before executing the command
git rebase HEAD~N --signoff
git push -f
```

## Project Structure

Please refer to [NocoDB Repository Structure](https://docs.nocodb.com/#nocodb-repository-structure).

## Financial Contribution

Isn't this product cool? We are working on this full time. Your donations will definitely help us to make this even better.

- [Funding NocoDB's work on Github](https://github.com/sponsors/nocodb)

## Credits

Once again. Thank you to all the people who have already contributed to NocoDB!