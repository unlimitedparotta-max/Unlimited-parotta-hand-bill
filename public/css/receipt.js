/* =========================================================
   UNLIMITED PAROTTA
   Thermal Receipt Printer
   Optimized for 80mm / 58mm thermal printers

   Usage:
       printReceipt(order);

   Paper:
       setReceiptPaperWidth(80);
       setReceiptPaperWidth(58);
========================================================= */


/* =========================================================
   SHOP DETAILS
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
   PAPER WIDTH
========================================================= */

const RECEIPT_PAPER_KEY = 'up_paperwidth';

let RECEIPT_PAPER_WIDTH =
  localStorage.getItem(RECEIPT_PAPER_KEY) === '58'
    ? 58
    : 80;


function setReceiptPaperWidth(width) {

  RECEIPT_PAPER_WIDTH =
    Number(width) === 58 ? 58 : 80;

  localStorage.setItem(
    RECEIPT_PAPER_KEY,
    String(RECEIPT_PAPER_WIDTH)
  );
}


/* =========================================================
   BASIC HELPERS
========================================================= */

function receiptMoney(value) {

  const amount = Number(value || 0);

  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
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
  ].join('-');
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

  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
}


/* =========================================================
   BILL NUMBER
========================================================= */

function receiptBillCode(order) {

  if (order && order.billCode) {
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
    String(order.billNo ?? '').padStart(4, '0');

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
      ) + ' Crore';

    amount %= 10000000;

    if (amount) {
      result += ' ';
    }
  }


  if (amount >= 100000) {

    result +=
      underThousand(
        Math.floor(amount / 100000)
      ) + ' Lakh';

    amount %= 100000;

    if (amount) {
      result += ' ';
    }
  }


  if (amount >= 1000) {

    result +=
      underThousand(
        Math.floor(amount / 1000)
      ) + ' Thousand';

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
   HTML ESCAPE
========================================================= */

function escapeReceiptHTML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   MAIN PRINT FUNCTION
========================================================= */

function printReceipt(order) {

  if (!order) {

    console.error(
      'printReceipt: order is required'
    );

    return;
  }


  const printWindow =
    window.open(
      '',
      '_blank',
      'width=420,height=700'
    );


  if (!printWindow) {

    alert(
      'Please allow pop-ups for printing the receipt.'
    );

    return;
  }


  const paper =
    RECEIPT_PAPER_WIDTH === 58
      ? 58
      : 80;


  const shop =
    RECEIPT_SHOP;


  const total =
    Number(order.total || 0);


  const payment =
    String(
      order.paymentMethod || ''
    ).toLowerCase() === 'gpay'
      ? 'UPI / GPay'
      : 'Cash';


  /* =======================================================
     ITEMS
  ======================================================= */

  let itemsHTML = '';


  (order.items || []).forEach(item => {

    const name =
      String(item.name || 'Item');

    const qty =
      Number(item.qty || 0);

    const price =
      Number(item.price || 0);

    const amount =
      price === 0
        ? 'FREE'
        : receiptMoney(price * qty);


    itemsHTML += `
      <div class="item-row">

        <div class="item-name">
          ${escapeReceiptHTML(name)}
        </div>

        <div class="item-qty">
          ${qty}
        </div>

        <div class="item-amount">
          ${amount}
        </div>

      </div>
    `;
  });


  /* =======================================================
     CUSTOMER
  ======================================================= */

  let customerHTML = '';


  if (
    order.customerName ||
    order.customerMobile
  ) {

    customerHTML += `
      <div class="divider"></div>
    `;


    if (order.customerName) {

      customerHTML += `
        <div class="detail-row">

          <span class="label">
            Customer
          </span>

          <span class="value">
            ${escapeReceiptHTML(
              order.customerName
            )}
          </span>

        </div>
      `;
    }


    if (order.customerMobile) {

      customerHTML += `
        <div class="detail-row">

          <span class="label">
            Mobile
          </span>

          <span class="value">
            +91 ${escapeReceiptHTML(
              order.customerMobile
            )}
          </span>

        </div>
      `;
    }
  }


  /* =======================================================
     PRINT HTML
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

/* =======================================================
   PAGE
======================================================= */

@page {

  size: ${paper}mm auto;

  margin: 0;

}


/* =======================================================
   RESET
======================================================= */

* {

  box-sizing: border-box;

}


html,
body {

  margin: 0 !important;

  padding: 0 !important;

  width: ${paper}mm;

  background: #ffffff;

}


/* =======================================================
   BODY
======================================================= */

body {

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color: #000;

  font-size:
    ${paper === 58 ? '8px' : '9px'};

  line-height: 1.05;

  font-weight: 500;

}


/* =======================================================
   RECEIPT CONTAINER
======================================================= */

#receipt {

  width: ${paper}mm;

  margin: 0;

  padding:
    1mm
    2mm
    0
    2mm;

}


/* =======================================================
   HEADER
======================================================= */

.header {

  text-align: center;

}


.shop-name {

  font-size:
    ${paper === 58 ? '14px' : '16px'};

  font-weight: 800;

  line-height: 1;

}


.tagline {

  font-size:
    ${paper === 58 ? '7px' : '8px'};

  margin-top: 1px;

}


.address {

  font-size:
    ${paper === 58 ? '7px' : '8px'};

  line-height: 1.05;

  margin-top: 2px;

}


/* =======================================================
   BILL TITLE
======================================================= */

.bill-title {

  text-align: center;

  font-size:
    ${paper === 58 ? '10px' : '12px'};

  font-weight: 800;

  margin: 2px 0;

}


/* =======================================================
   DIVIDER
======================================================= */

.divider {

  border-top:
    1px dashed #000;

  margin: 2px 0;

}


/* =======================================================
   DETAILS
======================================================= */

.detail-row {

  display: flex;

  width: 100%;

  min-height: 11px;

  margin: 0;

}


.label {

  width: 37%;

  text-align: left;

}


.value {

  width: 63%;

  text-align: right;

  overflow-wrap: anywhere;

}


/* =======================================================
   ITEMS HEADER
======================================================= */

.items-header {

  display: flex;

  width: 100%;

  font-weight: 800;

  min-height: 12px;

}


.items-header .item-name {

  flex: 1;

}


.items-header .item-qty {

  width: 12%;

  text-align: center;

}


.items-header .item-amount {

  width: 28%;

  text-align: right;

}


/* =======================================================
   ITEMS
======================================================= */

.item-row {

  display: flex;

  width: 100%;

  min-height: 12px;

  align-items: flex-start;

}


.item-name {

  flex: 1;

  min-width: 0;

  text-align: left;

  padding-right: 2px;

  overflow-wrap: anywhere;

}


.item-qty {

  width: 12%;

  text-align: center;

}


.item-amount {

  width: 28%;

  text-align: right;

}


/* =======================================================
   TOTALS
======================================================= */

.total-row {

  display: flex;

  width: 100%;

  min-height: 12px;

  justify-content:
    space-between;

}


.grand-total {

  font-size:
    ${paper === 58 ? '10px' : '11px'};

  font-weight: 800;

}


/* =======================================================
   AMOUNT WORDS
======================================================= */

.amount-words {

  text-align: center;

  font-size:
    ${paper === 58 ? '6px' : '7px'};

  line-height: 1.05;

  margin: 1px 0;

}


/* =======================================================
   FOOTER
======================================================= */

.thanks {

  text-align: center;

  font-size:
    ${paper === 58 ? '8px' : '9px'};

  font-weight: 800;

  margin: 2px 0;

}


.footer {

  text-align: center;

  font-size:
    ${paper === 58 ? '6px' : '7px'};

  line-height: 1.05;

}


/* =======================================================
   PRINT
======================================================= */

@media print {

  html,
  body {

    width: ${paper}mm !important;

    margin: 0 !important;

    padding: 0 !important;

  }


  #receipt {

    width: ${paper}mm !important;

    margin: 0 !important;

    padding:
      1mm
      2mm
      0
      2mm !important;

  }

}

