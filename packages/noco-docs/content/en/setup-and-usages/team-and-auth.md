---
title: 'Team & Settings > Team & Auth'
description: 'Breakdown of roles & permissions for team user management'
position: 580
category: 'Product'
menuTitle: 'Team & Settings > Team & Auth'
---

# Accessing Team & Auth 

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


# User Role Permissions

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
