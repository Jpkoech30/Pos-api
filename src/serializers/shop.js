import { DEFAULT_VAT_RATE } from '../config/constants.js';

export function shapeShop(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    mpesaNumber: row.mpesa_number ?? null,
    address: row.address ?? null,
    stkEnabled: row.stk_enabled === true,
    darajaShortcode: row.daraja_shortcode ?? null,
    darajaEnv: row.daraja_env ?? 'sandbox',
    hasCredentials: Boolean(
      row.daraja_consumer_key &&
      row.daraja_consumer_secret &&
      row.daraja_passkey &&
      row.daraja_shortcode,
    ),
    vatRegistered: row.vat_registered === true,
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : DEFAULT_VAT_RATE,
    pricesIncludeVat: row.prices_include_vat !== false,
    createdAt: row.created_at,
  };
}