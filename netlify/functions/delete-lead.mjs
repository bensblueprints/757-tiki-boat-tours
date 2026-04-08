import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
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

  if (req.method !== "DELETE") {
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
    const url = new URL(req.url);
    let id = url.searchParams.get("id");

    if (!id) {
      const data = await req.json().catch(() => ({}));
      id = data.id;
    }

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing lead id" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const store = getStore({ name: "leads", consistency: "strong" });
    const existing = await store.get(id, { type: "json" });

    if (!existing) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    // Soft delete: archive
    const archived = {
      ...existing,
      status: "archived",
      updated_at: new Date().toISOString(),
    };

    await store.setJSON(id, archived);

    return new Response(
      JSON.stringify({ success: true, id, status: "archived" }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("delete-lead error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
