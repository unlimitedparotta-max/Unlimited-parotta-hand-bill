const PDFDocument = require('pdfkit');
const { SHOP_INFO, PAYMENT_LABELS } = require('../utils/constants');
const { formatAmt, formatDateOnly, formatTimeOnly, numberToWordsIndian } = require('../utils/amountToWords');

/* Generates the downloadable bill PDF entirely in memory (no disk write,
   no storage bucket) — regenerated fresh from the saved order every time
   /bill/:code/pdf is requested, so it always matches the order data. */
function generateBillPdfBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rule = () => { doc.moveTo(left, doc.y).lineTo(left + contentW, doc.y).strokeColor('#cccccc').stroke(); doc.moveDown(0.5); };

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1209').text(SHOP_INFO.name, { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#666666').text(SHOP_INFO.tagline, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#333333');
    SHOP_INFO.addressLines.forEach(l => doc.text(l, { align: 'center' }));
    if (SHOP_INFO.phone) doc.text(`Ph: ${SHOP_INFO.phone}`, { align: 'center' });
    doc.moveDown(0.6);
    rule();

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text('BILL', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Bill No   : ${order.billCode || order.billNo}`);
    doc.text(`Date      : ${formatDateOnly(order.time)}`);
    doc.text(`Time      : ${formatTimeOnly(order.time)}`);
    if (order.note) doc.text(`Table No  : ${order.note}`);
    doc.text(`Cashier   : ${order.servedBy}`);
    doc.text(`Payment   : ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}`);
    if (order.customerName || order.customerMobile) {
      doc.moveDown(0.2);
      if (order.customerName) doc.text(`Customer  : ${order.customerName}`);
      if (order.customerMobile) doc.text(`Mobile    : ${order.customerMobile}`);
    }
    doc.moveDown(0.5);
    rule();

    const col = { sno: left, name: left + 35, qty: left + 300, rate: left + 355, amt: left + 425 };
    const colW = { sno: 35, name: 260, qty: 55, rate: 70, amt: contentW - 425 };
    doc.font('Helvetica-Bold').fontSize(10);
    let y = doc.y;
    doc.text('S.No', col.sno, y, { width: colW.sno });
    doc.text('Item', col.name, y, { width: colW.name });
    doc.text('Qty', col.qty, y, { width: colW.qty, align: 'right' });
    doc.text('Rate', col.rate, y, { width: colW.rate, align: 'right' });
    doc.text('Amount', col.amt, y, { width: colW.amt, align: 'right' });
    doc.moveDown(0.4);
    rule();

    doc.font('Helvetica').fontSize(10);
    order.items.forEach((it, idx) => {
      const rowY = doc.y;
      const nameHeight = doc.heightOfString(it.name, { width: colW.name });
      const rateStr = it.price === 0 ? 'FREE' : formatAmt(it.price);
      const amtStr = it.price === 0 ? 'FREE' : formatAmt(it.price * it.qty);
      doc.text(String(idx + 1), col.sno, rowY, { width: colW.sno });
      doc.text(it.name, col.name, rowY, { width: colW.name });
      doc.text(String(it.qty), col.qty, rowY, { width: colW.qty, align: 'right' });
      doc.text(rateStr, col.rate, rowY, { width: colW.rate, align: 'right' });
      doc.text(amtStr, col.amt, rowY, { width: colW.amt, align: 'right' });
      doc.y = rowY + Math.max(nameHeight, 14) + 4;
    });
    doc.moveDown(0.3);
    rule();

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Sub Total : ${formatAmt(order.total)}`, { align: 'right' });
    doc.fontSize(14);
    doc.text(`GRAND TOTAL : ${formatAmt(order.total)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555');
    doc.text(`(${numberToWordsIndian(order.total)})`, { align: 'center' });
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Thank You! Visit Again!', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateBillPdfBuffer };
