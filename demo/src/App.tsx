import { useMemo, useState } from "react";
import "./App.css";
import { PostList, type DemoPost } from "./components/PostList";
import wpPosts from "./mock/wp-posts.json";

type FallbackMode = "latest" | "none";

type WpPost = DemoPost & {
  tax: string;
  term: string;
};

// demo内で完結する clamp
function clampInt(v: string, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// demo内で完結する resolve
function resolvePosts(args: { matched: DemoPost[]; latest: DemoPost[]; mode: FallbackMode }) {
  const { matched, latest, mode } = args;
  if (matched.length > 0) return matched;
  return mode === "latest" ? latest : [];
}

const allPosts = wpPosts as unknown as WpPost[];

export default function App() {
  const [tax, setTax] = useState("category");
  const [term, setTerm] = useState("portableconsole");
  const [limitText, setLimitText] = useState("4");
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>("latest");

  const limit = useMemo(() => clampInt(limitText, 1, 12, 4), [limitText]);

  // “Fetch”体験：本当のHTTPは叩かず、ボタンで状態更新するだけ
  const [queryKey, setQueryKey] = useState(0);
  const onFetch = () => setQueryKey((k) => k + 1);

  const trimmed = useMemo(() => {
    return {
      t: tax.trim().toLowerCase(),
      r: term.trim().toLowerCase(),
    };
  }, [tax, term]);

  const matched = useMemo(() => {
    // queryKeyを依存に入れることで「Fetch押した時だけ結果が更新される」体験になる
    void queryKey;

    if (!trimmed.t || !trimmed.r) return [];
    return allPosts
      .filter(
        (p) => (p.tax ?? "").toLowerCase() === trimmed.t && (p.term ?? "").toLowerCase() === trimmed.r
      )
      .slice(0, limit);
  }, [trimmed, limit, queryKey]);

  const latest = useMemo(() => allPosts.slice(0, limit), [limit]);

  const resolved = useMemo(
    () => resolvePosts({ matched, latest, mode: fallbackMode }),
    [matched, latest, fallbackMode]
  );

  const status =
    matched.length > 0 ? `Matched: ${matched.length}` : `No match → fallback: ${fallbackMode}`;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ marginBottom: 6 }}>Content Bridge – Demo</h1>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Simulated App Proxy query → “WP fetch” → match → fallback → render (mocked data).
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
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Query Controls</h2>

        <div className="query-row" 
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
            <input value={limitText} onChange={(e) => setLimitText(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>fallback</span>
            <select value={fallbackMode} onChange={(e) => setFallbackMode(e.target.value as FallbackMode)}>
              <option value="latest">latest</option>
              <option value="none">none</option>
            </select>
          </label>

          <button onClick={onFetch} style={{ borderRadius: 10 }}>
            Fetch
          </button>
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.8 }}>
          Status: <strong>{status}</strong> / limit used: <strong>{limit}</strong>
        </p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <section style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: 16 }}>
          <PostList title="Matched posts (tax/term)" posts={matched} />
        </section>

        <section style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: 16 }}>
          <PostList title="Rendered result (after fallback)" posts={resolved} />
        </section>
      </div>

      <details style={{ marginTop: 16, opacity: 0.9 }}>
        <summary style={{ cursor: "pointer",  textAlign: "left" }}>Show mock dataset</summary>
        <pre style={{ fontSize: 12, overflowX: "auto", textAlign: "left" }}>
{JSON.stringify(allPosts, null, 2)}
        </pre>
      </details>
    </main>
  );
}