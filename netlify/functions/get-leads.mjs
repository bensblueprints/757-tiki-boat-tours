import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function authorize(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === adminPassword;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  if (!authorize(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  try {
    const store = getStore({ name: "leads", consistency: "strong" });
    const { blobs } = await store.list();

    const leads = [];
    for (const blob of blobs) {
      try {
        const lead = await store.get(blob.key, { type: "json" });
        if (lead) leads.push(lead);
      } catch (e) {
        console.warn(`Failed to read lead ${blob.key}:`, e.message);
      }
    }

    // Filter by status if query param provided
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    let filtered = leads;
    if (status && status !== "all") {
      filtered = leads.filter((l) => l.status === status);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return new Response(
      JSON.stringify({ leads: filtered, total: filtered.length }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("get-leads error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
