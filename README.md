# Content Bridge -- Architecture Overview

This repository demonstrates the core architecture and logic behind
**Content Bridge**, a Shopify app that dynamically renders WordPress
content inside Shopify without duplicating posts.

⚠️ This is a public architecture version.\
All authentication logic, secrets, and production configurations have
been removed.

------------------------------------------------------------------------

## 🚀 What It Solves

Managing content across Shopify and WordPress often leads to:

-   Duplicate blog posts
-   Manual embeds
-   SEO fragmentation
-   Content sync complexity

Content Bridge keeps **WordPress as the source of truth** and
dynamically fetches content into Shopify via App Proxy.

------------------------------------------------------------------------

## 🏗 High-Level Architecture

    Shopify (Metafield mapping)
            ↓
    App Proxy
            ↓
    Server (Remix-based architecture)
            ↓
    WordPress REST API
            ↓
    Normalize & Transform
            ↓
    Fallback Resolution
            ↓
    Render in Shopify

------------------------------------------------------------------------

## 🧠 Core Design Concepts

### 1️⃣ Responsibility Separation

The architecture isolates:

-   API communication (`services/`)
-   Business logic (`logic/`)
-   Utilities (`utils/`)
-   Route handling (`routes/`)

This ensures maintainability and testability.

------------------------------------------------------------------------

### 2️⃣ Safe Parameter Handling

Input parameters are validated and clamped:

``` ts
export function clampInt(
  v: string | null,
  min: number,
  max: number,
  fallback: number
) {
  const n = v === null ? NaN : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
```

This prevents invalid requests and enforces predictable behavior.

------------------------------------------------------------------------

### 3️⃣ Pure Fallback Logic

Content resolution is handled by a pure function:

``` ts
export function resolvePosts({
  matched,
  latest,
  mode,
}: {
  matched: Post[];
  latest: Post[];
  mode: "latest" | "none";
}): Post[] {
  if (matched.length > 0) return matched;
  return mode === "latest" ? latest : [];
}
```

If no matched posts are found:

-   `"latest"` → return recent posts\
-   `"none"` → return empty array

This makes fallback behavior configurable and testable.

------------------------------------------------------------------------

### 4️⃣ Secure by Design

This public version removes:

-   Shopify OAuth flow
-   Session handling
-   Webhook verification
-   API keys
-   Database schema

All external calls are mocked to demonstrate logic safely.

------------------------------------------------------------------------

## 🛠 Tech Stack (Production Version)

-   Remix
-   React
-   TypeScript
-   Prisma
-   Shopify App Proxy
-   WordPress REST API
-   Fly.io (deployment)
-   SQLite with replication

------------------------------------------------------------------------

## 📁 Project Structure

    src/
      utils/
      logic/
      services/
      routes/
    examples/
    docs/

------------------------------------------------------------------------

## 📌 Engineering Focus

-   Separation of concerns
-   Pure business logic
-   Controlled data flow
-   Typed API integration
-   Defensive programming
-   Timeout & structured error handling

------------------------------------------------------------------------

## 🔮 Future Improvements

-   Edge caching layer
-   API response caching
-   Incremental static rendering
-   Multi-source CMS support
-   Advanced filtering system

------------------------------------------------------------------------

## 👨‍💻 Author

Tomo Shiotani\
Frontend / Product-minded Developer\
Building Shopify × WordPress integrations
