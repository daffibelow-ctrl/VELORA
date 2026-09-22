import crypto from "crypto";

const BASE = "https://api.xendit.co";

function authHeader() {
  if (!process.env.XENDIT_SECRET_KEY) {
    throw new Error("XENDIT_SECRET_KEY is not configured");
  }
  return "Basic " + Buffer.from(process.env.XENDIT_SECRET_KEY + ":").toString("base64");
}

async function xendit(path, options={}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const error = new Error(data.message || "Xendit API request failed");
    error.status = response.status;
    error.provider = data;
    throw error;
  }
  return data;
}

/*
  Creates a Xendit payment request for a marketplace transaction.

  For a real multi-seller deployment:
  - Each seller must be onboarded/verified as a xenPlatform sub-account.
  - Store the provider sub-account user ID on the seller/store record.
  - Apply a provider-side split rule or routing rule.
  - Do not trust price, seller ID, or fee values from the browser.
*/
export async function createPayment({
  referenceId,
  amount,
  channelCode,
  forUserId,
  splitRuleId
}) {
  const headers = {
    "api-version": process.env.XENDIT_API_VERSION || "2024-11-11"
  };

  if (forUserId) headers["for-user-id"] = forUserId;
  if (splitRuleId) headers["with-split-rule"] = splitRuleId;

  return xendit("/v3/payment_requests", {
    method: "POST",
    headers,
    body: JSON.stringify({
      reference_id: referenceId,
      type: "PAY",
      country: "ID",
      currency: "IDR",
      request_amount: amount,
      capture_method: "AUTOMATIC",
      channel_code: channelCode
    })
  });
}

export function verifyWebhookToken(token) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN || "";
  if (!token || !expected) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  );
}
