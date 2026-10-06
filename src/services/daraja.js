import axios from 'axios';

const SANDBOX = 'https://sandbox.safaricom.co.ke';
const PRODUCTION = 'https://api.safaricom.co.ke';

// Token cache: keyed by `${env}:${shortcode}:${consumerKey}` so rotating
// credentials on a shop automatically uses a fresh token.
const tokenCache = new Map();

async function getAccessToken(creds) {
  const key = `${creds.env}:${creds.shortcode}:${creds.consumerKey}`;
  const now = Date.now();
  const cached = tokenCache.get(key);

  if (cached && now < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const base = creds.env === 'production' ? PRODUCTION : SANDBOX;
  const auth = Buffer.from(
    `${creds.consumerKey}:${creds.consumerSecret}`,
  ).toString('base64');

  const { data } = await axios.get(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  const token = data.access_token;
  tokenCache.set(key, {
    token,
    expiresAt: now + Number(data.expires_in) * 1000,
  });
  return token;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export function normalizePhone(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.length === 9) return '254' + digits;
  return digits;
}

// ─── STK Push ───────────────────────────────────────────────
export async function initiateStkPush({
  credentials,
  phone,
  amount,
  accountRef,
  description,
  callbackUrl,
}) {
  const env = credentials.env === 'production' ? PRODUCTION : SANDBOX;
  const ts = timestamp();
  const pwd = Buffer.from(
    `${credentials.shortcode}${credentials.passkey}${ts}`,
  ).toString('base64');
  const msisdn = normalizePhone(phone);

  const token = await getAccessToken(credentials);

  const { data } = await axios.post(
    `${env}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: credentials.shortcode,
      Password: pwd,
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: msisdn,
      PartyB: credentials.shortcode,
      PhoneNumber: msisdn,
      CallBackURL: callbackUrl,
      AccountReference: accountRef,
      TransactionDesc: description,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

// ─── STK Push Query ─────────────────────────────────────────
// Ask Safaricom about the status of a pending STK Push.
// Uses the same credentials as STK Push — no initiator needed.
export async function queryStkPush({ credentials, checkoutRequestId }) {
  const env = credentials.env === 'production' ? PRODUCTION : SANDBOX;
  const ts = timestamp();
  const pwd = Buffer.from(
    `${credentials.shortcode}${credentials.passkey}${ts}`,
  ).toString('base64');

  const token = await getAccessToken(credentials);

  const { data } = await axios.post(
    `${env}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: credentials.shortcode,
      Password: pwd,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return data;
}

// Validate credentials by hitting the OAuth endpoint only.
// Fires no actual STK push.
export async function testCredentials(credentials) {
  await getAccessToken(credentials);
  return true;
}