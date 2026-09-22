const BASE = "https://api.xendit.co";

function authHeader() {
  return "Basic " + Buffer.from(process.env.XENDIT_SECRET_KEY + ":").toString("base64");
}

/*
  Provider-side payout implementation should be completed against the exact
  Xendit account/transfer product enabled for your merchant account.
  Never mark a payout SUCCESS merely because the HTTP request was accepted.
  Use provider status/webhooks and an idempotency/reference ID.
*/
export async function createPayout({reference, amount, channelProperties}) {
  const response = await fetch(BASE + "/v2/payouts", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":authHeader(),
      "Idempotency-key":reference
    },
    body: JSON.stringify({
      reference_id: reference,
      channel_properties: channelProperties,
      amount,
      currency:"IDR",
      channel_code: channelProperties.channel_code
    })
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const e=new Error(data.message||"Payout provider request failed");
    e.status=response.status;
    e.provider=data;
    throw e;
  }
  return data;
}
