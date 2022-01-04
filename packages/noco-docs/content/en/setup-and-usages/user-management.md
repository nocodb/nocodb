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
| Audit	| :white_check_mark: 	| :white_check_mark: 	| :white_check_mark: 	| :white_check_mark: 	| :white_check_mark: |
| App Store	| :white_check_mark: 	| :x: 	| :x: 	| :x: 	| :x: |
| Team & Auth	| :white_check_mark: 	| :x: 	| :x: 	| :x: 	| :x: |
| Project Metadata	| :white_check_mark: 	| :x: 	| :x: 	| :x: 	| :x: |
| New user: Add Owner	| :white_check_mark: 	| :x: 	| :x: 	| :x: 	| :x: |
| New user: Add Creator	| :white_check_mark: 	| :x: 	| :x: 	| :x: 	| :x: |
| New user: Add Editor	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: 	| :x: |
| New user: Add Commenter	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: 	| :x: |
| New user: Add Viewer	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: 	| :x: |
| View existing users	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: 	| :x: |
| Preview mode	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: 	| :x: |
| SQL Client	| :white_check_mark: 	| :white_check_mark: 	| :white_check_mark: 	| :x: 	| :x: |

### Schema options
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add table	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Delete table	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Modify table	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Add column	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Delete column	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Modify column	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|


### Record options
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add row	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	|
|	Delete row	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	|
|	Modify row/ cell	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	|
|	Expand row	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	|
|	Right click on cell (add/edit row)	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	|
|	View table data (cell) contents	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|

### Comments
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	View comments from others	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	|
|	Add comments	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :x:	|

### Views
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Create new view	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|
|	Share view	| :white_check_mark:	| :white_check_mark:	| :x:	| :x:	| :x:	|

### Project generals
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Created views access	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Filter fields/ Column	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Filter fields/ Query	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Sort fields	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Theme	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Auth token	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Project Info	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|
|	Swagger API	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	| :white_check_mark:	|

### Automations
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |

### App store
|  | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |


