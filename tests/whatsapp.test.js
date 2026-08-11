const { test } = require('node:test');
const assert = require('node:assert');
const { sendWhatsAppText } = require('../services/whatsappService');
const { buildBillWhatsAppMessage } = require('../services/billService');

test('sendWhatsAppText throws a clear setup error when env vars are missing', async () => {
  const savedToken = process.env.WHATSAPP_TOKEN;
  const savedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  await assert.rejects(
    () => sendWhatsAppText('9876543210', 'test'),
    /not set up yet/
  );
  if (savedToken) process.env.WHATSAPP_TOKEN = savedToken;
  if (savedPhoneId) process.env.WHATSAPP_PHONE_NUMBER_ID = savedPhoneId;
});

test('buildBillWhatsAppMessage matches the approved template shape', () => {
  const order = { billNo: 1, billCode: 'UP260802A1B2C3', total: 190, time: new Date().toISOString() };
  const message = buildBillWhatsAppMessage(order, 'https://example.com');
  assert.match(message, /UP260802A1B2C3/);
  assert.match(message, /₹190\.00/);
  assert.match(message, /https:\/\/example\.com\/bill\/UP260802A1B2C3/);
  assert.match(message, /Thank you for visiting/);
});
