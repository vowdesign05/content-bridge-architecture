export type DemoPost = {
  id: number | string;
  title: string;
  slug: string;
};

type Props = {
  posts: DemoPost[];
  title?: string;
};

export function PostList({ posts, title = "Posts" }: Props) {
  return (
    <section>
      <h2>{title}</h2>

      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <ul class="postlist">
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