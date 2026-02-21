import { clampInt } from "../utils/clampInt";
import { fetchPosts } from "../services/wpClient.mock";
import { resolvePosts } from "../logic/resolvePosts";

export async function demo(query: URLSearchParams) {
  const limit = clampInt(query.get("limit"), 1, 10, 4);

  const posts = await fetchPosts();

  const matched = posts.slice(0, limit);
  const latest = posts;

  return resolvePosts({
    matched,
    latest,
    mode: "latest",
  });
}