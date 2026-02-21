import posts from "../../examples/wp-posts.json";

export async function fetchPosts(): Promise<typeof posts> {
  // simulate async call
  return new Promise((resolve) => {
    setTimeout(() => resolve(posts), 200);
  });
}