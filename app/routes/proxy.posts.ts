import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { hasActiveSubscriptionForShop } from "../billing.server";

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = v === null ? NaN : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getPostField(post: unknown, key: string) {
  const record = asRecord(post);
  if (!record) return "";
  const value = record[key];
  const nested = asRecord(value);
  return getString(nested?.rendered) || getString(value);
}

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ✅ App Proxy署名検証 + shop取得
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: jsonHeaders,
    });
  }
  const shop = session.shop;

  const hasActiveSubscription = await hasActiveSubscriptionForShop(shop);
  if (!hasActiveSubscription) {
    return new Response(
      JSON.stringify({ items: [], error: "Billing plan required" }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 12, 4);
  const tax = (url.searchParams.get("tax") || "").trim();
  const term = (url.searchParams.get("term") || "").trim();

  const settings = await prisma.settings.findUnique({ where: { shop } });

  const endpoint = settings?.wpEndpoint || process.env.WP_POSTS_ENDPOINT;
  const apiKey = settings?.wpApiKey || process.env.WP_API_KEY;

  if (!endpoint || !apiKey) {
    return new Response(
      JSON.stringify({ items: [], error: "WP settings missing (open app settings)" }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const wpUrl = new URL(endpoint);
  wpUrl.searchParams.set("per_page", String(limit));
  if (tax && term) {
    wpUrl.searchParams.set("tax", tax);
    wpUrl.searchParams.set("term", term);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(wpUrl.toString(), {
      headers: {
        Accept: "application/json",
        "X-Content-Bridge-Key": apiKey,
      },
      signal: controller.signal,
    });

    // textで受けてからJSONパース（HTMLでも原因が見える）
    const raw = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }

    // WP側がエラーなら、開発中は理由を返す（本番は隠してもOK）
    if (!res.ok) {
      console.error("[CBC proxy] WP request failed", res.status);
      return new Response(
        JSON.stringify({ items: [] }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // ✅ WPの返りが {"items":[...]} なのでまず items を読む
    const bodyRecord = asRecord(body);
    const srcItems =
      (Array.isArray(bodyRecord?.items) && bodyRecord.items) ||
      (Array.isArray(bodyRecord?.posts) && bodyRecord.posts) ||
      (Array.isArray(bodyRecord?.data) && bodyRecord.data) ||
      (Array.isArray(body) && body) ||
      [];

    const items = srcItems.map((p) => {
      const post = asRecord(p);
      return {
        title: getPostField(p, "title"),
        url: getString(post?.url) || getString(post?.link),
        excerpt: getPostField(p, "excerpt"),
        image:
          getString(post?.image) ||
          getString(post?.thumbnail) ||
          getString(post?.featured_image),
        date: getString(post?.date),
      };
    });

    return new Response(JSON.stringify({ items }), { status: 200, headers: jsonHeaders });
  } catch (e: unknown) {
    console.error("[CBC proxy] fetch failed", e);
    return new Response(
      JSON.stringify({ items: [] }),
      { status: 200, headers: jsonHeaders }
    );
  } finally {
    clearTimeout(timer);
  }
};
