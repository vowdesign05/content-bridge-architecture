import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { redirect } = await authenticate.admin(request);
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "content-bridge";

  return redirect(`shopify://admin/charges/${appHandle}/pricing_plans`, {
    target: "_parent",
  });
}
