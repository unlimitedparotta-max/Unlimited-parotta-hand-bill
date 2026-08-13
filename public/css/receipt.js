/* =========================================================
   UNLIMITED PAROTTA
   80mm THERMAL RECEIPT PRINTER
   ========================================================= */

const RECEIPT_SHOP = {
  name: 'UNLIMITED PAROTTA',
  tagline: 'Taste Unlimited. Happiness Unlimited.',

  addressLines: [
    '14, Rani Paradise Theater Complex,',
    'Membalam Rd, Pandiyar Residency,',
    'Thanjavur, India, 613007'
  ],

  phone: '97895 22232',

  hoursLines: [
    '12.00 PM to 4.00 PM',
    '7.00 PM to 10.00 PM'
  ]
};


/* =========================================================
   PAPER SIZE
   ========================================================= */

const RECEIPT_PAPER_KEY = 'up_paperwidth';

let RECEIPT_PAPER_WIDTH =
  localStorage.getItem(RECEIPT_PAPER_KEY) === '58'
    ? 58
    : 80;


/* Change paper width */
function setReceiptPaperWidth(width) {
  RECEIPT_PAPER_WIDTH =
    Number(width) === 58 ? 58 : 80;

  localStorage.setItem(
    RECEIPT_PAPER_KEY,
    String(RECEIPT_PAPER_WIDTH)
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeReceiptHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function receiptMoney(value) {
  const amount = Number(value || 0);

  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}


function receiptDate(iso) {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join(' ');
}


function receiptTime(iso) {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  let hour = d.getHours();

  const minute =
    String(d.getMinutes()).padStart(2, '0');

  const ampm =
    hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return (
    String(hour).padStart(2, '0') +
    ':' +
    minute +
    ' ' +
    ampm
  );
}


/* =========================================================
   BILL CODE
   ========================================================= */

function receiptBillCode(order) {

  if (order.billCode) {
    return order.billCode;
  }

  const d = new Date(order.time);

  const prefix =
    order.menuKey === 'bar'
      ? 'RB'
      : 'UPB';

  const yy =
    String(d.getFullYear()).slice(-2);

  const mm =
    String(d.getMonth() + 1).padStart(2, '0');

  const dd =
    String(d.getDate()).padStart(2, '0');

  const no =
    String(order.billNo ?? '')
      .padStart(4, '0');

  return `${prefix}${yy}${mm}${dd}${no}`;
}


/* =========================================================
   AMOUNT IN WORDS
   ========================================================= */

function receiptAmountInWords(amount) {

  amount = Math.round(Number(amount || 0));

  if (amount === 0) {
    return 'Zero Rupees Only';
  }

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen'
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety'
  ];


  function twoDigits(n) {

    if (n < 20) {
      return ones[n];
    }

    return (
      tens[Math.floor(n / 10)] +
      (n % 10
        ? ' ' + ones[n % 10]
        : '')
    );
  }


  function underThousand(n) {

    let result = '';

    if (n >= 100) {

      result +=
        ones[Math.floor(n / 100)] +
        ' Hundred';

      n %= 100;

      if (n) {
        result += ' ';
      }
    }

    if (n) {
      result += twoDigits(n);
    }

    return result;
  }


  let result = '';


  if (amount >= 10000000) {

    result +=
      underThousand(
        Math.floor(amount / 10000000)
      ) +
      ' Crore';

    amount %= 10000000;

    if (amount) {
      result += ' ';
    }
  }


  if (amount >= 100000) {

    result +=
      underThousand(
        Math.floor(amount / 100000)
      ) +
      ' Lakh';

    amount %= 100000;

    if (amount) {
      result += ' ';
    }
  }


  if (amount >= 1000) {

    result +=
      underThousand(
        Math.floor(amount / 1000)
      ) +
      ' Thousand';

    amount %= 1000;

    if (amount) {
      result += ' ';
    }
  }


  if (amount) {
    result += underThousand(amount);
  }


  return result + ' Rupees Only';
}


/* =========================================================
   PRINT RECEIPT
   ========================================================= */

function printReceipt(order) {

  if (!order) {

    console.error(
      'printReceipt: order is required'
    );

    return;
  }


  /* Always use thermal paper */
  const paper =
    RECEIPT_PAPER_WIDTH === 58
      ? 58
      : 80;


  const printWindow =
    window.open(
      '',
      '_blank',
      'width=400,height=700,scrollbars=yes'
    );


  if (!printWindow) {

    alert(
      'Please allow pop-ups for printing the receipt.'
    );

    return;
  }


  const shop = RECEIPT_SHOP;


  const total =
    Number(order.total || 0);


  const payment =
    String(
      order.paymentMethod || ''
    ).toLowerCase() === 'gpay'
      ? 'GPay / UPI'
      : 'Cash';


  /* =======================================================
     ITEMS
     ======================================================= */

  let itemsHTML = '';


  for (const item of (order.items || [])) {

    const name =
      String(item.name || 'Item');

    const qty =
      Number(item.qty || 0);

    const price =
      Number(item.price || 0);

    const amount =
      price === 0
        ? 'FREE'
        : receiptMoney(
            price * qty
          );


    itemsHTML += `
      <div class="item">

        <div class="item-name">
          ${escapeReceiptHTML(name)}
        </div>

        <div class="item-qty">
          ${qty}
        </div>

        <div class="item-price">
          ${amount}
        </div>

      </div>
    `;
  }


  /* =======================================================
     CUSTOMER
     ======================================================= */

  let customerHTML = '';


  if (
    order.customerName ||
    order.customerMobile
  ) {

    customerHTML += `
      <div class="line"></div>
    `;


    if (order.customerName) {

      customerHTML += `
        <div class="detail">
          <span>Customer</span>
          <strong>
            ${escapeReceiptHTML(
              order.customerName
            )}
          </strong>
        </div>
      `;
    }


    if (order.customerMobile) {

      customerHTML += `
        <div class="detail">
          <span>Mobile</span>
          <strong>
            +91 ${escapeReceiptHTML(
              order.customerMobile
            )}
          </strong>
        </div>
      `;
    }
  }


  /* =======================================================
     HTML PRINT DOCUMENT
     ======================================================= */

  printWindow.document.open();


  printWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
Unlimited Parotta Receipt
</title>


<style>

/* =========================================================
   THERMAL PAPER
   ========================================================= */

@page {

  size: ${paper}mm auto;

  margin: 0;

}


html {

  width: ${paper}mm;

  margin: 0;

  padding: 0;

}


body {

  width: ${paper}mm;

  margin: 0;

  padding: 0;

  background: white;

  color: black;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    ${paper === 58 ? '9px' : '10px'};

  line-height: 1.18;

  font-weight: 500;

}


/* =========================================================
   RECEIPT CONTAINER
   ========================================================= */

#receipt {

  width: ${paper}mm;

  max-width: ${paper}mm;

  margin: 0;

  padding:
    1.5mm
    2.5mm
    1.5mm
    2.5mm;

  box-sizing: border-box;

}


/* =========================================================
   SHOP HEADER
   ========================================================= */

.shop-name {

  text-align: center;

  font-size:
    ${paper === 58 ? '14px' : '16px'};

  font-weight: 800;

  line-height: 1;

  margin-bottom: 2px;

}


.tagline {

  text-align: center;

  font-size:
    ${paper === 58 ? '7px' : '8px'};

  line-height: 1;

  margin-bottom: 4px;

}


.address {

  text-align: center;

  font-size:
    ${paper === 58 ? '7px' : '8px'};

  line-height: 1.2;

}


/* =========================================================
   DIVIDER
   ========================================================= */

.line {

  width: 100%;

  border-top:
    1px dashed #000;

  margin:
    3px 0;

}


/* =========================================================
   BILL TITLE
   ========================================================= */

.bill-title {

  text-align: center;

  font-size:
    ${paper === 58 ? '12px' : '14px'};

  font-weight: 800;

  margin:
    3px 0 3px 0;

}


/* =========================================================
   BILL DETAILS
   ========================================================= */

.detail {

  display: flex;

  width: 100%;

  min-height: 13px;

  line-height: 1.1;

}


.detail span {

  width: 38%;

  text-align: left;

}


.detail strong {

  width: 62%;

  text-align: right;

  font-weight: 500;

  overflow-wrap: anywhere;

}


/* =========================================================
   ITEMS HEADER
   ========================================================= */

.items-header {

  display: flex;

  width: 100%;

  font-weight: 800;

  line-height: 1.1;

}


.items-header .name {

  width: 55%;

}


.items-header .qty {

  width: 15%;

  text-align: center;

}


.items-header .amount {

  width: 30%;

  text-align: right;

}


/* =========================================================
   ITEMS
   ========================================================= */

.item {

  display: flex;

  width: 100%;

  line-height: 1.15;

  margin:
    1px 0;

}


.item-name {

  width: 55%;

  text-align: left;

  padding-right: 2px;

  overflow-wrap: anywhere;

}


.item-qty {

  width: 15%;

  text-align: center;

}


.item-price {

  width: 30%;

  text-align: right;

  white-space: nowrap;

}


/* =========================================================
   TOTALS
   ========================================================= */

.total {

  display: flex;

  width: 100%;

  justify-content:
    space-between;

  line-height: 1.15;

  margin:
    2px 0;

}


.grand-total {

  font-size:
    ${paper === 58 ? '11px' : '13px'};

  font-weight: 800;

  margin:
    3px 0;

}


/* =========================================================
   AMOUNT WORDS
   ========================================================= */

.amount-words {

  text-align: center;

  font-size:
    ${paper === 58 ? '6.5px' : '7.5px'};

  line-height: 1.15;

  margin:
    2px 0;

}


/* =========================================================
   FOOTER
   ========================================================= */

.thanks {

  text-align: center;

  font-size:
    ${paper === 58 ? '9px' : '10px'};

  font-weight: 800;

  margin:
    3px 0 2px 0;

}


.footer {

  text-align: center;

  font-size:
    ${paper === 58 ? '7px' : '8px'};

  line-height: 1.25;

}


/* =========================================================
   PRINT
   ========================================================= */

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

    padding:
      1.5mm
      2.5mm
      1.5mm
      2.5mm;

  }


  * {

    page-break-before: auto;

    page-break-after: auto;

    page-break-inside: avoid;

  }

}

