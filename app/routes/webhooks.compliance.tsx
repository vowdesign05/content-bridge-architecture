import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Compliance webhook: ${topic} for ${shop}`);

  // This app does not store customer personal data.
  // Respond 200-series to acknowledge receipt.
  return new Response("OK");
};
