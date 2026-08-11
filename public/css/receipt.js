/* =========================================================
   Unlimited Parotta — Thermal Receipt Printer
   File: receipt.js

   Usage:
     printReceipt(order);

   Expected order object:
     {
       billNo: 1,
       billCode: "UPB2608110001", // optional
       menuKey: "unlimited" | "bar",
       time: new Date().toISOString(),
       note: "Table 5",             // optional
       servedBy: "Unlimited Staff",
       paymentMethod: "cash" | "gpay",
       customerName: "Customer",    // optional
       customerMobile: "9876543210",// optional
       total: 250,
       items: [
         { name: "Plain Parotta", qty: 2, price: 20 },
         { name: "Veg Kuruma", qty: 1, price: 0 }
       ]
     }

   Paper:
     setReceiptPaperWidth(80); // 80mm
     setReceiptPaperWidth(58); // 58mm
========================================================= */

/* Main function */
function printReceipt(order) {
  if (!order) {
    console.error('printReceipt: order is required');
    return;
  }

  const printWindow = window.open(
    '',
    '_blank',
    'width=420,height=700'
  );

  if (!printWindow) {
    alert('Please allow pop-ups for printing the receipt.');
    return;
  }

  const paper = RECEIPT_PAPER_WIDTH === 58 ? 58 : 80;

  const shop = RECEIPT_SHOP;

  const payment =
    String(order.paymentMethod || '').toLowerCase() === 'gpay'
      ? 'GPay / UPI'
      : 'Cash';

  const total = Number(order.total || 0);

  const itemsHTML = (order.items || [])
    .map(item => {
      const name = String(item.name || 'Item');
      const qty = Number(item.qty || 0);

      const amount =
        Number(item.price || 0) === 0
          ? 'FREE'
          : receiptMoney(
              Number(item.price || 0) * qty
            );

      return `
        <div class="item-row">
          <div class="item-name">${escapeReceiptHTML(name)}</div>
          <div class="item-qty">${qty}</div>
          <div class="item-amount">${amount}</div>
        </div>
      `;
    })
    .join('');

  const customerHTML =
    order.customerName || order.customerMobile
      ? `
        <div class="divider"></div>

        <div class="detail-row">
          <span class="label">Customer</span>
          <span class="value">
            ${escapeReceiptHTML(order.customerName || '-')}
          </span>
        </div>

        ${
          order.customerMobile
            ? `
              <div class="detail-row">
                <span class="label">Mobile</span>
                <span class="value">
                  +91 ${escapeReceiptHTML(order.customerMobile)}
                </span>
              </div>
            `
            : ''
        }
      `
      : '';

  printWindow.document.open();

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<title>
  Unlimited Parotta - ${escapeReceiptHTML(receiptBillCode(order))}
</title>

<style>

@page {
  size: ${paper}mm auto;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: ${paper}mm;
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: #000000;
  font-size: ${paper === 58 ? '9px' : '10px'};
  line-height: 1.25;
  font-weight: 500;
}

/* RECEIPT */

#receipt {
  width: ${paper}mm;
  padding: 2mm 3mm 1mm 3mm;
  margin: 0;
}

/* HEADER */

.header {
  text-align: center;
}

.shop-name {
  font-size: ${paper === 58 ? '15px' : '17px'};
  font-weight: 800;
  line-height: 1.15;
}

.tagline {
  font-size: ${paper === 58 ? '8px' : '9px'};
  margin-top: 1px;
}

.address {
  font-size: ${paper === 58 ? '8px' : '9px'};
  line-height: 1.3;
  margin-top: 3px;
}

/* BILL TITLE */

.bill-title {
  text-align: center;
  font-size: ${paper === 58 ? '12px' : '14px'};
  font-weight: 800;
  margin: 3px 0;
}

/* DIVIDER */

.divider {
  border-top: 1px dashed #000;
  margin: 3px 0;
}

/* BILL DETAILS */

.detail-row {
  display: flex;
  width: 100%;
  margin: 1px 0;
  gap: 4px;
}

.label {
  flex: 0 0 38%;
  text-align: left;
}

.value {
  flex: 1;
  text-align: right;
  overflow-wrap: anywhere;
}

/* ITEMS */

.items-header,
.item-row {
  display: flex;
  width: 100%;
  align-items: center;
}

.items-header {
  font-weight: 800;
  margin-bottom: 2px;
}

.item-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding-right: 3px;
  overflow-wrap: anywhere;
}

.item-qty {
  flex: 0 0 12%;
  text-align: center;
}

.item-amount {
  flex: 0 0 28%;
  text-align: right;
}

/* TOTAL */

.total-row {
  display: flex;
  width: 100%;
  justify-content: space-between;
  margin: 2px 0;
}

