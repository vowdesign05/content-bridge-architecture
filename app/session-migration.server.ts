import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

type AdminAuthenticate = (request: Request, ...args: unknown[]) => Promise<unknown>;

type MigrationScope = {
  hideLegacyOfflineSession: boolean;
};

function shopFromRequest(request: Request) {
  const url = new URL(request.url);
  const queryShop = url.searchParams.get("shop");
  if (queryShop?.endsWith(".myshopify.com")) return queryShop;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const shop = new URL(decoded.dest).hostname;
    return shop.endsWith(".myshopify.com") ? shop : null;
  } catch {
    return null;
  }
}

function isLegacyOfflineSession(session: Session | undefined) {
  return Boolean(session && !session.isOnline && !session.expires);
}

export function createSessionMigration(base: SessionStorage) {
  const scope = new AsyncLocalStorage<MigrationScope>();
  const locks = new Map<string, Promise<unknown>>();

  const sessionStorage: SessionStorage = {
    storeSession: (session) => base.storeSession(session),
    deleteSession: (id) => base.deleteSession(id),
    deleteSessions: (ids) => base.deleteSessions(ids),
    findSessionsByShop: (shop) => base.findSessionsByShop(shop),
    async loadSession(id) {
      const session = await base.loadSession(id);
      if (scope.getStore()?.hideLegacyOfflineSession && isLegacyOfflineSession(session)) {
        return undefined;
      }
      return session;
    },
  };

  function wrapAdmin<T extends AdminAuthenticate>(authenticate: T): T {
    return (async (request: Request, ...args: unknown[]) => {
      const shop = shopFromRequest(request);
      if (!shop) {
        return scope.run({ hideLegacyOfflineSession: true }, () =>
          authenticate(request, ...args)
        );
      }

      const stored = await base.loadSession(`offline_${shop}`);
      if (!isLegacyOfflineSession(stored)) {
        return authenticate(request, ...args);
      }

      const existing = locks.get(shop);
      if (existing) {
        await existing;
        return authenticate(request, ...args);
      }

      const migration = scope.run({ hideLegacyOfflineSession: true }, () =>
        authenticate(request, ...args)
      );
      locks.set(shop, migration);

      try {
        return await migration;
      } finally {
        if (locks.get(shop) === migration) locks.delete(shop);
      }
    }) as T;
  }

  return { sessionStorage, wrapAdmin };
}
