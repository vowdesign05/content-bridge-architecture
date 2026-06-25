// app/offline-admin.server.ts
import { unauthenticated } from "./shopify.server";

export async function getAdminFromOffline(shop: string) {
  if (!shop) return null;
  // 公式：offline session を使って admin を作る
  return await unauthenticated.admin(shop);
}
