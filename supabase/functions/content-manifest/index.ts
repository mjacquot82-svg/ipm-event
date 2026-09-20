const STAGING_PROJECT = "https://hooiqjcbcbwzjjvnwyxf.supabase.co";
const STAGING_EVENT_ID = "51000000-0000-4000-8000-000000000001";

type RevisionRow = {
  content_type: "schedule" | "announcements";
  revision: number;
  updated_at: string;
};

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...headers,
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(null, 204, { "access-control-allow-methods": "GET, OPTIONS" });
  }
  if (request.method !== "GET") return response({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || STAGING_PROJECT;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return response({ error: "manifest_unavailable" }, 503);

  const query = new URLSearchParams({
    select: "content_type,revision,updated_at",
    event_id: `eq.${STAGING_EVENT_ID}`,
    content_type: "in.(schedule,announcements)",
    order: "content_type.asc",
  });
  const upstream = await fetch(`${supabaseUrl}/rest/v1/content_revisions?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!upstream.ok) return response({ error: "manifest_unavailable" }, 503);

  const rows = await upstream.json() as RevisionRow[];
  const byType = new Map(rows.map((row) => [row.content_type, row]));
  const schedule = byType.get("schedule");
  const announcements = byType.get("announcements");
  if (!schedule || !announcements) return response({ error: "manifest_incomplete" }, 503);

  const body = {
    environment: "staging",
    event: "ipm-staging",
    schedule: { revision: schedule.revision, updatedAt: schedule.updated_at },
    announcements: { revision: announcements.revision, updatedAt: announcements.updated_at },
  };
  const etag = `\"staging-ipm-staging-s${schedule.revision}-a${announcements.revision}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "cache-control": "public, max-age=30, stale-while-revalidate=30",
        etag,
      },
    });
  }
  return response(body, 200, {
    "cache-control": "public, max-age=30, stale-while-revalidate=30",
    etag,
  });
});
