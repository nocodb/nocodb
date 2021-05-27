// #! /usr/bin/env node

import CliMgr from './lib/CliMgr';
import SocialMgr from './lib/mgr/SocialMgr';
import Util from './lib/util/Util';

import updateNotifier from 'update-notifier';


// tslint:disable-next-line:no-var-requires
const pkg = require('../package.json');
import yargs from 'yargs';

const {uniqueNamesGenerator, starWars, adjectives, animals} = require('unique-names-generator');


/* get cli args */
const args = yargs
  .alias('u', 'url')
  .alias('m', 'module')
  .alias('n', 'nomodel')
  .help('help')
  .argv;

/* cwd is reference to all commands */
args.folder = process.cwd();

/* handle command */
(async () => {

// Checks for available update and returns an instance
  const notifier = updateNotifier({pkg});

// Notify using the built-in convenience method
  notifier.notify();

  if (args._) {
    if (!args._.length) {
      await SocialMgr.showPrompt();
      args._.unshift(uniqueNamesGenerator({
        dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)]
      }).toLowerCase().replace(/[ -]/g, '_'));
    }
    await CliMgr.process(args);
  } else {
    Util.showHelp(args);
    process.exit(0)
  }
})().catch(err => {
  console.error('\n\nThere was an error processing command:');
  console.error(err);
});
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
