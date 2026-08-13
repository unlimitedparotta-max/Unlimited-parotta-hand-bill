# Unlimited Parotta × Rhythm Bar — Billing

Node/Express app. Single server, JSON-file storage, 3 role logins, dish photos,
and live "bar order → ground floor print" relay (server-side, no third-party
sync needed anymore).

## Run locally
```
npm install
npm start
```
Visit http://localhost:3000 — default PINs: admin `admin123`, staff `staff123`, bar `bar123`.

Data is stored in `data/db.json` (auto-created on first run) and uploaded dish
photos in `uploads/`. Back these two up regularly — that's your whole database.

---

## Connecting billing.abifashion.online (Render)

You're using a subdomain of your existing abifashion.online domain, hosted on
Render. Here's the exact path:

### 1. Push this folder to GitHub
Render deploys from a repo (it can't take a zip upload directly).
```
cd parotta-app
git init
git add .
git commit -m "Unlimited Parotta billing system"
git branch -M main
git remote add origin <your empty GitHub repo URL>
git push -u origin main
```

### 2. Create the Web Service on Render
- New → Web Service → connect the repo you just pushed.
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Instance type**: the free/cheapest tier is plenty for one shop.
- Deploy — Render gives you a temporary URL like `unlimited-parotta.onrender.com`.
  Confirm it loads and you can log in before moving to the domain.

### 3. Add a persistent disk (important — don't skip this)
Render's default filesystem resets on every redeploy, which would wipe your
orders and uploaded dish photos. Fix it once:
- In the service → **Disks** → Add Disk → mount path `/var/data`, size 1GB is
  plenty.
- In the service → **Environment** → add two env vars:
  - `DATA_DIR` = `/var/data/data`
  - `UPLOAD_DIR` = `/var/data/uploads`
- Redeploy. The app already reads these env vars (built that in), so your
  `data/db.json` and dish photos will now survive restarts and redeploys.

### 4. Point billing.abifashion.online at it
- In the Render service → **Settings** → **Custom Domains** → Add
  `billing.abifashion.online`. Render will show you a CNAME target, something
  like `unlimited-parotta.onrender.com`.
- Go to your domain's DNS panel (wherever abifashion.online's DNS is managed —
  GoDaddy/Namecheap/Hostinger/BigRock/Cloudflare, whichever you used) and add:
  - **Type**: CNAME
  - **Host/Name**: `billing`
  - **Value/Target**: the Render target it gave you
  - Leave the root domain (`abifashion.online` / `www`) untouched — that's
    still your Abi Fashion site.
- DNS usually propagates within a few minutes, sometimes up to an hour.
  Render issues HTTPS automatically once it verifies the CNAME.

### 5. Verify
Visit `https://billing.abifashion.online` — you should see the login screen.
Log in as Admin and change the three default PINs first thing
(Admin → Staff Access).

---

## Alternative — VPS (more control, if you ever want it)

If you later prefer a VPS instead of Render:
1. **Spin up a VPS** (Ubuntu 22.04/24.04) and point a DNS **A record** for
   `billing` at its IP.
2. On the VPS:
   ```
   sudo apt update && sudo apt install -y nodejs npm nginx
   sudo npm install -g pm2
   git clone <your repo> parotta-app && cd parotta-app
   npm install --omit=dev
   pm2 start server.js --name parotta-billing
   pm2 save && pm2 startup
   ```
