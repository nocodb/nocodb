export default `
type distribution {
  range: String
  count: Int
}

input ConditionString{
  eq: String
  neq: String
  in: [String]
  nin: [String]
  like: String
}
input ConditionBoolean{
  eq: Boolean
  neq: Boolean
}

input ConditionInt{
  eq: Int
  neq: Int
  in: [Int]
  nin: [Int]
  lt: Int
  gt: Int
  le: Int
  ge: Int
}

input ConditionFloat{
  eq: Float
  neq: Float
  in: [Float]
  nin: [Float]
  lt: Float
  gt: Float
  le: Float
  ge: Float
}


scalar JSON

type Query{
   nocodb_health:String
   m2mNotChildren(pid:String!, assoc:String!, parent:String!, limit:Int, offset:Int):[JSON]
   m2mNotChildrenCount(pid:String!, assoc:String!, parent:String!):JSON
}



`;
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