</style>

</head>


<body>


<div id="receipt">


<!-- =====================================================
     SHOP HEADER
===================================================== -->

<div class="header">


  <div class="shop-name">

    ${escapeReceiptHTML(
      shop.name
    )}

  </div>


  <div class="tagline">

    ${escapeReceiptHTML(
      shop.tagline
    )}

  </div>


  <div class="divider"></div>


  <div class="address">

    ${shop.addressLines
      .map(
        line =>
          escapeReceiptHTML(line)
      )
      .join('<br>')}

    <br>

    Ph: +91 ${escapeReceiptHTML(
      shop.phone
    )}

  </div>


  <div class="divider"></div>


  <div class="bill-title">

    BILL

  </div>


</div>


<!-- =====================================================
     BILL DETAILS
===================================================== -->


<div class="detail-row">

  <span class="label">
    Bill No
  </span>

  <span class="value">

    #${escapeReceiptHTML(
      receiptBillCode(order)
    )}

  </span>

</div>


<div class="detail-row">

  <span class="label">
    Date
  </span>

  <span class="value">

    ${receiptDate(order.time)}

  </span>

</div>


<div class="detail-row">

  <span class="label">
    Time
  </span>

  <span class="value">

    ${receiptTime(order.time)}

  </span>

</div>


<div class="detail-row">

  <span class="label">
    Table/Token
  </span>

  <span class="value">

    ${escapeReceiptHTML(
      order.note || '-'
    )}

  </span>

</div>


<div class="detail-row">

  <span class="label">
    Cashier
  </span>

  <span class="value">

    ${escapeReceiptHTML(
      order.servedBy || '-'
    )}

  </span>

</div>


<div class="detail-row">

  <span class="label">
    Payment
  </span>

  <span class="value">

    ${escapeReceiptHTML(
      payment
    )}

  </span>

</div>


<!-- CUSTOMER -->

${customerHTML}


<!-- =====================================================
     ITEMS
===================================================== -->


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


<!-- =====================================================
     TOTAL
===================================================== -->


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


<!-- =====================================================
     FOOTER
===================================================== -->


<div class="thanks">

  Thank You! Visit Again!

</div>


<div class="footer">

  <strong>
    OPENING HOURS:
  </strong>

  <br>

  ${shop.hoursLines
    .map(
      hour =>
        escapeReceiptHTML(hour)
    )
    .join('<br>')}

  <br>

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

    }, 1000);

  }, 300);

};

</script>


</body>

</html>

`);


  printWindow.document.close();
}


/* =========================================================
   PAPER WIDTH SELECTOR
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
    () => {

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
