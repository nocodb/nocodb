---
title: 'User Management - Team & Auth Roles & Permissions'
description: 'Breakdown of roles & permissions for team user management'
position: 44
category: 'Usage'
menuTitle: 'User Management - Team & Auth Roles & Permissions'
---


## How to Add a User
On the left panel, click on "Team & Auth":
![image](https://user-images.githubusercontent.com/55474996/142497814-c52e12e5-5ab5-41e7-ac48-2b6af5f31fdd.png)

Make sure you are on the "Users Management" tab. Click on "New User":
![image](https://user-images.githubusercontent.com/55474996/142498070-60c5a861-0e8e-49e9-8830-42f54aa1fbf1.png)

Enter the person's email, select their user role, and hit "Invite":
![image](https://user-images.githubusercontent.com/55474996/142498163-032187e4-d375-4542-8211-e986880a2bb0.png)

If you do not have an SMTP sender configured, make sure to copy the invite link and manually send it to your collaborator:
![image](https://user-images.githubusercontent.com/55474996/142498376-ff52276b-92d8-4aca-8c47-fd7efea50ab6.png)


## Explanation of User Role Permissions

### Advanced options & configurations
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
| Audit	                  | ✅ | ✅ | ✅ | ✅	| ✅ |
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
| SQL Client	            | ✅	| ✅	| ✅	| ❌ | ❌ |

### Schema options
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add table	    | ✅ | ✅ | ❌	| ❌	| ❌	|
|	Delete table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Add column	  | ✅ | ✅	| ❌	| ❌	| ❌	|
|	Delete column	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify column	| ✅	| ✅	| ❌	| ❌	| ❌	|


### Record options
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add row	          | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Delete row	      | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Modify row/ cell	| ✅	| ✅	| ✅	| ❌	| ❌	|
|	Expand row	      | ✅	| ✅	| ✅	| ❌	| ❌	|
|	Right click on cell (add/edit row)	| ✅	| ✅	| ✅	| ❌	| ❌	|
|	View table data (cell) contents	    | ✅	| ✅	| ✅	| ✅	| ✅	|

### Comments
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	View comments from others	| ✅	| ✅	| ✅	| ✅	| ❌	|
|	Add comments	            | ✅	| ✅	| ✅	| ✅	| ❌	|

### Views
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Create new view	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Share view	    | ✅	| ✅	| ❌	| ❌	| ❌	|

### Project generals
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Created views access	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Filter fields/ Column	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Filter fields/ Query	| ✅	| ✅	| ✅	| ✅	| ✅	|
|	Sort fields	          | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Theme	                | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Auth token	          | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Project Info	        | ✅	| ✅	| ✅	| ✅	| ✅	|
|	Swagger API	          | ✅	| ✅	| ✅	| ✅	| ✅	|

### Automations
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |

### App store
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |


