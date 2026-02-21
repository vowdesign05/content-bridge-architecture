import { useMemo, useState } from "react";
import "./App.css";
import { PostList } from "../../src/components/PostList";
import { clampInt } from "../../src/utils/clampInt";
import { resolvePosts, type FallbackMode, type Post } from "../../src/logic/resolvePosts";

// ✅ モックWPデータ（本番WP/APIキー不要）
import wpPosts from "../../examples/wp-posts.json";

type WpPost = Post & {
  // 「taxonomyっぽい」属性をモックで持たせる（安全に“つないでる感”を出す）
  tax?: string;
  term?: string;
};

const allPosts = wpPosts as unknown as WpPost[];

export default function App() {
  // ShopifyのmetafieldやApp Proxy queryを想定した入力欄
  const [tax, setTax] = useState("category");
  const [term, setTerm] = useState("portableconsole");
  const [limitText, setLimitText] = useState("4");
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>("latest");

  const limit = useMemo(() => clampInt(limitText, 1, 12, 4), [limitText]);

  // ① “WPから取得した結果”をフィルタ（tax/term一致）
  const matched = useMemo(() => {
    const t = tax.trim();
    const r = term.trim();
    if (!t || !r) return [];
    return allPosts
      .filter((p) => p.tax === t && p.term === r)
      .slice(0, limit);
  }, [tax, term, limit]);

  // ② “最新記事”をモック（fallback用）
  const latest = useMemo(() => allPosts.slice(0, limit), [limit]);

  // ③ Content Bridgeの根幹：一致しない時のfallback解決
  const resolved = useMemo(
    () => resolvePosts({ matched, latest, mode: fallbackMode }),
    [matched, latest, fallbackMode]
  );

  // ④ UI表示：Matched / Resolvedの違いが見えるように
  const statusLabel =
    matched.length > 0
      ? `Matched: ${matched.length}`
      : `No match → fallback: ${fallbackMode}`;

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>Content Bridge – Demo</h1>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Simulates <strong>Shopify query → WP fetch → match → fallback → render</strong> using mocked WordPress data.
        </p>
      </header>

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Query Controls (App Proxy / Metafield simulation)</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>tax</span>
            <input value={tax} onChange={(e) => setTax(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>term</span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>limit (1–12)</span>
            <input
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              inputMode="numeric"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>fallback</span>
            <select
              value={fallbackMode}
              onChange={(e) => setFallbackMode(e.target.value as FallbackMode)}
            >
              <option value="latest">latest</option>
              <option value="none">none</option>
            </select>
          </label>
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.8 }}>
          Status: <strong>{statusLabel}</strong> / limit used: <strong>{limit}</strong>
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <PostList title="Matched posts (tax/term)" posts={matched} />
        </section>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <PostList title="Rendered result (after fallback)" posts={resolved} />
        </section>
      </div>

      <details style={{ marginTop: 16, opacity: 0.9 }}>
        <summary style={{ cursor: "pointer" }}>Show mock dataset</summary>
        <pre style={{ fontSize: 12, overflowX: "auto" }}>
{JSON.stringify(allPosts.slice(0, 20), null, 2)}
        </pre>
      </details>
    </main>
  );
}