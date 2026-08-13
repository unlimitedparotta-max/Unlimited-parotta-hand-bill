UNLIMITED PAROTTA RECEIPT SETUP

1. Put receipt.js in public/
2. Put receipt.css in public/
3. Keep style.css in public/

In index.html load:
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/receipt.css">

Load scripts:
<script src="/receipt.js"></script>
<script src="/app.js"></script>

Printing:
printReceipt(order);

80mm:
setReceiptPaperWidth(80);

58mm:
setReceiptPaperWidth(58);

IMPORTANT:
Your current style.css already has a PRINT RECEIPT section.
Do not keep duplicate #receipt-print @media print rules active in both
style.css and receipt.css. The clean setup is to let receipt.css control
the receipt print rules and remove/comment the old PRINT RECEIPT block
from style.css.

Do not use A4 size, 297mm height, 100vh, min-height, or fixed receipt
height. Thermal receipt height must remain automatic.
