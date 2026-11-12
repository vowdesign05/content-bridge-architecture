# Shopify security update status (November 2026)

Reviewed on 2026-11-12 for the Content Bridge public app.

## Required controls

| Requirement | Status |
| --- | --- |
| Expiring offline access tokens | Enabled in `app/shopify.server.ts`. Production has 4 offline sessions and 0 non-expiring sessions. |
| Legacy-session migration | Admin-only migration wrapper added. It never deletes or preemptively overwrites a legacy row, and it does not affect webhooks, app proxy, or background reads. |
| IP allowlist | Production egress identified for the free ASN + country option. Shopify Dev Dashboard enforcement still needs owner confirmation. |
| Bulk operations scopes | Not applicable. This repository contains no bulk query or mutation use. |

Shopify requires the IP allowlist for public apps by November 20, 2026 at
11:59 PM ET. Public apps using non-expiring offline tokens are delisted and
blocked from new installs on January 1, 2027.

## Free IP allowlist configuration

Content Bridge runs one Fly Machine in `ams`. Production observations on
2026-11-12 returned dynamic egress addresses `216.246.119.86` and
`2605:4c40:119:f110::b470`. Both resolve to CacheFly, AS30081, in NL
(Netherlands). These are observations, not static addresses to register.

In the Shopify Dev Dashboard for client ID
`81fbf8b978983516a7e7fb3047cb2007`, configure:

- Network (ASN): `AS30081`
- Limit ASN to country: `Netherlands`
- Enforcement: enabled after testing against recent traffic

This uses Shopify's supported ASN + country mode and does not require buying a
Fly static egress address. Recheck the rule whenever the Fly region, provider,
or outbound network changes.

## Token behavior

`future.expiringOfflineAccessTokens` makes new token exchanges return expiring
access and refresh tokens. The installed Shopify React Router SDK refreshes an
offline token near expiry for app proxy, webhook, and unauthenticated admin
contexts when a valid refresh token exists.

`app/session-migration.server.ts` is a safety net for any legacy row that might
remain or be restored from backup. During authenticated admin requests only, a
legacy offline session is treated as missing so the SDK exchanges the verified
Shopify session token for an expiring pair. The original row remains intact if
the exchange or persistence fails. Per-shop locks prevent duplicate exchange
requests in the current single-process deployment.

Two of the four production refresh tokens were valid at the audit time. An
expired refresh token requires the merchant to reopen the embedded app, which
lets the SDK acquire a fresh token pair. Token values were not read or logged.

## Verification

Run:

```sh
npm run test:auth
npm run typecheck
npm run build
```

After deployment, verify the public endpoint, open an installed store's app,
and check only expiry/refresh metadata and aggregate counts. Never print token
values. After enabling the allowlist, make one authenticated read-only Admin API
request from production and confirm it succeeds.

References:

- https://shopify.dev/changelog/blog/app-security-updates-ip-allowlist-is-now-required
- https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens
- https://shopify.dev/changelog/posts/app-ip-allowlists-now-support-apps-with-serverless-hosting
