import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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
    const lead = await req.json();
    const businessName = process.env.BUSINESS_NAME || "757 Tiki Boat Tours";
    const notificationEmail = process.env.NOTIFICATION_EMAIL;
    const mailgunApiKey = process.env.MAILGUN_API_KEY;
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const siteUrl = process.env.URL || "https://757tikiboattours.netlify.app";

    const notification = {
      id: `notif-${Date.now()}`,
      lead_id: lead.id || "unknown",
      lead_name: lead.name || "Unknown",
      lead_phone: lead.phone || "",
      lead_email: lead.email || "",
      lead_service: lead.service || "",
      sent_via: "log",
      created_at: new Date().toISOString(),
    };

    // Attempt Mailgun email if configured
    if (notificationEmail && mailgunApiKey && mailgunDomain) {
      try {
        const adminLink = `${siteUrl}/admin`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #c9a96e; padding-bottom: 10px;">
              New Lead — ${businessName}
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px 12px; font-weight: bold; color: #555;">Name</td><td style="padding: 8px 12px;">${lead.name || "N/A"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px 12px; font-weight: bold; color: #555;">Phone</td><td style="padding: 8px 12px;">${lead.phone || "N/A"}</td></tr>
              <tr><td style="padding: 8px 12px; font-weight: bold; color: #555;">Email</td><td style="padding: 8px 12px;">${lead.email || "N/A"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px 12px; font-weight: bold; color: #555;">Service</td><td style="padding: 8px 12px;">${lead.service || "N/A"}</td></tr>
              <tr><td style="padding: 8px 12px; font-weight: bold; color: #555;">Preferred Date</td><td style="padding: 8px 12px;">${lead.preferred_date || "N/A"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px 12px; font-weight: bold; color: #555;">Preferred Time</td><td style="padding: 8px 12px;">${lead.preferred_time || "N/A"}</td></tr>
              <tr><td style="padding: 8px 12px; font-weight: bold; color: #555;">Message</td><td style="padding: 8px 12px;">${lead.message || "None"}</td></tr>
            </table>
            <a href="${adminLink}" style="display: inline-block; background: #c9a96e; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              View in Admin Panel
            </a>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              Submitted ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}
            </p>
          </div>
        `;

        const formData = new URLSearchParams();
        formData.append("from", `${businessName} <leads@${mailgunDomain}>`);
        formData.append("to", notificationEmail);
        formData.append("subject", `New Lead: ${lead.name || "Unknown"} — ${lead.service || "General"}`);
        formData.append("html", emailHtml);

        const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`api:${mailgunApiKey}`).toString("base64"),
          },
          body: formData,
        });

        if (response.ok) {
          notification.sent_via = "mailgun";
          console.log(`Email notification sent to ${notificationEmail}`);
        } else {
          const errText = await response.text();
          console.error("Mailgun error:", response.status, errText);
          notification.sent_via = "log_mailgun_failed";
        }
      } catch (emailErr) {
        console.error("Email send failed:", emailErr.message);
        notification.sent_via = "log_email_error";
      }
    } else {
      console.log("No email config — logging notification.");
      console.log(`New lead: ${lead.name} | ${lead.phone} | ${lead.service}`);
    }

    // Store notification record
    const notifStore = getStore("notifications");
    await notifStore.setJSON(notification.id, notification);

    return new Response(
      JSON.stringify({ success: true, notification_id: notification.id }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
