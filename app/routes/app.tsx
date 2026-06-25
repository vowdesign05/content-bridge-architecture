// app/routes/app.tsx

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { I18nProvider } from "../i18n/I18nProvider";
import {
  authenticate,
  BILLING_ENABLED,
  BILLING_TEST,
  CONTENT_BRIDGE_PLAN,
} from "../shopify.server";
import { hasActiveShopifyAppSubscription } from "../billing.server";

function getBillingReturnUrl(request: Request, shop: string) {
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "content-bridge";
  const cleanShopName = shop.replace(".myshopify.com", "");
  const fallback = new URL("/app", request.url).toString();

  if (!cleanShopName) return fallback;

  return `https://admin.shopify.com/store/${cleanShopName}/apps/${appHandle}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) return new Response("Missing SHOPIFY_API_KEY", { status: 500 });

  const url = new URL(request.url);
  const { admin, billing, redirect, session } = await authenticate.admin(request);

  if (BILLING_ENABLED) {
    await billing.require({
      plans: [CONTENT_BRIDGE_PLAN],
      isTest: BILLING_TEST,
      onFailure: async () =>
        billing.request({
          plan: CONTENT_BRIDGE_PLAN,
          isTest: BILLING_TEST,
          returnUrl: getBillingReturnUrl(request, session.shop),
        }),
    });
  } else if (!url.pathname.startsWith("/app/billing")) {
    const hasActiveSubscription = await hasActiveShopifyAppSubscription(admin);
    if (!hasActiveSubscription) {
      return redirect("/app/billing");
    }
  }

  return { apiKey };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <ShopifyAppProvider apiKey={apiKey} embedded>
      <PolarisProvider i18n={enTranslations}>
        <I18nProvider>
          <Outlet />
        </I18nProvider>
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