.grand-total {
  font-size: ${paper === 58 ? '11px' : '13px'};
  font-weight: 800;
}

/* AMOUNT WORDS */

.amount-words {
  text-align: center;
  font-size: ${paper === 58 ? '7px' : '8px'};
  line-height: 1.25;
  margin: 2px 0;
}

/* FOOTER */

.thanks {
  text-align: center;
  font-size: ${paper === 58 ? '9px' : '10px'};
  font-weight: 800;
  margin: 3px 0;
}

.footer {
  text-align: center;
  font-size: ${paper === 58 ? '7px' : '8px'};
  line-height: 1.35;
}

/* PRINT */

@media print {

  html,
  body {
    width: ${paper}mm;
    margin: 0;
    padding: 0;
  }

  #receipt {
    width: ${paper}mm;
    margin: 0;
    padding-top: 2mm;
    padding-bottom: 1mm;
  }

}

</style>

</head>

<body>

<div id="receipt">

  <!-- SHOP HEADER -->

  <div class="header">

    <div class="shop-name">
      ${escapeReceiptHTML(shop.name)}
    </div>

    <div class="tagline">
      ${escapeReceiptHTML(shop.tagline)}
    </div>

    <div class="divider"></div>

    <div class="address">

      ${shop.addressLines
        .map(line => escapeReceiptHTML(line))
        .join('<br>')}

      <br>

      Ph: +91 ${escapeReceiptHTML(shop.phone)}

    </div>

    <div class="divider"></div>

    <div class="bill-title">
      BILL
    </div>

  </div>


  <!-- BILL DETAILS -->

  <div class="detail-row">
    <span class="label">Bill No</span>
    <span class="value">
      #${escapeReceiptHTML(receiptBillCode(order))}
    </span>
  </div>

  <div class="detail-row">
    <span class="label">Date</span>
    <span class="value">
      ${receiptDate(order.time)}
    </span>
  </div>

  <div class="detail-row">
    <span class="label">Time</span>
    <span class="value">
      ${receiptTime(order.time)}
    </span>
  </div>

  <div class="detail-row">
    <span class="label">Table/Token</span>
    <span class="value">
      ${escapeReceiptHTML(order.note || '-')}
    </span>
  </div>

  <div class="detail-row">
    <span class="label">Cashier</span>
    <span class="value">
      ${escapeReceiptHTML(order.servedBy || '-')}
    </span>
  </div>

  <div class="detail-row">
    <span class="label">Payment</span>
    <span class="value">
      ${escapeReceiptHTML(payment)}
    </span>
  </div>


  <!-- CUSTOMER -->

  ${customerHTML}


  <!-- ITEMS -->

  <div class="divider"></div>

  <div class="items-header">

    <div class="item-name">
      ITEM
    </div>

    <div class="item-qty">
      QTY
    </div>

    <div class="item-amount">
      AMOUNT
    </div>

  </div>

  <div class="divider"></div>

  ${itemsHTML}


  <!-- TOTAL -->

  <div class="divider"></div>

  <div class="total-row">

    <span>
      Subtotal
    </span>

    <strong>
      ${receiptMoney(total)}
    </strong>

  </div>

  <div class="divider"></div>

  <div class="total-row grand-total">

    <span>
      GRAND TOTAL
    </span>

    <span>
      ${receiptMoney(total)}
    </span>

  </div>

  <div class="divider"></div>

  <div class="amount-words">

    (${escapeReceiptHTML(
      receiptAmountInWords(total)
    )})

  </div>

  <div class="divider"></div>


  <!-- FOOTER -->

  <div class="thanks">
    Thank You! Visit Again!
  </div>

  <div class="footer">

    <strong>OPENING HOURS:</strong>

    <br>

    ${shop.hoursLines
      .map(hour => escapeReceiptHTML(hour))
      .join('<br>')}

    <br><br>

    DINE IN | TAKE AWAY | HOME DELIVERY

  </div>

</div>

<script>

window.onload = function () {

  setTimeout(function () {

    window.focus();

    window.print();

    setTimeout(function () {
      window.close();
    }, 800);

  }, 300);

};

</script>

</body>
</html>
  `);

  printWindow.document.close();
}


/* Escape customer/item text safely */
function escapeReceiptHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Optional helper for your paper-width dropdown. */
function setupReceiptPaperSelector(selectElement) {
  if (!selectElement) return;

  selectElement.value = String(RECEIPT_PAPER_WIDTH);

  selectElement.addEventListener('change', () => {
    setReceiptPaperWidth(selectElement.value);
  });
}

/* Make functions available to your existing app.js. */
window.printReceipt = printReceipt;
window.setReceiptPaperWidth = setReceiptPaperWidth;
window.setupReceiptPaperSelector = setupReceiptPaperSelector;
window.buildReceiptText = buildReceiptText;
