// /api/payment-callback.js — Toyyibpay calls this server-to-server after payment.
// Verifies the transaction with Toyyibpay, then marks the user subscribed in Supabase.
//
// Required Vercel env vars:
//   TOYYIBPAY_SECRET_KEY       — same key as payment.js
//   SUPABASE_URL               — e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase service_role key (Settings → API). NEVER put this in frontend code.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // Toyyibpay sends form-encoded: refno, status, reason, billcode, order_id, amount...
  // status: 1 = success, 2 = pending, 3 = fail
  const { status, billcode, order_id } = req.body || {};

  // Always respond 200 so Toyyibpay doesn't retry forever; just skip non-success.
  if (status !== '1' || !billcode || !order_id) {
    return res.status(200).send('OK');
  }

  try {
    // ── Step 1: Verify with Toyyibpay directly (never trust the callback alone) ──
    const verifyParams = new URLSearchParams({
      userSecretKey: process.env.TOYYIBPAY_SECRET_KEY,
      billCode: billcode
    });
    const vr = await fetch('https://toyyibpay.com/index.php/api/getBillTransactions', {
      method: 'POST',
      body: verifyParams
    });
    const txns = await vr.json();
    const paid = Array.isArray(txns) && txns.some(t => t.billpaymentStatus === '1');

    if (!paid) {
      console.warn('Callback claimed success but Toyyibpay verification failed:', billcode);
      return res.status(200).send('OK');
    }

    // ── Step 2: Mark user subscribed for 31 days ──
    const end = new Date();
    end.setDate(end.getDate() + 31);

    const upd = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(order_id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          is_subscribed: true,
          subscription_end: end.toISOString(),
          last_bill_code: billcode
        })
      }
    );

    if (!upd.ok) {
      console.error('Supabase profile update failed:', upd.status, await upd.text());
    }

    return res.status(200).send('OK');
  } catch (e) {
    console.error('payment-callback error:', e);
    return res.status(200).send('OK');
  }
}
