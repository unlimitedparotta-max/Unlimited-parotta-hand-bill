const { sendWhatsAppText } = require('./whatsappService');
const { recordDeliveryStatus } = require('./orderService');
const logger = require('../utils/logger');

async function deliverBillViaWhatsApp(order, mobile, baseUrl) {
  try {
    await sendWhatsAppText(
      mobile,
      order.customerName || order.customer || "Customer",
      order.billNo,
      order.billCode
    );

    recordDeliveryStatus(order.billCode, 'whatsapp', 'sent');

    return { ok: true };
  } catch (e) {
    logger.warn(
      `WhatsApp delivery failed for bill ${order.billCode}: ${e.message}`
    );

    recordDeliveryStatus(order.billCode, 'whatsapp', 'failed');

    return {
      ok: false,
      error: e.message
    };
  }
}

module.exports = {
  deliverBillViaWhatsApp
};
