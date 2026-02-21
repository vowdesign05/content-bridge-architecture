import type { Post } from "../logic/resolvePosts";
import { PostList } from "../components/PostList";

const samplePosts: Post[] = [
  { id: 1, title: "Hello World", slug: "hello-world" },
  { id: 2, title: "Shopify x WordPress", slug: "shopify-wp" },
];

export default function ReactDemo() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Content Bridge – React Demo</h1>
      <p style={{ opacity: 0.8 }}>
        This is a minimal React component demo using typed props.
      </p>

      <PostList title="Sample Posts" posts={samplePosts} />
      <PostList title="Empty State" posts={[]} />
    </main>
  );
}