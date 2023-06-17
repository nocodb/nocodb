export default `

type Query {
  Me: User
}

type Mutation {
  SignIn(data:SignInInput ): XcToken
  SignUp(data:UserInput): XcToken
  PasswordForgot(email:String):Boolean
  PasswordReset(password: String, tokenId: String): Boolean
  TokenVerify(tokenId: String): Boolean
  EmailValidate(tokenId: String):Boolean

  ChangePassword(currentPassword:String, newPassword: String): Boolean
}

input UserInput {
  email: String
  password: String
  firstname: String
  lastname: String
}

input SignInInput {
  email: String
  password: String
}

type User {
  id: Int
  email: String
  firstname: String
  lastname: String
  roles: String
  created_at: String
  updated_at: String
  email_verified: Int
}

type XcToken{
  token: String
}
`;
