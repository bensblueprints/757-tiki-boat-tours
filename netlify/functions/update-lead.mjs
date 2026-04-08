import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Content-Type": "application/json",
};

const VALID_STATUSES = ["new", "contacted", "booked", "closed", "archived"];

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

  if (req.method !== "PUT") {
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
    const data = await req.json();

    if (!data.id) {
      return new Response(JSON.stringify({ error: "Missing lead id" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    if (data.status && !VALID_STATUSES.includes(data.status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status", valid: VALID_STATUSES }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const store = getStore({ name: "leads", consistency: "strong" });
    const existing = await store.get(data.id, { type: "json" });

    if (!existing) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const updated = {
      ...existing,
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updated_at: new Date().toISOString(),
    };

    await store.setJSON(data.id, updated);

    return new Response(JSON.stringify({ success: true, lead: updated }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error("update-lead error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
