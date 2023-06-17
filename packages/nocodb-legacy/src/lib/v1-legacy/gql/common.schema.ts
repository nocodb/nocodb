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