</style>

</head>


<body>


<div id="receipt">


  <!-- SHOP -->

  <div class="shop-name">
    ${escapeReceiptHTML(shop.name)}
  </div>


  <div class="tagline">
    ${escapeReceiptHTML(shop.tagline)}
  </div>


  <div class="line"></div>


  <div class="address">

    ${shop.addressLines
      .map(line =>
        escapeReceiptHTML(line)
      )
      .join('<br>')}

    <br>

    Ph: +91
    ${escapeReceiptHTML(shop.phone)}

  </div>


  <div class="line"></div>


  <!-- BILL -->

  <div class="bill-title">
    BILL
  </div>


  <!-- DETAILS -->

  <div class="detail">

    <span>Bill No</span>

    <strong>
      #${escapeReceiptHTML(
        receiptBillCode(order)
      )}
    </strong>

  </div>


  <div class="detail">

    <span>Date</span>

    <strong>
      ${receiptDate(order.time)}
    </strong>

  </div>


  <div class="detail">

    <span>Time</span>

    <strong>
      ${receiptTime(order.time)}
    </strong>

  </div>


  <div class="detail">

    <span>Table/Token</span>

    <strong>
      ${escapeReceiptHTML(
        order.note || '-'
      )}
    </strong>

  </div>


  <div class="detail">

    <span>Cashier</span>

    <strong>
      ${escapeReceiptHTML(
        order.servedBy || '-'
      )}
    </strong>

  </div>


  <div class="detail">

    <span>Payment</span>

    <strong>
      ${escapeReceiptHTML(payment)}
    </strong>

  </div>


  ${customerHTML}


  <!-- ITEMS -->

  <div class="line"></div>


  <div class="items-header">

    <div class="name">
      Item
    </div>

    <div class="qty">
      Qty
    </div>

    <div class="amount">
      Amount
    </div>

  </div>


  <div class="line"></div>


  ${itemsHTML}


  <!-- TOTAL -->

  <div class="line"></div>


  <div class="total">

    <span>
      Subtotal
    </span>

    <strong>
      ${receiptMoney(total)}
    </strong>

  </div>


  <div class="line"></div>


  <div class="total grand-total">

    <span>
      GRAND TOTAL
    </span>

    <strong>
      ${receiptMoney(total)}
    </strong>

  </div>


  <div class="line"></div>


  <div class="amount-words">

    (
    ${escapeReceiptHTML(
      receiptAmountInWords(total)
    )}
    )

  </div>


  <div class="line"></div>


  <!-- FOOTER -->

  <div class="thanks">

    Thank You! Visit Again!

  </div>


  <div class="footer">

    <strong>
      OPENING HOURS:
    </strong>

    <br>

    ${shop.hoursLines
      .map(hour =>
        escapeReceiptHTML(hour)
      )
      .join('<br>')}

    <br>

    DINE IN | TAKE AWAY

    <br>

    HOME DELIVERY

  </div>


</div>


<script>

window.onload = function () {

  setTimeout(function () {

    window.focus();

    window.print();

  }, 400);

};

window.onafterprint = function () {

  setTimeout(function () {

    window.close();

  }, 500);

};

</script>


</body>

</html>

  `);


  printWindow.document.close();
}


/* =========================================================
   PAPER SELECTOR
   ========================================================= */

function setupReceiptPaperSelector(
  selectElement
) {

  if (!selectElement) {
    return;
  }


  selectElement.value =
    String(RECEIPT_PAPER_WIDTH);


  selectElement.addEventListener(
    'change',
    function () {

      setReceiptPaperWidth(
        selectElement.value
      );

    }
  );
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.printReceipt =
  printReceipt;

window.setReceiptPaperWidth =
  setReceiptPaperWidth;

window.setupReceiptPaperSelector =
  setupReceiptPaperSelector;
