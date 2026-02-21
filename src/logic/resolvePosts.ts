export type FallbackMode = "latest" | "none";

export interface Post {
  id: number;
  title: string;
  slug: string;
}

export function resolvePosts({
  matched,
  latest,
  mode,
}: {
  matched: Post[];
  latest: Post[];
  mode: FallbackMode;
}): Post[] {
  if (matched.length > 0) return matched;
  return mode === "latest" ? latest : [];
}