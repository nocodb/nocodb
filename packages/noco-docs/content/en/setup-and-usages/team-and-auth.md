---
title: 'Team & Auth'
description: 'Breakdown of roles & permissions for team user management'
position: 630
category: 'Product'
menuTitle: 'Team & Auth'
---

Team & Auth can be found by clicking `Team & Settings` from the left navigation drawer and clicking `Team & Auth`.

![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png)

![image](https://user-images.githubusercontent.com/35857179/161902746-aa59b8e5-06d2-4c07-ac60-c82f92b42752.png)

## How to Add a User

1. Go to `Team & Auth`, click on `New User`.
    ![image](https://user-images.githubusercontent.com/35857179/161903214-1e0f7ba0-6daf-4073-90c9-9d86a40c9f90.png)

2. Enter the user's `E-mail`. Select `User Role`, and Click `Invite`.

    <alert type="success">
        Tip: You can add multiple comma (,) seperated emails
    </alert>

    ![image](https://user-images.githubusercontent.com/35857179/161903296-cd6ea0d5-193f-4e66-aa7a-4cfc468216af.png)

    If you do not have an SMTP sender configured, make sure to copy the invite link and manually send it to your collaborator.

    ![image](https://user-images.githubusercontent.com/35857179/161903764-1c875441-87f4-4b25-a864-441a23c96cea.png)


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
