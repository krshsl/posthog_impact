import type { GithubData, PullRequest, IssueEvent, Commit } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(d: number, hour = 12, minute = 0): string {
  const dt = new Date("2026-03-07T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - d);
  dt.setUTCHours(hour, minute, 0, 0);
  return dt.toISOString();
}

function mergedAt(createdIso: string, hoursLater: number): string {
  const d = new Date(createdIso);
  d.setTime(d.getTime() + hoursLater * 3600 * 1000);
  return d.toISOString();
}

function makeCommit(
  sha: string,
  author: string,
  daysBack: number,
  hour: number
): Commit {
  const isWeekend = (() => {
    const d = new Date("2026-03-07T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - daysBack);
    const day = d.getUTCDay();
    return day === 0 || day === 6;
  })();
  const isOffHoursTime = hour < 9 || hour >= 18;
  return {
    sha,
    authored_at: daysAgo(daysBack, hour),
    is_off_hours: isWeekend || isOffHoursTime,
    author,
  };
}

// ─── Contributors ─────────────────────────────────────────────────────────────

const contributors = [
  { login: "mariusandra",   avatar: "https://avatars.githubusercontent.com/u/1308161" },
  { login: "timgl",         avatar: "https://avatars.githubusercontent.com/u/1727427" },
  { login: "pauldambra",    avatar: "https://avatars.githubusercontent.com/u/91489" },
  { login: "macobo",        avatar: "https://avatars.githubusercontent.com/u/427508" },
  { login: "Twixes",        avatar: "https://avatars.githubusercontent.com/u/4550621" },
  { login: "yakkomajuri",   avatar: "https://avatars.githubusercontent.com/u/38760734" },
  { login: "EDsCODE",       avatar: "https://avatars.githubusercontent.com/u/13127476" },
  { login: "neilkakkar",    avatar: "https://avatars.githubusercontent.com/u/7983751" },
  { login: "posthog-bot",   avatar: "https://avatars.githubusercontent.com/u/6131432" }, // bot — should be filtered by pipeline
  { login: "benjackwhite",  avatar: "https://avatars.githubusercontent.com/u/15149443" },
  { login: "fuziontech",    avatar: "https://avatars.githubusercontent.com/u/391319" },
];

// ─── Pull Requests ────────────────────────────────────────────────────────────

let prId = 1;

function pr(
  author: string,
  avatar: string,
  daysBack: number,
  opts: {
    additions?: number;
    deletions?: number;
    cycleHours?: number;
    revisionCycles?: number;
    isBugFix?: boolean;
    legacyFiles?: number;
    commitHours?: number[];
  } = {}
): PullRequest {
  const {
    additions = 200,
    deletions = 80,
    cycleHours = 24,
    revisionCycles = 0,
    isBugFix = false,
    legacyFiles = 0,
    commitHours = [10],
  } = opts;

  const created = daysAgo(daysBack);
  const id = prId++;
  return {
    id,
    number: 10000 + id,
    author,
    avatar_url: avatar,
    title: isBugFix ? `fix: issue in module-${id}` : `feat: new feature ${id}`,
    created_at: created,
    merged_at: mergedAt(created, cycleHours),
    additions,
    deletions,
    revision_cycles: revisionCycles,
    is_bug_fix: isBugFix,
    legacy_files_modified: legacyFiles,
    commits: commitHours.map((h, i) =>
      makeCommit(`sha-${id}-${i}`, author, daysBack, h)
    ),
  };
}

// ─── Build Dataset ────────────────────────────────────────────────────────────

const [
  mariusandra,
  timgl,
  pauldambra,
  macobo,
  twixes,
  yakko,
  eds,
  neil,
  ,          // skip bot
  benj,
  fuzion,
] = contributors;

const pullRequests: PullRequest[] = [
  // mariusandra — high performer: large feature PRs, off-hours grind, fixes legacy
  pr(mariusandra.login, mariusandra.avatar, 85, { additions: 1800, deletions: 400, cycleHours: 18, revisionCycles: 0, isBugFix: false, legacyFiles: 3, commitHours: [7, 21] }),
  pr(mariusandra.login, mariusandra.avatar, 70, { additions: 950, deletions: 200, cycleHours: 12, revisionCycles: 0, isBugFix: false, legacyFiles: 2, commitHours: [19, 22] }),
  pr(mariusandra.login, mariusandra.avatar, 55, { additions: 400, deletions: 100, cycleHours: 8,  revisionCycles: 1, isBugFix: true,  legacyFiles: 0, commitHours: [8] }),
  pr(mariusandra.login, mariusandra.avatar, 40, { additions: 1200, deletions: 300, cycleHours: 20, revisionCycles: 0, isBugFix: false, legacyFiles: 4, commitHours: [20, 23, 6] }),
  pr(mariusandra.login, mariusandra.avatar, 25, { additions: 600, deletions: 150, cycleHours: 10, revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [14] }),
  pr(mariusandra.login, mariusandra.avatar, 10, { additions: 300, deletions: 80,  cycleHours: 6,  revisionCycles: 0, isBugFix: true,  legacyFiles: 1, commitHours: [9] }),

  // timgl — solid mid performer
  pr(timgl.login, timgl.avatar, 80, { additions: 500, deletions: 200, cycleHours: 36, revisionCycles: 1, isBugFix: false, legacyFiles: 1, commitHours: [11] }),
  pr(timgl.login, timgl.avatar, 60, { additions: 800, deletions: 180, cycleHours: 24, revisionCycles: 0, isBugFix: false, legacyFiles: 2, commitHours: [10, 18] }),
  pr(timgl.login, timgl.avatar, 45, { additions: 300, deletions: 60,  cycleHours: 12, revisionCycles: 0, isBugFix: true,  legacyFiles: 0, commitHours: [21] }),
  pr(timgl.login, timgl.avatar, 20, { additions: 700, deletions: 250, cycleHours: 20, revisionCycles: 2, isBugFix: false, legacyFiles: 1, commitHours: [15] }),
  pr(timgl.login, timgl.avatar, 5,  { additions: 200, deletions: 40,  cycleHours: 8,  revisionCycles: 0, isBugFix: true,  legacyFiles: 0, commitHours: [8] }),

  // pauldambra — strong bug fixer, legacy specialist
  pr(pauldambra.login, pauldambra.avatar, 88, { additions: 600, deletions: 500, cycleHours: 30, revisionCycles: 0, isBugFix: true,  legacyFiles: 5, commitHours: [7, 20] }),
  pr(pauldambra.login, pauldambra.avatar, 72, { additions: 400, deletions: 300, cycleHours: 48, revisionCycles: 2, isBugFix: true,  legacyFiles: 4, commitHours: [19] }),
  pr(pauldambra.login, pauldambra.avatar, 50, { additions: 250, deletions: 200, cycleHours: 16, revisionCycles: 0, isBugFix: true,  legacyFiles: 3, commitHours: [22, 6] }),
  pr(pauldambra.login, pauldambra.avatar, 30, { additions: 300, deletions: 100, cycleHours: 12, revisionCycles: 1, isBugFix: false, legacyFiles: 2, commitHours: [11] }),
  pr(pauldambra.login, pauldambra.avatar, 15, { additions: 800, deletions: 200, cycleHours: 22, revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [13] }),

  // macobo — fast cycle times, low churn
  pr(macobo.login, macobo.avatar, 82, { additions: 180, deletions: 80,  cycleHours: 4,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [10] }),
  pr(macobo.login, macobo.avatar, 65, { additions: 320, deletions: 100, cycleHours: 6,  revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [9, 11] }),
  pr(macobo.login, macobo.avatar, 48, { additions: 90,  deletions: 40,  cycleHours: 3,  revisionCycles: 0, isBugFix: true,  legacyFiles: 0, commitHours: [14] }),
  pr(macobo.login, macobo.avatar, 32, { additions: 450, deletions: 120, cycleHours: 8,  revisionCycles: 1, isBugFix: false, legacyFiles: 0, commitHours: [16] }),
  pr(macobo.login, macobo.avatar, 8,  { additions: 200, deletions: 60,  cycleHours: 5,  revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [10] }),

  // twixes — high revision cycles (lower quality signal)
  pr(twixes.login, twixes.avatar, 75, { additions: 400, deletions: 150, cycleHours: 72, revisionCycles: 4, isBugFix: false, legacyFiles: 0, commitHours: [10] }),
  pr(twixes.login, twixes.avatar, 55, { additions: 600, deletions: 200, cycleHours: 60, revisionCycles: 3, isBugFix: false, legacyFiles: 0, commitHours: [14] }),
  pr(twixes.login, twixes.avatar, 35, { additions: 300, deletions: 100, cycleHours: 48, revisionCycles: 2, isBugFix: true,  legacyFiles: 1, commitHours: [11] }),
  pr(twixes.login, twixes.avatar, 12, { additions: 500, deletions: 180, cycleHours: 40, revisionCycles: 5, isBugFix: false, legacyFiles: 0, commitHours: [15] }),

  // yakkomajuri — micro-PR churn (many tiny PRs)
  pr(yakko.login, yakko.avatar, 88, { additions: 20, deletions: 5,   cycleHours: 2,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [10] }),
  pr(yakko.login, yakko.avatar, 85, { additions: 15, deletions: 8,   cycleHours: 1,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [11] }),
  pr(yakko.login, yakko.avatar, 80, { additions: 30, deletions: 10,  cycleHours: 3,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [9] }),
  pr(yakko.login, yakko.avatar, 70, { additions: 25, deletions: 12,  cycleHours: 2,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [14] }),
  pr(yakko.login, yakko.avatar, 60, { additions: 40, deletions: 15,  cycleHours: 4,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [10] }),
  pr(yakko.login, yakko.avatar, 50, { additions: 18, deletions: 6,   cycleHours: 2,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [15] }),
  pr(yakko.login, yakko.avatar, 40, { additions: 22, deletions: 9,   cycleHours: 1,  revisionCycles: 0, isBugFix: true,  legacyFiles: 0, commitHours: [16] }),
  pr(yakko.login, yakko.avatar, 30, { additions: 35, deletions: 11,  cycleHours: 3,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [11] }),

  // EDsCODE — mixed bag
  pr(eds.login, eds.avatar, 78, { additions: 900, deletions: 300, cycleHours: 28, revisionCycles: 1, isBugFix: false, legacyFiles: 2, commitHours: [20, 22] }),
  pr(eds.login, eds.avatar, 58, { additions: 400, deletions: 150, cycleHours: 16, revisionCycles: 0, isBugFix: true,  legacyFiles: 1, commitHours: [8] }),
  pr(eds.login, eds.avatar, 38, { additions: 700, deletions: 250, cycleHours: 32, revisionCycles: 2, isBugFix: false, legacyFiles: 0, commitHours: [14] }),
  pr(eds.login, eds.avatar, 18, { additions: 300, deletions: 100, cycleHours: 18, revisionCycles: 0, isBugFix: false, legacyFiles: 2, commitHours: [21] }),

  // neilkakkar — weekend warrior
  pr(neil.login, neil.avatar, 84, { additions: 600, deletions: 200, cycleHours: 20, revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [10, 15, 20] }),
  pr(neil.login, neil.avatar, 64, { additions: 400, deletions: 130, cycleHours: 14, revisionCycles: 1, isBugFix: false, legacyFiles: 0, commitHours: [8, 22] }),
  pr(neil.login, neil.avatar, 44, { additions: 250, deletions: 90,  cycleHours: 10, revisionCycles: 0, isBugFix: true,  legacyFiles: 2, commitHours: [6, 19] }),
  pr(neil.login, neil.avatar, 24, { additions: 500, deletions: 180, cycleHours: 22, revisionCycles: 0, isBugFix: false, legacyFiles: 1, commitHours: [14] }),
  pr(neil.login, neil.avatar, 4,  { additions: 180, deletions: 50,  cycleHours: 6,  revisionCycles: 0, isBugFix: true,  legacyFiles: 0, commitHours: [9] }),

  // benjackwhite — solid contributor
  pr(benj.login, benj.avatar, 79, { additions: 550, deletions: 200, cycleHours: 24, revisionCycles: 0, isBugFix: false, legacyFiles: 2, commitHours: [10] }),
  pr(benj.login, benj.avatar, 59, { additions: 300, deletions: 100, cycleHours: 12, revisionCycles: 1, isBugFix: true,  legacyFiles: 1, commitHours: [19] }),
  pr(benj.login, benj.avatar, 39, { additions: 700, deletions: 300, cycleHours: 30, revisionCycles: 0, isBugFix: false, legacyFiles: 2, commitHours: [8, 21] }),
  pr(benj.login, benj.avatar, 14, { additions: 200, deletions: 80,  cycleHours: 8,  revisionCycles: 0, isBugFix: false, legacyFiles: 0, commitHours: [10] }),

  // fuziontech — infrequent but impactful
  pr(fuzion.login, fuzion.avatar, 86, { additions: 2000, deletions: 800, cycleHours: 48, revisionCycles: 1, isBugFix: false, legacyFiles: 6, commitHours: [22, 23] }),
  pr(fuzion.login, fuzion.avatar, 42, { additions: 1500, deletions: 600, cycleHours: 36, revisionCycles: 0, isBugFix: false, legacyFiles: 4, commitHours: [20] }),
];

// ─── Issue Events ─────────────────────────────────────────────────────────────

let issueId = 1;

function issueEvent(
  prId: number,
  type: "fixed" | "introduced",
  author: string,
  daysBack: number
): IssueEvent {
  return {
    id: issueId++,
    pr_id: prId,
    type,
    author,
    timestamp: daysAgo(daysBack),
  };
}

const issueEvents: IssueEvent[] = [
  // mariusandra fixes issues introduced by others / self
  issueEvent(3,  "fixed",      mariusandra.login, 55),
  issueEvent(6,  "fixed",      mariusandra.login, 10),
  issueEvent(11, "introduced", pauldambra.login,  88),
  issueEvent(11, "fixed",      mariusandra.login, 85), // marius fixed paul's bug

  // timgl
  issueEvent(9,  "fixed",      timgl.login,  45),
  issueEvent(5,  "introduced", timgl.login,  25),  // timgl introduced a bug

  // pauldambra — bug fixing champion
  issueEvent(12, "fixed",      pauldambra.login, 88),
  issueEvent(13, "fixed",      pauldambra.login, 72),
  issueEvent(14, "fixed",      pauldambra.login, 50),
  issueEvent(7,  "introduced", timgl.login,  80),   // timgl introduced, paul fixed later

  // macobo
  issueEvent(19, "fixed",      macobo.login, 48),
  issueEvent(16, "introduced", macobo.login, 82),

  // twixes introduced bugs
  issueEvent(21, "introduced", twixes.login, 75),
  issueEvent(22, "introduced", twixes.login, 55),

  // yakko — introduced a bug in tiny PR
  issueEvent(32, "introduced", yakko.login, 85),

  // neil fixed / introduced
  issueEvent(38, "fixed",      neil.login, 44),
  issueEvent(40, "fixed",      neil.login, 4),
  issueEvent(39, "introduced", neil.login, 64),

  // benj
  issueEvent(43, "fixed",      benj.login, 59),
  issueEvent(41, "introduced", benj.login, 79),

  // fuzion — introduced one on a massive PR
  issueEvent(45, "introduced", fuzion.login, 86),
];

// ─── Export ───────────────────────────────────────────────────────────────────

export const MOCK_DATA: GithubData = {
  meta: {
    fetched_at: new Date().toISOString(),
    window_days: 90,
  },
  pull_requests: pullRequests,
  issue_events: issueEvents,
};

export function getMockData(): GithubData {
  return MOCK_DATA;
}
