---
title: 'Team & Auth'
description: 'Breakdown of roles & permissions for team user management'
position: 620
category: 'Product'
menuTitle: 'Team & Auth'
---


## How to Add a User
1. On the left panel, click on "Team & Auth":
[](https://user-images.githubusercontent.com/55474996/142497814-c52e12e5-5ab5-41e7-ac48-2b6af5f31fdd.png)

2. Make sure you are on the "Users Management" tab. Click on "New User":  
  
[](https://user-images.githubusercontent.com/55474996/142498070-60c5a861-0e8e-49e9-8830-42f54aa1fbf1.png)
| ![1a](https://user-images.githubusercontent.com/86527202/149292053-e6dfef1e-9627-47a7-98ad-8a3b2f61591b.png) |
| ------ |

3. Enter the person's `EMAIL` 
4. Select `ROLE`
5. Click `Invite`
> You can add multiple comma (,) seperated emails
[](https://user-images.githubusercontent.com/55474996/142498163-032187e4-d375-4542-8211-e986880a2bb0.png)

| ![2 1](https://user-images.githubusercontent.com/86527202/149291166-d28a65b7-195a-4233-97a9-a3c2259c9fc8.png) |
| ------ |

If you do not have an SMTP sender configured, make sure to copy the invite link and manually send it to your collaborator:
[](https://user-images.githubusercontent.com/55474996/142498376-ff52276b-92d8-4aca-8c47-fd7efea50ab6.png)
  
| ![3](https://user-images.githubusercontent.com/86527202/149291202-967f164b-8ddc-4240-a470-ce8b4e0c2d41.png) |
| ------ |
| ![4](https://user-images.githubusercontent.com/86527202/149291223-dfc9e24b-658d-45fb-a0d5-c9773162bfbe.png) |


## Explanation of User Role Permissions

### Advanced options & configurations
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


### Schema options
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |
|	Add table	    | ✅ | ✅ | ❌	| ❌	| ❌	|
|	Delete table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify table	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Add column	  | ✅ | ✅	| ❌	| ❌	| ❌	|
|	Delete column	| ✅	| ✅	| ❌	| ❌	| ❌	|
|	Modify column	| ✅	| ✅	| ❌	| ❌	| ❌	|


### Record options
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

### Project generals
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

### Automations
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |

### App store
| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | &nbsp; &nbsp; Owner &nbsp; &nbsp;| &nbsp; &nbsp; Creator &nbsp; &nbsp; | &nbsp; &nbsp; Editor &nbsp; &nbsp;| Commenter | &nbsp; &nbsp; Viewer &nbsp; &nbsp;|
|    :--   |    :-:   |    :-:   |    :-:   |    :-:   |    :-:   |


