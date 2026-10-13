/**
 * Jira Cloud issue creation for "didn't get the answer I need" flow.
 * Tickets live in JIRA_PROJECT_KEY (e.g. SUP). Each HawkChat event gets an Epic
 * and child tickets get labels for event + notebook.
 *
 * API tokens WITH SCOPES must use api.atlassian.com (set JIRA_SCOPED_TOKEN=true).
 * Classic tokens use your site URL (JIRA_BASE_URL) directly.
 */
export type JiraConfig = {
  /** Site URL for browse links, e.g. https://org.atlassian.net */
  siteUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
  epicIssueType: string;
  /** Scoped API tokens need api.atlassian.com/ex/jira/{cloudId} */
  scoped: boolean;
  cloudId: string | null;
};

export function getJiraConfig(): JiraConfig | null {
  const siteUrl = process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL?.trim();
  const apiToken = process.env.JIRA_API_TOKEN?.trim();
  const projectKey = process.env.JIRA_PROJECT_KEY?.trim().toUpperCase();
  const issueType = process.env.JIRA_ISSUE_TYPE?.trim() || "Task";
  const epicIssueType = process.env.JIRA_EPIC_ISSUE_TYPE?.trim() || "Epic";
  const scopedEnv = process.env.JIRA_SCOPED_TOKEN?.trim().toLowerCase();
  // Default to scoped=true — Atlassian often only offers "API token with scopes" now.
  const scoped = scopedEnv !== "false" && scopedEnv !== "0";
  const cloudId = process.env.JIRA_CLOUD_ID?.trim() || null;

  if (!siteUrl || !email || !apiToken || !projectKey) return null;
  return {
    siteUrl,
    email,
    apiToken,
    projectKey,
    issueType,
    epicIssueType,
    scoped,
    cloudId,
  };
}