3. Nginx reverse proxy (`/etc/nginx/sites-available/parotta`):
   ```
   server {
     listen 80;
     server_name billing.abifashion.online;
     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```
   ```
   sudo ln -s /etc/nginx/sites-available/parotta /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. HTTPS: `sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d billing.abifashion.online`

---

## Cross-floor printing (Rhythm Bar on 1st floor → print on ground floor)

This now works through the app's own server — no separate sync code needed:

- Ground floor device (Unlimited Staff or Admin login) polls the server every
  5 seconds for new Rhythm Bar orders and can **auto-print** them the moment
  they come in (toggle in the 🔔 **Bar orders** panel).
- The Rhythm Bar login itself doesn't try to print locally — it just confirms
  "Order sent to ground floor."
- Requires both devices to have the site open in a browser tab and be online
  (same Wi-Fi or mobile data both work, since it goes through your domain).
- For genuinely hands-off printing (no one needs to tap "Print"), leave the
  ground floor device's browser tab open with auto-print on, and connect it
  to a receipt printer that accepts the OS print dialog directly (most
  thermal printers with a Windows/Android driver do).

## Payment: Cash / GPay (static UPI QR, no gateway account needed)

At checkout (Unlimited Staff or Admin), staff pick **Cash** or **GPay**:
- **Cash** — saves the order immediately, same as before.
- **GPay** — staff enters/confirms the amount, and the app generates a
  **UPI QR code entirely in the browser** (using your `UPI_ID` /
  `UPI_PAYEE_NAME`, no external service call) for the customer to scan with
  GPay, PhonePe, Paytm, BHIM, or any UPI app. Since there's no payment
  gateway involved, there's no automatic "payment confirmed" signal —
  staff taps **"✅ Payment Received"** once the customer shows the
  "Payment Successful" screen in their own UPI app, same trust model as
  marking a cash payment.

Needs just:
```
UPI_ID=yourshop@bank
UPI_PAYEE_NAME=Your Shop Name
```
Until `UPI_ID` is set, the **GPay** button will show "UPI isn't set up
yet…" — Cash checkout is unaffected and works immediately either way.

(This app previously used Razorpay's Dynamic QR product for automatic
payment confirmation — that's been removed. Razorpay's Dynamic QR is a
separate product that needs to be specifically enabled on your account,
which is what caused the "requested URL was not found" error; the static
QR approach here needs no account, no API keys, and no approval wait.)

## Bill delivery: SMS = text, WhatsApp = photo

When Unlimited Staff checks out an order, two things fire automatically:
- **SMS** — a short text message (bill number, amount, pay link). Real SMS
  can't attach an image, so this is text only, on purpose.
- **WhatsApp** — the actual bill photo (itemized receipt + UPI QR code),
  sent automatically via the WhatsApp Business API. No manual attaching.

Both need one-time setup with env vars (add these to `.env` locally, or to
**Environment** in Render/your host):

### SMS (MSG91)
```
MSG91_AUTH_KEY=...
MSG91_SENDER_ID=...          # your approved 6-letter sender id
MSG91_DLT_TEMPLATE_ID=...    # DLT-approved template id (India requires this)
MSG91_DLT_ENTITY_ID=...      # optional, only if MSG91 asks for it
```
Sign up at msg91.com, register a DLT template whose wording matches the
message built in `sendBillSms()` in `public/app.js`, and you're set. Until
these are added, SMS sends will just fail gracefully (staff sees "SMS
failed" but WhatsApp still goes out).

### WhatsApp (Business Cloud API, via Meta) + Supabase Storage
The bill photo needs a public image URL to hand to WhatsApp's API — that's
what Supabase Storage is for.

1. **Supabase Storage bucket**: in your Supabase project → Storage → create
   a bucket named `bills` and mark it **Public**.
2. **Service role key**: Supabase project → Settings → API → copy the
   `service_role` key (not the anon key — the anon key can't reliably write
   to storage). Add:
   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_BUCKET=bills
   ```
3. **WhatsApp Business Cloud API**: create a Meta developer app at
   developers.facebook.com → add the WhatsApp product → grab the **Phone
   number ID** and a **permanent access token** (System User token, so it
   doesn't expire like the 24-hour test tokens). Add:
   ```
   WHATSAPP_TOKEN=...
   WHATSAPP_PHONE_NUMBER_ID=...
   ```
4. Your WhatsApp sending number needs to be approved for the customer's
   number to be able to receive it outside your test list (Meta's normal
   Business verification process) — a brand-new app can message a handful
   of test numbers immediately while that's pending.

Until `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` are set, checkout falls
back to the old behavior automatically: it opens the phone's native Share
sheet (pick WhatsApp → photo attached in one tap) or, if that's not
available, downloads the PNG and opens a WhatsApp chat asking staff to
attach it manually.

## Dish photos

Admin → **Menu Management** → each item has a **📷 Photo** button — pick an
image from the device, it uploads to the server and shows as a thumbnail on
the billing screen immediately for everyone.

## Security note

PINs are simple 4–8 character codes checked server-side now (not just in the
browser), which is a real improvement over the old offline version — but this
is still meant for trusted staff on a private device, not a public login page.
Don't expose the PINs anywhere public, and change the three default ones on
first deploy (Admin → Staff Access).
