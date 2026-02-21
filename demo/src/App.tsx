import { useMemo, useState } from "react";
import "./App.css";
import { PostList, type DemoPost } from "./components/PostList";

/* --- demo内で完結する簡易ロジック --- */

type FallbackMode = "latest" | "none";

function clampInt(v: string, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function resolvePosts({
  matched,
  latest,
  mode,
}: {
  matched: DemoPost[];
  latest: DemoPost[];
  mode: FallbackMode;
}) {
  if (matched.length > 0) return matched;
  return mode === "latest" ? latest : [];
}

export default function App() {
  const [mode, setMode] = useState<FallbackMode>("latest");
  const [limitInput, setLimitInput] = useState("3");

  const limit = clampInt(limitInput, 1, 10, 3);

  const latestPosts: DemoPost[] = [
    { id: 1, title: "Latest Post A", slug: "latest-a" },
    { id: 2, title: "Latest Post B", slug: "latest-b" },
    { id: 3, title: "Latest Post C", slug: "latest-c" },
  ];

  const matchedPosts: DemoPost[] = [];

  const finalPosts = useMemo(() => {
    return resolvePosts({
      matched: matchedPosts.slice(0, limit),
      latest: latestPosts.slice(0, limit),
      mode,
    });
  }, [mode, limit]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Content Bridge – Demo</h1>

      <div style={{ marginBottom: 20 }}>
        <label>
          Fallback mode:
          <select value={mode} onChange={(e) => setMode(e.target.value as FallbackMode)}>
            <option value="latest">latest</option>
            <option value="none">none</option>
          </select>
        </label>

        <div style={{ marginTop: 10 }}>
          <label>
            Limit:
            <input
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              style={{ marginLeft: 10, width: 60 }}
            />
          </label>
        </div>
      </div>

      <PostList posts={finalPosts} title="Resolved Posts" />
    </div>
  );
}