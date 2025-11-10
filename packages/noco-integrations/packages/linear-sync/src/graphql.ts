/**
 * GraphQL queries for Linear API
 */

export const ISSUES_WITH_RELATIONS_QUERY = `
  query IssuesWithRelations($filter: IssueFilter, $first: Int, $after: String, $includeArchived: Boolean) {
    issues(filter: $filter, first: $first, after: $after, includeArchived: $includeArchived) {
      nodes {
        id
        title
        identifier
        description
        dueDate
        priority
        createdAt
        updatedAt
        completedAt
        canceledAt
        state {
          id
          name
          type
        }
        assignee {
          id
          name
          displayName
          email
          createdAt
          updatedAt
        }
        creator {
          id
          name
          displayName
          email
          createdAt
          updatedAt
        }
        labels {
          nodes {
            id
            name
          }
        }
        comments {
          nodes {
            id
            body
            createdAt
            updatedAt
            user {
              id
              name
              displayName
              email
              createdAt
              updatedAt
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
    }
  }
`;

export const TEAM_WITH_MEMBERS_QUERY = `
  query TeamWithMembers($id: String!) {
    team(id: $id) {
      id
      key
      name
      description
      createdAt
      updatedAt
      members {
        nodes {
          id
          name
          displayName
          email
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export const TEAMS_QUERY = `
  query Teams {
    teams {
      nodes {
        id
        key
        name
        description
        createdAt
        updatedAt
      }
    }
  }
`;