export function isJiraConfigured(): boolean {
  return getJiraConfig() !== null;
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

function jiraHeaders(config: JiraConfig): HeadersInit {
  return {
    Authorization: authHeader(config.email, config.apiToken),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** Resolve cloudId for scoped tokens (cached per process). */
let cachedCloudId: string | null = null;

async function resolveCloudId(config: JiraConfig): Promise<string> {
  if (config.cloudId) return config.cloudId;
  if (cachedCloudId) return cachedCloudId;

  const res = await fetch(`${config.siteUrl}/_edge/tenant_info`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as { cloudId?: string };
  if (!res.ok || !data.cloudId) {
    throw new Error(
      "Could not resolve Jira cloudId for a scoped API token. Set JIRA_CLOUD_ID in .env (from Atlassian admin / tenant info).",
    );
  }
  cachedCloudId = data.cloudId;
  return data.cloudId;
}

/** Base URL for REST calls (scoped vs classic token). */
async function getApiBaseUrl(config: JiraConfig): Promise<string> {
  if (!config.scoped) return config.siteUrl;
  const cloudId = await resolveCloudId(config);
  return `https://api.atlassian.com/ex/jira/${cloudId}`;
}

/** Jira labels: lowercase, hyphens, no spaces. */
export function toJiraLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Atlassian Document Format from plain text (supports newlines). */
function textToAdf(text: string) {
  const paragraphs = text.split(/\n+/).filter((p) => p.length > 0);
  const content =
    paragraphs.length > 0
      ? paragraphs.map((p) => ({
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: p.slice(0, 4000) }],
        }))
      : [
          {
            type: "paragraph" as const,
            content: [{ type: "text" as const, text: "(no details)" }],
          },
        ];

  return {
    type: "doc" as const,
    version: 1 as const,
    content,
  };
}

type JiraErrorBody = {
  id?: string;
  key?: string;
  errorMessages?: string[];
  errors?: Record<string, string>;
};

function formatJiraError(data: JiraErrorBody, status: number): string {
  return (
    data.errorMessages?.join("; ") ||
    (data.errors ? Object.values(data.errors).join("; ") : null) ||
    `Jira request failed (${status})`
  );
}

async function createIssueRaw(
  config: JiraConfig,
  fields: Record<string, unknown>,
): Promise<{ key: string; id: string }> {
  const apiBase = await getApiBaseUrl(config);
  const res = await fetch(`${apiBase}/rest/api/3/issue`, {
    method: "POST",
    headers: jiraHeaders(config),
    body: JSON.stringify({ fields }),
  });
  const data = (await res.json().catch(() => ({}))) as JiraErrorBody;
  if (!res.ok || !data.key) {
    throw new Error(formatJiraError(data, res.status));
  }
  return { key: data.key, id: data.id ?? "" };
}

/**
 * Find an existing Epic for this HawkChat event (by label), or create one.
 * Epic summary = event title (e.g. "FIFA World Cup 2026").
 */
export async function findOrCreateEventEpic(opts: {
  eventSlug: string;
  eventTitle: string;
}): Promise<{ key: string; id: string; created: boolean } | null> {
  const config = getJiraConfig();
  if (!config) return null;

  const slug = opts.eventSlug.trim().toLowerCase();
  if (!slug) return null;

  const eventLabel = toJiraLabel(`event-${slug}`);
  const markerLabel = "hawkchat-event";
  const jql =
    `project = "${config.projectKey}" AND issuetype = "${config.epicIssueType}" ` +
    `AND labels = "${eventLabel}" ORDER BY created ASC`;

  const apiBase = await getApiBaseUrl(config);
  const searchUrl =
    `${apiBase}/rest/api/3/search?` +
    new URLSearchParams({
      jql,
      maxResults: "1",
      fields: "key,summary",
    }).toString();

  const searchRes = await fetch(searchUrl, {
    headers: jiraHeaders(config),
  });
  const searchData = (await searchRes.json().catch(() => ({}))) as {
    issues?: Array<{ id?: string; key?: string }>;
    errorMessages?: string[];
  };

  if (searchRes.ok && searchData.issues?.[0]?.key) {
    return {
      key: searchData.issues[0].key,
      id: searchData.issues[0].id ?? "",
      created: false,
    };
  }

  const title =
    opts.eventTitle.trim() ||
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const epic = await createIssueRaw(config, {
    project: { key: config.projectKey },
    summary: title.slice(0, 255),
    description: textToAdf(
      [
        "HawkChat project space Epic.",
        `Event slug: ${slug}`,
        "Child tickets are support requests raised from notebooks in this space.",
      ].join("\n"),
    ),
    issuetype: { name: config.epicIssueType },
    labels: [markerLabel, eventLabel, "hawkchat"],
  });

  return { ...epic, created: true };
}

export type CreateJiraIssueInput = {
  summary: string;
  description: string;
  eventSlug?: string | null;
  eventTitle?: string | null;
  notebookId?: string | null;
  notebookTitle?: string | null;
};

export type CreateJiraIssueResult = {
  key: string;
  id: string;
  url: string;
  epicKey: string | null;
  labels: string[];
};

/** Create a Jira issue under the event Epic (when known), with organization labels. */
export async function createJiraIssue(
  input: CreateJiraIssueInput,
): Promise<CreateJiraIssueResult> {
  const config = getJiraConfig();
  if (!config) {
    throw new Error(
      "Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY in .env.",
    );
  }

  const summary =
    input.summary.trim().slice(0, 255) || "HawkChat support request";

  const labels = new Set<string>(["hawkchat"]);
  const eventSlug = input.eventSlug?.trim().toLowerCase() || "";
  const notebookId = input.notebookId?.trim() || "";
  const notebookTitle = input.notebookTitle?.trim() || "";

  if (eventSlug) {
    labels.add(toJiraLabel(`event-${eventSlug}`));
  }
  if (notebookId) {
    labels.add(toJiraLabel(`notebook-${notebookId}`));
  }
  if (notebookTitle) {
    labels.add(toJiraLabel(notebookTitle));
  }

  let epicKey: string | null = null;
  if (eventSlug) {
    try {
      const epic = await findOrCreateEventEpic({
        eventSlug,
        eventTitle: input.eventTitle?.trim() || "",
      });
      if (epic) epicKey = epic.key;
    } catch (err) {
      console.warn(
        "[HawkChat] Could not find/create Jira Epic for event:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    summary,
    description: textToAdf(input.description),
    issuetype: { name: config.issueType },
    labels: Array.from(labels),
  };

  if (epicKey) {
    fields.parent = { key: epicKey };
  }

  let created: { key: string; id: string };
  try {
    created = await createIssueRaw(config, fields);
  } catch (err) {
    if (epicKey && fields.parent) {
      delete fields.parent;
      created = await createIssueRaw(config, fields);
      console.warn(
        "[HawkChat] Jira parent/Epic link rejected; ticket created with labels only.",
        err instanceof Error ? err.message : err,
      );
    } else {
      throw err;
    }
  }

  return {
    key: created.key,
    id: created.id,
    url: `${config.siteUrl}/browse/${created.key}`,
    epicKey,
    labels: Array.from(labels),
  };
}
