import { Form, useLoaderData, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify embedded app: host が来る（shopが無いタイミングもある）
  const hasHost = url.searchParams.has("host");
  const hasShop = url.searchParams.has("shop");

  // ✅ host or shop が来ているなら、必ず /app に寄せる
  if (hasHost || hasShop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // それ以外（＝Shopify外から直アクセス等）だけログインフォーム
  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Content Bridge</h1>
        <p className={styles.text}>
          Connect WordPress posts to product pages with a theme app block.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
