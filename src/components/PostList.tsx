import type { Post } from "../logic/resolvePosts";

type Props = {
  posts: Post[];
  title?: string;
};

export function PostList({ posts, title = "Posts" }: Props) {
  return (
    <section>
      <h2>{title}</h2>

      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <strong>{post.title}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>slug: {post.slug}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}