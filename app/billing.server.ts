import { getAdminFromOffline } from "./offline-admin.server";

type AdminContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphql: (query: string, options?: any) => Promise<Response>;
};

type AppSubscription = {
  status?: string;
};

const CURRENT_APP_SUBSCRIPTIONS_QUERY = `#graphql
  query CurrentAppSubscriptionStatus {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

export async function hasActiveShopifyAppSubscription(admin: AdminContext) {
  const res = await admin.graphql(CURRENT_APP_SUBSCRIPTIONS_QUERY);
  const data = await res.json();
  const subscriptions =
    data?.data?.currentAppInstallation?.activeSubscriptions ?? [];

  return subscriptions.some(
    (subscription: AppSubscription) => subscription?.status === "ACTIVE"
  );
}

export async function hasActiveSubscriptionForShop(shop: string) {
  const offline = await getAdminFromOffline(shop);
  if (!offline?.admin) return false;

  return hasActiveShopifyAppSubscription(offline.admin);
}
