import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./db.server";

export const CONTENT_BRIDGE_PLAN =
  (process.env.SHOPIFY_BILLING_PLAN_NAME || "Content Bridge Monthly") as "Content Bridge Monthly";
export const BILLING_ENABLED = process.env.SHOPIFY_BILLING_ENABLED !== "false";
export const BILLING_TEST =
  process.env.SHOPIFY_BILLING_TEST === "true" || process.env.NODE_ENV !== "production";

const billingAmount = Number(process.env.SHOPIFY_BILLING_AMOUNT || "5");
const billingCurrency = process.env.SHOPIFY_BILLING_CURRENCY || "USD";
const billingTrialDays = Number(process.env.SHOPIFY_BILLING_TRIAL_DAYS || "0");

const billing = {
  [CONTENT_BRIDGE_PLAN]: {
    ...(billingTrialDays > 0 ? { trialDays: billingTrialDays } : {}),
    lineItems: [
      {
        amount: billingAmount,
        currencyCode: billingCurrency,
        interval: BillingInterval.Every30Days as BillingInterval.Every30Days,
      },
    ],
  },
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/api/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export { shopify };
