import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const reload = url.searchParams.get("shopify-reload");

  // shopify-reload が来たら必ずリダイレクトで返す（JSONなど返さない）
  if (reload) {
    return new Response(null, {
      status: 303, // 302でも可。303の方が安全寄り
      headers: {
        Location: reload,
        "Cache-Control": "no-store",
      },
    });
  }

  // 何も表示しない
  return new Response(null, { status: 204 });
}
