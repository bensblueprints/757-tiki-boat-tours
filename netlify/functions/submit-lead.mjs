import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function generateId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${Date.now()}-${suffix}`;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const data = await req.json();

    // Honeypot check
    if (data.website) {
      return new Response(JSON.stringify({ success: true, id: "ok" }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Validate required fields
    const missing = [];
    if (!data.name || !data.name.trim()) missing.push("name");
    if (!data.phone || !data.phone.trim()) missing.push("phone");
    if (!data.service || !data.service.trim()) missing.push("service");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", fields: missing }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const id = generateId();
    const lead = {
      id,
      name: data.name.trim(),
      email: (data.email || "").trim(),
      phone: data.phone.trim(),
      service: data.service.trim(),
      preferred_date: (data.preferred_date || "").trim(),
      preferred_time: (data.preferred_time || "").trim(),
      message: (data.message || "").trim(),
      status: "new",
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const store = getStore({ name: "leads", consistency: "strong" });
    await store.setJSON(id, lead);

    // Fire notification (non-blocking)
    try {
      const baseUrl = new URL(req.url);
      const notifyUrl = `${baseUrl.origin}/.netlify/functions/send-notification`;
      await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (notifyErr) {
      console.log("Notification dispatch failed (non-critical):", notifyErr.message);
    }

    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error("submit-lead error:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
