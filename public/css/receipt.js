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

const RECEIPT_PAPER_KEY = 'up_paperwidth';

let RECEIPT_PAPER_WIDTH =
  localStorage.getItem(RECEIPT_PAPER_KEY) === '58' ? 58 : 80;

function setReceiptPaperWidth(width) {
  RECEIPT_PAPER_WIDTH = Number(width) === 58 ? 58 : 80;
  localStorage.setItem(RECEIPT_PAPER_KEY, String(RECEIPT_PAPER_WIDTH));
}

function receiptPadRight(value, width) {
  value = String(value ?? '');
  return value.length >= width
    ? value.slice(0, width)
    : value + ' '.repeat(width - value.length);
}

function receiptPadLeft(value, width) {
  value = String(value ?? '');
  return value.length >= width
    ? value.slice(-width)
    : ' '.repeat(width - value.length) + value;
}

function receiptCenter(value, width) {
  value = String(value ?? '');
  if (value.length >= width) return value.slice(0, width);
  const spaces = width - value.length;
  const left = Math.floor(spaces / 2);
  return ' '.repeat(left) + value + ' '.repeat(spaces - left);
}

function receiptDivider(width) {
  return '-'.repeat(width);
}

function receiptMoney(value) {
  const amount = Number(value || 0);
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function receiptDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';

  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('-');
}

function receiptTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';

  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
}

function receiptBillCode(order) {
  if (order.billCode) return order.billCode;

  const d = new Date(order.time);
  const prefix = order.menuKey === 'bar' ? 'RB' : 'UPB';

  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const no = String(order.billNo ?? '').padStart(4, '0');

  return `${prefix}${yy}${mm}${dd}${no}`;
}

