// app/routes/app._index.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useSubmit,
  useNavigate,
} from "react-router";

import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Badge,
  List,
  InlineCode,
  Divider,
  Box,
} from "@shopify/polaris";
import { SettingsIcon, ThemeEditIcon } from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { useI18n } from "../i18n/I18nProvider";
import { CONTENT_BRIDGE_METAFIELD } from "../metafields";
import { getMetafieldDefinitionStatus } from "../metafields.server";

/** ざっくり「配列っぽい投稿データ」を数える（WP側の形式が変わっても耐える） */
type ActionResponse = {
  ok: boolean;
  message: string;
  details?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractPostsCount(payload: unknown): number | null {
  if (!payload) return null;

  if (Array.isArray(payload)) return payload.length;

  const record = asRecord(payload);
  if (!record) return null;

  const candidates = [record.posts, record.items, record.data, record.results];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.length;
  }

  const data = asRecord(record.data);
  if (Array.isArray(data?.posts)) return data.posts.length;

  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const planHandle = url.searchParams.get("plan_handle") ?? "";
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "content-bridge";

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = shop ? await prisma.settings.findUnique({ where: { shop } }) : null;
  const wpEndpoint = settings?.wpEndpoint ?? "";
  const wpApiKey = settings?.wpApiKey ?? "";

  const metafield = await getMetafieldDefinitionStatus(admin);
  const themeEditorUrl = shop
    ? `https://${shop}/admin/themes/current/editor?template=product`
    : "";
  const cleanShopName = shop.replace(".myshopify.com", "");
  const pricingPlansUrl = cleanShopName
    ? `https://admin.shopify.com/store/${cleanShopName}/charges/${appHandle}/pricing_plans`
    : "";

  return {
    shop,
    planHandle,
    wpEndpoint,
    wpApiKeySet: Boolean(wpApiKey),
    wpEndpointSet: Boolean(wpEndpoint),
    metafield,
    themeEditorUrl,
    pricingPlansUrl,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent !== "test_wp") {
    return { ok: false, message: "Unknown action." };
  }

  const settings = await prisma.settings.findUnique({ where: { shop } });

  const wpEndpoint = String(settings?.wpEndpoint ?? "").trim();
  const wpApiKey = String(settings?.wpApiKey ?? "").trim();

  if (!wpEndpoint) return { ok: false, message: "WP Posts Endpoint is not set. Go to Settings." };
  if (!wpApiKey) return { ok: false, message: "WP API Key is not set. Go to Settings." };

  // timeout付き（6秒）
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(wpEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Content-Bridge-Key": wpApiKey,
      },
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    let json: unknown = null;
    let text = "";

    if (contentType.includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        text = await res.text().catch(() => "");
      }
    } else {
      text = await res.text().catch(() => "");
    }

    if (!res.ok) {
      const preview =
        (text || (json ? JSON.stringify(json) : "")).slice(0, 240) || "(empty response)";
      return {
        ok: false,
        message: `Connection failed: ${res.status} ${res.statusText}`,
        details: preview,
      };
    }

    const count = extractPostsCount(json);
    return {
      ok: true,
      message: count === null ? "Connected. (200 OK)" : `Connected. (200 OK) Posts: ${count}`,
    };
  } catch (e: unknown) {
    const isAbort = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      message: isAbort
        ? "Connection timed out. Please check endpoint/firewall."
        : "Network error. Please check endpoint and server availability.",
      details: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

function StatusRow({
  title,
  description,
  ok,
  action,
}: {
  title: string;
  description: ReactNode;
  ok: boolean;
  action?: ReactNode;
}) {
  return (
    <Box paddingBlock="300">
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {title}
          </Text>
          <Badge tone={ok ? "success" : "warning"}>{ok ? "OK" : "Needs setup"}</Badge>
        </InlineStack>
        <Text as="p" variant="bodyMd" tone="subdued">
          {description}
        </Text>
        {action ? <InlineStack>{action}</InlineStack> : null}
      </BlockStack>
    </Box>
  );
}

function PanelCard({
  title,
  children,
  headerColor = "#00ee2a",
}: {
  title: ReactNode;
  children: ReactNode;
  headerColor?: string;
}) {
  return (
    <Card padding="0">
      <div style={{ overflow: "hidden", borderRadius: "8px" }}>
        <div
          style={{
            background: headerColor,
            color: "#111111",
            padding: "16px 20px",
          }}
        >
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </Card>
  );
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionResponse | undefined;
  const nav = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  const { search } = useLocation();

  const { t } = useI18n();
  const nsKey = CONTENT_BRIDGE_METAFIELD.qualifiedKey;

  const testing = nav.state !== "idle" && nav.formData?.get("intent") === "test_wp";

  const wpConfigured = data.wpEndpointSet && data.wpApiKeySet;

  const mf = data.metafield ?? ({ hasProduct: null } as const);
  const isChecking = mf.hasProduct === null;

  // ★Homeは入力がないので無条件で自動リロード
  useEffect(() => {
    if (!isChecking) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, 3500);
    return () => clearTimeout(t);
  }, [isChecking]);
  const mfProduct = mf.hasProduct === true;

  // ✅ search（host等）を保持したまま settings に遷移
  const settingsTo = `/app/settings${search || ""}`;
  const goSettings = () => navigate(settingsTo);
  const goBilling = () => {
    if (!data.pricingPlansUrl) return;
    window.open(data.pricingPlansUrl, "_top");
  };

  const runTest = () => {
    const fd = new FormData();
    fd.set("intent", "test_wp");
    submit(fd, { method: "post" });
  };

  return (
    <Page
      title={t("home.pageTitle")}
      subtitle={t("home.pageSubtitle")}
      primaryAction={{
        content: t("home.settings"),
        icon: SettingsIcon,
        onAction: goSettings,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionData?.message ? (
              <Banner tone={actionData.ok ? "success" : "critical"} title={actionData.message}>
                {actionData.details ? (
                  <Text as="p" variant="bodyMd">
                    <InlineCode>{actionData.details.slice(0, 240)}</InlineCode>
                  </Text>
                ) : null}
              </Banner>
            ) : null}

            {data.planHandle ? (
              <Banner tone="success" title="Your plan is active">
                <Text as="p" variant="bodyMd">
                  Thanks for choosing a Content Bridge plan. You can now connect WordPress and add the app block to your theme.
                </Text>
              </Banner>
            ) : null}

            <PanelCard title={t("home.quickStart")}>
              <BlockStack gap="300">
                <List type="number">
                  <List.Item>
                    {t("home.qs1Prefix")} <InlineCode>{t("home.settings")}</InlineCode> {t("home.qs1Suffix")}
                  </List.Item>
                  <List.Item>
                    In the theme app block, choose the WordPress taxonomy and store value to match.
                  </List.Item>
                  <List.Item>
                    Optional: use <InlineCode>{nsKey}</InlineCode> when a product needs its own WordPress category or tag slug.
                  </List.Item>
                </List>

                <InlineStack gap="200">
                  <Button variant="secondary" onClick={runTest} loading={testing} disabled={!wpConfigured}>
                    {t("home.testConnection")}
                  </Button>
                </InlineStack>

                {!wpConfigured ? (
                  <Banner tone="warning" title={t("home.wpNotConfiguredTitle")}>
                    {t("home.wpNotConfiguredBody")}
                  </Banner>
                ) : null}
              </BlockStack>
            </PanelCard>

            <PanelCard title="Theme app extension setup">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Add the Content Bridge app block to a product template so related WordPress posts can appear on storefront product pages.
                </Text>
                <List type="number">
                  <List.Item>Open the theme editor for your current theme.</List.Item>
                  <List.Item>
                    Select a product template, then add the <InlineCode>Content Bridge Post</InlineCode> app block.
                  </List.Item>
                  <List.Item>Move the block to the desired position, configure its heading and matching settings, then save the theme.</List.Item>
                  <List.Item>
                    Make sure the app proxy path <InlineCode>/apps/content-bridge/posts</InlineCode> is reachable on the storefront.
                  </List.Item>
                </List>
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    icon={ThemeEditIcon}
                    url={data.themeEditorUrl}
                    external
                    disabled={!data.themeEditorUrl}
                  >
                    Open theme editor
                  </Button>
                </InlineStack>
                <Banner tone="info" title="This app uses an app block">
                  <Text as="p" variant="bodyMd">
                    Content Bridge does not require an app embed. Install the app block on product templates where related posts should appear.
                  </Text>
                </Banner>
              </BlockStack>
            </PanelCard>

            <PanelCard title={t("home.status")}>
              <BlockStack gap="400">
                <StatusRow
                  title="App pricing"
                  ok={true}
                  description={
                    data.planHandle ? (
                      <>
                        Your plan is active and Content Bridge features are available for this store.
                      </>
                    ) : (
                      <>
                        Your subscription is managed through the platform billing flow. You can review or change your plan anytime.
                      </>
                    )
                  }
                  action={
                    <Button onClick={goBilling} disabled={!data.pricingPlansUrl}>
                      Manage plan
                    </Button>
                  }
                />
                <Divider />
                <StatusRow
                  title="WordPress settings"
                  ok={wpConfigured}
                  description={wpConfigured ? <>{t("home.wpSettingsOk")}</> : <>{t("home.wpSettingsNg")}</>}
                />
                <Divider />
                <StatusRow
                  title="Product term override"
                  ok={mfProduct === true}
                  description={
                    mfProduct === null ? (
                      <>Checking field setup...</>
                    ) : mfProduct ? (
                      <>
                        Products can use <InlineCode>{nsKey}</InlineCode> to override the term selected in the theme app block.
                      </>
                    ) : (
                      <>
                        Optional. Enable <InlineCode>{nsKey}</InlineCode> only if products need individual WordPress slugs.
                      </>
                    )
                  }
                />
              </BlockStack>
            </PanelCard>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <PanelCard title="Matching term" headerColor="#d8d8d8">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Content Bridge matches a WordPress category or tag slug against a store value such as vendor, product type,
                  first product tag, first collection handle, or a custom term.
                </Text>
              </BlockStack>
            </PanelCard>

            <PanelCard title={t("home.troubleshooting")} headerColor="#d8d8d8">
              <BlockStack gap="200">
                <List type="bullet">
                  <List.Item>
                    {t("home.tr1Prefix")} <InlineCode>/posts</InlineCode>
                  </List.Item>
                  <List.Item>{t("home.tr2")}</List.Item>
                  <List.Item>{t("home.tr3")}</List.Item>
                </List>
              </BlockStack>
            </PanelCard>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
