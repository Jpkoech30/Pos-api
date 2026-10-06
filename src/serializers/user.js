export function shapeUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    role: row.role,
    shopId: row.shop_id != null ? String(row.shop_id) : null,
    isActive: row.is_active !== false,
    hasPin: Boolean(row.pin_hash),
    createdAt: row.created_at,
  };
}
