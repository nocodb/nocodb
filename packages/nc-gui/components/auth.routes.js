let authorizedRoutes = {};

authorizedRoutes['/user/settings'] = true;
authorizedRoutes['/user/settings/accounts'] = true;
authorizedRoutes['/user/settings/password'] = true;
authorizedRoutes['/referral'] = true;

authorizedRoutes['/realestate/profits'] = true;
authorizedRoutes['/realestate/bygeo'] = true;
authorizedRoutes['/payment/buy'] = true;

authorizedRoutes['/pricing'] = false;
authorizedRoutes['/user'] = true;

authorizedRoutes['/user/authentication'] = true;
authorizedRoutes['/user/password'] = true;

authorizedRoutes['/error/400'] = false;
authorizedRoutes['/realestate/capitalgains'] = true;
authorizedRoutes['/payment/train'] = true;
authorizedRoutes['/user/settings'] = true;

authorizedRoutes['/info/contact'] = false;
authorizedRoutes['/profits'] = false;
authorizedRoutes['/user/admin'] = true;
authorizedRoutes['/error/403'] = false;
authorizedRoutes['/error/404'] = false;

authorizedRoutes['/info/hiring'] = false;
authorizedRoutes['/user/settings/accounts'] = true;
authorizedRoutes['/user/password/reset'] = false;
authorizedRoutes['/user/settings/profile'] = true;
authorizedRoutes['/user/settings/picture'] = true;
authorizedRoutes['/user/password/forgot'] = false;
authorizedRoutes['/user/authentication/signup'] = false;
authorizedRoutes['/user/settings/password'] = true;
authorizedRoutes['/user/admin/user-edit'] = true;
authorizedRoutes['/user/authentication/signin'] = false;
authorizedRoutes['/user/password/reset/success'] = true;
authorizedRoutes['/user/password/reset/invalid'] = true;
authorizedRoutes['/user/password/reset/form'] = true;
// // authorizedRoutes['/user/admin/user/_userId'] = true;
// // authorizedRoutes['/'] = false;

// authorizedRoutes['/realestate/profits'] = true;

// let freeRoutes = {};
// freeRoutes['/'] = true;
// freeRoutes['/pricing'] = true;
// freeRoutes['user/authentication/signin'] = true;
// freeRoutes['user/authentication/signup'] = true;


exports.allowed = function (store, path) {

  // console.log('store.getters.GtrUser',store.getters.GtrUser);
  // console.log('path',path);

  // && authorizedRoutes[path]

  if(store.getters.GtrUser === null && path in authorizedRoutes && authorizedRoutes[path]) {
    return false;
  } else {
    true;
  }
};
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