/* Amount in words for Indian Rupees. */
function receiptAmountInWords(amount) {
  amount = Math.round(Number(amount || 0));

  if (amount === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five',
    'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] +
      (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function underThousand(n) {
    let result = '';

    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred';
      n %= 100;
      if (n) result += ' ';
    }

    if (n) result += twoDigits(n);

    return result;
  }

  let result = '';

  if (amount >= 10000000) {
    result += underThousand(Math.floor(amount / 10000000)) + ' Crore';
    amount %= 10000000;
    if (amount) result += ' ';
  }

  if (amount >= 100000) {
    result += underThousand(Math.floor(amount / 100000)) + ' Lakh';
    amount %= 100000;
    if (amount) result += ' ';
  }

  if (amount >= 1000) {
    result += underThousand(Math.floor(amount / 1000)) + ' Thousand';
    amount %= 1000;
    if (amount) result += ' ';
  }

  if (amount) result += underThousand(amount);

  return result + ' Rupees Only';
}

function receiptItemRows(order, width) {
  /*
    80mm: 40 characters
    58mm: 32 characters

    Keep item names readable and amounts aligned.
  */
  const NAME_WIDTH = width === 40 ? 21 : 15;
  const QTY_WIDTH = 5;
  const AMT_WIDTH = width - NAME_WIDTH - QTY_WIDTH;

  const rows = [];

  for (const item of (order.items || [])) {
    const name = String(item.name || 'Item');
    const qty = String(item.qty || 0);
    const amount =
      Number(item.price || 0) === 0
        ? 'FREE'
        : receiptMoney(Number(item.price || 0) * Number(item.qty || 0));

    if (name.length <= NAME_WIDTH) {
      rows.push(
        receiptPadRight(name, NAME_WIDTH) +
        receiptPadLeft(qty, QTY_WIDTH) +
        receiptPadLeft(amount, AMT_WIDTH)
      );
      continue;
    }

    // Wrap long item name.
    let remaining = name;

    while (remaining.length > NAME_WIDTH) {
      rows.push(remaining.slice(0, NAME_WIDTH));
      remaining = remaining.slice(NAME_WIDTH);
    }

    rows.push(
      receiptPadRight(remaining, NAME_WIDTH) +
      receiptPadLeft(qty, QTY_WIDTH) +
      receiptPadLeft(amount, AMT_WIDTH)
    );
  }

  return rows;
}

function buildReceiptText(order) {
  const width = RECEIPT_PAPER_WIDTH === 58 ? 32 : 40;
  const lines = [];

  lines.push(receiptCenter(RECEIPT_SHOP.name, width));
  lines.push(receiptCenter(RECEIPT_SHOP.tagline, width));
  lines.push(receiptDivider(width));

  RECEIPT_SHOP.addressLines.forEach(line => {
    lines.push(receiptCenter(line, width));
  });

  lines.push(receiptCenter('Ph: +91 ' + RECEIPT_SHOP.phone, width));
  lines.push(receiptDivider(width));

  lines.push(receiptCenter('BILL', width));
  lines.push('');

  lines.push(
    receiptPadRight('Bill No', Math.floor(width * 0.35)) +
    receiptPadLeft('#' + receiptBillCode(order), width - Math.floor(width * 0.35))
  );

  lines.push(
    receiptPadRight('Date', Math.floor(width * 0.35)) +
    receiptPadLeft(receiptDate(order.time), width - Math.floor(width * 0.35))
  );

  lines.push(
    receiptPadRight('Time', Math.floor(width * 0.35)) +
    receiptPadLeft(receiptTime(order.time), width - Math.floor(width * 0.35))
  );

  lines.push(
    receiptPadRight('Table/Token', Math.floor(width * 0.35)) +
    receiptPadLeft(order.note || '-', width - Math.floor(width * 0.35))
  );

  lines.push(
    receiptPadRight('Cashier', Math.floor(width * 0.35)) +
    receiptPadLeft(order.servedBy || '-', width - Math.floor(width * 0.35))
  );

  const payment =
    String(order.paymentMethod || '').toLowerCase() === 'gpay'
      ? 'GPay / UPI'
      : 'Cash';

  lines.push(
    receiptPadRight('Payment', Math.floor(width * 0.35)) +
    receiptPadLeft(payment, width - Math.floor(width * 0.35))
  );

  if (order.customerName || order.customerMobile) {
    lines.push(receiptDivider(width));

    if (order.customerName) {
      lines.push(
        receiptPadRight('Customer', Math.floor(width * 0.35)) +
        receiptPadLeft(order.customerName, width - Math.floor(width * 0.35))
      );
    }

    if (order.customerMobile) {
      lines.push(
        receiptPadRight('Mobile', Math.floor(width * 0.35)) +
        receiptPadLeft('+91 ' + order.customerMobile, width - Math.floor(width * 0.35))
      );
    }
  }

  lines.push(receiptDivider(width));

  const NAME_WIDTH = width === 40 ? 21 : 15;
  const QTY_WIDTH = 5;
  const AMT_WIDTH = width - NAME_WIDTH - QTY_WIDTH;

  lines.push(
    receiptPadRight('Item', NAME_WIDTH) +
    receiptPadLeft('Qty', QTY_WIDTH) +
    receiptPadLeft('Amount', AMT_WIDTH)
  );

  lines.push(receiptDivider(width));

  receiptItemRows(order, width).forEach(row => lines.push(row));

  lines.push(receiptDivider(width));

  const total = Number(order.total || 0);

  lines.push(
    receiptPadRight('Subtotal', width - 12) +
    receiptPadLeft(receiptMoney(total), 12)
  );

  lines.push(
    receiptPadRight('GRAND TOTAL', width - 12) +
    receiptPadLeft(receiptMoney(total), 12)
  );

  lines.push(receiptDivider(width));
  lines.push(receiptCenter('(' + receiptAmountInWords(total) + ')', width));
  lines.push(receiptDivider(width));

  lines.push('');
  lines.push(receiptCenter('Thank You! Visit Again!', width));
  lines.push('');
  lines.push(receiptCenter('OPENING HOURS:', width));

  RECEIPT_SHOP.hoursLines.forEach(hour => {
    lines.push(receiptCenter(hour, width));
  });

  lines.push('');
  lines.push(receiptCenter('DINE IN | TAKE AWAY', width));
  lines.push(receiptCenter('HOME DELIVERY', width));
  lines.push('');
  lines.push(receiptDivider(width));
  lines.push('');

  return lines.join('\n');
}

/* Main function */
function printReceipt(order) {
  if (!order) {
    console.error('printReceipt: order is required');
    return;
  }

  const text = buildReceiptText(order);

  const printWindow = window.open('', '_blank', 'width=420,height=700');

  if (!printWindow) {
    alert('Please allow pop-ups for printing the receipt.');
    return;
  }

  const paper = RECEIPT_PAPER_WIDTH === 58 ? 58 : 80;
  const fontSize = paper === 58 ? '10px' : '11px';

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt - ${receiptBillCode(order)}</title>
<style>
  @page {
    size: ${paper}mm auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: ${paper}mm;
    background: #fff;
  }

  body {
    font-family:
      "Courier New",
      Courier,
      monospace;
    font-size: ${fontSize};
    line-height: 1.35;
    font-weight: 600;
    color: #000;
  }

  #receipt {
    width: ${paper}mm;
    padding: 2mm;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media print {
    html, body {
      width: ${paper}mm;
      margin: 0;
      padding: 0;
    }

    #receipt {
      width: ${paper}mm;
      padding: 2mm;
    }
  }
</style>
</head>
<body>
<pre id="receipt"></pre>
<script>
  document.getElementById('receipt').textContent =
    ${JSON.stringify(text)};
<\/script>
</body>
</html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();

    setTimeout(() => {
      printWindow.close();
    }, 800);
  }, 300);
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
