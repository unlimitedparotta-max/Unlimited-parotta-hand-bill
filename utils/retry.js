/* Generic retry-with-backoff helper — not wired into anything yet, but
   ready for the delivery-fallback steps (e.g. retrying a flaky WhatsApp/
   SMS API call before giving up and falling through to the next channel).
   Usage: await retry(() => sendWhatsAppText(mobile, msg), { attempts: 3 }) */
async function retry(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

module.exports = { retry };
