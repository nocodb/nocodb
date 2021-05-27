# How to apply a license
NocoDB doesn't require a CLA (Contributor License Agreement). 
We require Developer Certificate of Origin (DCO) as an additional safeguard
for the NocoDB project. This is a well established and widely used
mechanism to assure contributors have confirmed their right to license
their contribution under the project's license.

## Modifying existing file
If you modify an existing file, please keep the existing license header as
it is and just add your copyright notice and author:

````
@author <your name> <your email address>
````

## Creating new file
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


## How to sign your work
````
  Signed-off-by: FirstName Initials/Lastname <email@provider.com>
````

Use your real name (sorry, no pseudonyms or anonymous contributions).
If you set your `user.name` and `user.email` git configs, you can sign your
commit automatically with `git commit -s`. 
You can also use git [aliases](https://git-scm.com/book/tr/v2/Git-Basics-Git-Aliases)
like `git config --global alias.ci 'commit -s'`. Now you can commit with
`git ci` and the commit will be signed.
