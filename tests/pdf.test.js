const { test } = require('node:test');
const assert = require('node:assert');
const { generateBillPdfBuffer } = require('../services/pdfService');

const sampleOrder = {
  billNo: 1, billCode: 'UPTEST0001', menuKey: 'unlimited',
  note: 'T1', customerName: 'Test', customerMobile: '9876543210',
  items: [{ id: 'p1', name: 'Unlimited Parotta', price: 99, qty: 1 }],
  total: 99, time: new Date().toISOString(), servedBy: 'Admin', paymentMethod: 'cash'
};

test('generateBillPdfBuffer produces a real PDF', async () => {
  const buffer = await generateBillPdfBuffer(sampleOrder);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 500, 'PDF should not be suspiciously tiny');
  assert.strictEqual(buffer.slice(0, 4).toString(), '%PDF', 'file should start with the PDF magic bytes');
});
