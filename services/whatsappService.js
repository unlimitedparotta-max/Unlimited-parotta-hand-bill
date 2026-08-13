const fetch = global.fetch || require("node-fetch");

async function sendWhatsAppText(
  mobile,
  customerName,
  billNumber,
  billCode
) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token || !phoneId) {
    throw new Error("WhatsApp is not configured.");
  }

  const cleanMobile = String(mobile).replace(/\D/g, "");

const recipient = cleanMobile.startsWith("91")
  ? cleanMobile
  : "91" + cleanMobile.replace(/^0+/, "");
  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: "bill_delivery",
      language: {
        code: "en"
      },
      components: [
  {
    type: "header",
    parameters: [
      {
        type: "image",
        image: {
          link: process.env.WHATSAPP_HEADER_IMAGE
        }
      }
    ]
  },
  {
    type: "body",
    parameters: [
      {
        type: "text",
        text: customerName
      },
      {
        type: "text",
        text: String(billNumber)
      },
      
        {
  type: "text",
  text: `${process.env.APP_URL}/bill/${billCode}`
}
      
    ]
  },
  {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [
      {
        type: "text",
        text: billCode
      }
    ]
  }
]
    }
  };

console.log("Recipient:", recipient);
console.log("Customer Name:", customerName);
console.log("Bill Number:", billNumber);
console.log("Bill Code:", billCode);
console.log("Payload:", JSON.stringify(payload, null, 2));

const resp = await fetch(
  `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }
);

  const data = await resp.json().catch(() => ({}));

console.log("HTTP Status:", resp.status);
console.log("Meta API Response:");
console.log(JSON.stringify(data, null, 2));

if (!resp.ok) {
  throw new Error(data.error?.message || "WhatsApp send failed");
}

console.log("WhatsApp sent successfully!");

return data;

  return data;
}

module.exports = { sendWhatsAppText };
