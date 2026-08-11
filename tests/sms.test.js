const { test } = require('node:test');
const assert = require('node:assert');
const { sendSmsViaMsg91 } = require('../services/smsService');

test('sendSmsViaMsg91 throws a clear setup error when env vars are missing', async () => {
  const savedKey = process.env.MSG91_AUTH_KEY;
  const savedSender = process.env.MSG91_SENDER_ID;
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.MSG91_SENDER_ID;
  await assert.rejects(
    () => sendSmsViaMsg91('9876543210', 'test'),
    /not set up yet/
  );
  if (savedKey) process.env.MSG91_AUTH_KEY = savedKey;
  if (savedSender) process.env.MSG91_SENDER_ID = savedSender;
});
