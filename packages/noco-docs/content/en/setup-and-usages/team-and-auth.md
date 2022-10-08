---
title: 'Team & Auth'
description: 'Breakdown of roles & permissions for team user management'
position: 630
category: 'Product'
menuTitle: 'Team & Auth'
---

## Accessing Team & Auth 
- Click on `Team & Settings` from the `Project Menu` 
- Access `Team & Auth` under `Settings`
  
<img width="322" alt="image" src="https://user-images.githubusercontent.com/35857179/194856648-67936db0-ee4d-4060-be3d-af9f86ef8fc6.png">

## How to Add a User

1. Go to `Team & Auth`, click on `Invite Team`

<img width="1336" alt="image" src="https://user-images.githubusercontent.com/35857179/194849838-f936128a-3f8a-46ef-a4e3-fdc14b633874.png">

2. Enter the user's `E-mail`. Select `User Role`, and Click `Invite`.

    <alert type="success">
        Tip: You can add multiple comma (,) seperated emails
    </alert>

![Screenshot 2022-09-13 at 10 54 39 AM](https://user-images.githubusercontent.com/86527202/189817152-83fca866-7713-49ee-8068-d3eba1311353.png)

If you do not have an SMTP sender configured, make sure to copy the invite link and manually send it to your collaborator.
    
![Screenshot 2022-09-13 at 10 54 22 AM](https://user-images.githubusercontent.com/86527202/189817156-f3dab634-dc25-4f9b-8126-865187aae254.png)


## How to Update user permissions

1. Use `Edit` <1> menu to assign a different role to existing user
2. Use `Delete` <2> menu to remove a user from accessing current project
  
![Screenshot 2022-09-13 at 11 06 16 AM](https://user-images.githubusercontent.com/86527202/189818302-80a05245-9dc1-4364-b380-7bd698e5b9e0.png)


------


## OpenID Connect authentication

OpenID Connect (OIDC) is a simple identity layer built on top of the OAuth 2.0 protocol, which allows clients to verify the identity of an end-user based on the authentication performed by an authorization server or an identity provider (IdP), as well as to obtain basic profile information about the end-user.

### User provisioning

Unlike the Google login which requires a local user account to exist in advance, OIDC users are created automatically when they log in for the first time. It is important that you only assigned the users you wish to access in the application configured in your IdP.

You may still use the users invivation to create an account for a user in advance, provided the email matches the user's email in your IdP.

### Setup

In your IdP, create a new application and register the allowed callback URL to be NocoDb's dashboard URL (e.g., `http://localhost:8000/dashboard`).

Configure the following environment variables in your NocoDb instance (you could use `<Issuer URL>/.well-known/openid-configuration` to find the values):

![OpenID Configuration JSON](https://user-images.githubusercontent.com/679761/194699139-65ad6c5b-fbce-48fa-8494-db58068e18a9.png)

- `NC_OIDC_ISSUER`: The issuer URL. (`issuer`)
- `NC_OIDC_AUTH_URL`: The authorization endpoint. (`authorization_endpoint`)
- `NC_OIDC_TOKEN_URL`: The token exchange endpoint. (`token_endpoint`)
- `NC_OIDC_USERINFO_URL`: The userinfo endpoint. (`device_authorization_endpoint`)
- `NC_OIDC_CLIENT_ID`: the application's client id.
- `NC_OIDC_CLIENT_SECRET`: the application's client secret.

### Customization

If you want to write your IdP's name instead of `Your Identity Provider`, set the `NC_OIDC_DISPLAY_NAME` environment variable.

### IdP Configuration Examples

#### Auth0

Create a new *Regular Web Applications* application:

![Auth0 application creation](https://user-images.githubusercontent.com/679761/194699261-151bd274-a771-48ed-9024-4a1fde26f7df.png)

In the **Settings** tab, take a note of the *Domain* as `NC_OIDC_ISSUER`, *Client ID* as `NC_OIDC_CLIENT_ID` and *Client Secret* as `NC_OIDC_CLIENT_SECRET`:

![Auth0 application values](https://user-images.githubusercontent.com/679761/194699258-2d4df10f-a7e7-4645-a91a-d3c55c5e5f1b.png)

Using the `openid-coniguration` url from above, fill `NC_OIDC_AUTH_URL`, `NC_OIDC_TOKEN_URL` and `NC_OIDC_USERINFO_URL` as well.

Under the *Application URIs* section, add your dashboard URL in *Allowed Callback URLs*:

![Auth0 callback URLs](https://user-images.githubusercontent.com/679761/194699256-4a5f61d8-00be-4d7f-98d7-4845378bd197.png)


------


## User Role Permissions

### Advanced Options & Configurations
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
| Audit	                  | ✅ | ✅ | ❌ | ❌	| ❌ |
| App Store	              | ✅	| ❌ | ❌ | ❌	| ❌ |
| Team & Auth	            | ✅	| ❌ | ❌ | ❌	| ❌ |
| Project Metadata	      | ✅	| ❌ | ❌ | ❌	| ❌ |
| New user: Add Owner	    | ✅	| ❌ | ❌ | ❌	| ❌ |
| New user: Add Creator	  | ✅	| ❌ | ❌ | ❌	| ❌ |
| New user: Add Editor	  | ✅	| ✅	| ❌	| ❌ | ❌ |
| New user: Add Commenter	| ✅	| ✅	| ❌	| ❌ | ❌ |
| New user: Add Viewer	  | ✅	| ✅	| ❌	| ❌ | ❌ |
| View existing users	    | ✅	| ✅	| ❌	| ❌ | ❌ |
| Preview mode	          | ✅	| ✅	| ❌	| ❌ | ❌ |


### Schema Options
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add table	    | ✅ | ✅ | ❌	| ❌	| ❌	|
|	Delete table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Add column	  | ✅ | ✅	| ❌	| ❌	| ❌	|
|	Delete column	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify column	| ✅	| ✅	| ❌	| ❌	| ❌	|


### Record Options
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add row	          | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Delete row	      | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Modify row/ cell	| ✅	| ✅	| ✅	| ❌	| ❌	|
|	Expand row	      | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Right click on cell (add/edit row)	| ✅	| ✅	| ✅	| ❌	| ❌	|
|	View table data (cell) contents	    | ✅	| ✅	| ✅	| ✅	| ✅	|

### Comments
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	View comments from others	| ✅	| ✅	| ✅	| ✅	| ❌	|
|	Add comments	            | ✅	| ✅	| ✅	| ✅	| ❌	|

### Views
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Create new view	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Share view	    | ✅	| ✅	| ❌	| ❌	| ❌	|

### Project Generals
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Created views access	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Filter fields/ Column	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Filter fields/ Query	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Sort fields	          | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Theme	                | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Auth token	          | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Project Info	        | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Swagger API	          | ✅	| ✅	| ✅	| ✅	| ✅	|


<!-- TODO: -->
<!-- ### Automations
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |

### App store
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |

 -->
