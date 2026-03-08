import { GithubData } from "./types";

export function getMockData(): GithubData {
  return {
    meta: {
      last_fetched_at: new Date().toISOString(),
      earliest_fetched_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
      window_days: 90
    },
    pull_requests: [
      {
        number: 1,
        title: "Initial PR",
        author_login: "mariusandra",
        created_at: new Date().toISOString(),
        merged_at: new Date().toISOString(),
        additions: 100,
        deletions: 20,
        changed_files: 5,
        is_draft: false,
        commits: [
          { oid: "sha1", author_login: "mariusandra", date: new Date().toISOString(), is_off_hours: false }
        ],
        reviews_first_at: new Date().toISOString(),
        issues_fixed: [{ number: 101, author_login: "user", created_at: new Date().toISOString() }],
        bug_introduced_by: null,
        maintenance_score: 10
      }
    ]
  };
}
