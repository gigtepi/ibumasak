// /api/payment.js — Creates a Toyyibpay bill for the Ibumasak subscription.
// Frontend POSTs { email, userId } → returns { paymentUrl } to redirect to.
//
// Required Vercel env vars:
//   TOYYIBPAY_SECRET_KEY     — from Toyyibpay dashboard
//   TOYYIBPAY_CATEGORY_CODE  — your bill category code

const SITE_URL = 'https://ibumasak.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userId } = req.body || {};
  if (!email || !userId) {
    return res.status(400).json({ error: 'Missing email or userId' });
  }

  const params = new URLSearchParams({
    userSecretKey: process.env.TOYYIBPAY_SECRET_KEY,
    categoryCode: process.env.TOYYIBPAY_CATEGORY_CODE,
    billName: 'Ibumasak Langganan',            // max 30 chars
    billDescription: 'Langganan Ibumasak — 1 bulan tanya tanpa had',
    billPriceSetting: '1',                     // 1 = fixed amount
    billPayorInfo: '1',                        // collect payer info (prefilled below)
    billAmount: '200',                         // in sen → RM2.00 (RM1 + RM1 processing)
    billReturnUrl: `${SITE_URL}/?payment=success`,
    billCallbackUrl: `${SITE_URL}/api/payment-callback`,
    billExternalReferenceNo: userId,           // Supabase user id — used by callback
    billTo: email.split('@')[0],
    billEmail: email,
    billPhone: '0000000000',
    billPaymentChannel: '0',                   // 0 = FPX only
    billChargeToCustomer: '1'
  });

  try {
    const r = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      body: params
    });
    const data = await r.json();

    const billCode = Array.isArray(data) && data[0] && data[0].BillCode;
    if (!billCode) {
      console.error('Toyyibpay createBill unexpected response:', data);
      return res.status(502).json({ error: 'Toyyibpay rejected the bill request' });
    }

    return res.status(200).json({ paymentUrl: `https://toyyibpay.com/${billCode}` });
  } catch (e) {
    console.error('createBill failed:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
