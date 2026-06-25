// app/routes/app.settings.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useLocation,
  useNavigate,
} from "react-router";

import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Banner,
  Divider,
  FormLayout,
  Box,
  List,
  InlineCode,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { useI18n } from "../i18n/I18nProvider";
import { CONTENT_BRIDGE_METAFIELD } from "../metafields";
import { getMetafieldDefinitionStatus } from "../metafields.server";

type AdminContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphql: (query: string, options?: any) => Promise<Response>;
};

type MetafieldUserError = {
  field?: string[];
  message?: string;
};

type ActionResponse = {
  ok: boolean;
  message: string;
  details?: string;
  errors?: MetafieldUserError[];
  status?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function createProductMetafieldDefinition(admin: AdminContext) {
  const mutation = `#graphql
    mutation CreateDef($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id name }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    definition: {
      name: "Content Bridge slug",
      namespace: CONTENT_BRIDGE_METAFIELD.namespace,
      key: CONTENT_BRIDGE_METAFIELD.key,
      description: "WordPress category/tag slug used by Content Bridge to fetch related posts.",
      type: CONTENT_BRIDGE_METAFIELD.type,
      ownerType: "PRODUCT",
    },
  };

  const res = await admin.graphql(mutation, { variables });
  const data = await res.json();
  const dataRecord = asRecord(data);
  const mutationData = asRecord(dataRecord?.data);
  const createData = asRecord(mutationData?.metafieldDefinitionCreate);
  const errors = Array.isArray(createData?.userErrors)
    ? (createData.userErrors as MetafieldUserError[])
    : [];
  return { ok: errors.length === 0, errors };
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
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = shop ? await prisma.settings.findUnique({ where: { shop } }) : null;
  const mf = await getMetafieldDefinitionStatus(admin);

  return {
    shop,
    wpEndpoint: settings?.wpEndpoint ?? "",
    wpApiKey: settings?.wpApiKey ?? "",
    metafield: mf,
  };
}


export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  const validateEndpoint = (endpoint: string) => {
    const v = endpoint.trim();
    if (!v) return "WP Posts Endpoint is required.";
    try {
      const url = new URL(v);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Endpoint must start with http:// or https://";
      }
    } catch {
      return "Endpoint must be a valid URL.";
    }
    if (!v.includes("/wp-json/")) return "Endpoint should include /wp-json/ (WordPress REST API).";
    if (!v.endsWith("/posts")) return "Endpoint should end with /posts.";
    return null;
  };

  if (intent === "test_wp") {
    if (!shop) {
      return { ok: false, message: "Shop is missing. Please reload the app and try again." };
    }
    
    const settings = await prisma.settings.findUnique({ where: { shop } });

    const wpEndpoint = String(settings?.wpEndpoint ?? "").trim();
    const wpApiKey = String(settings?.wpApiKey ?? "").trim();

    const endpointError = validateEndpoint(wpEndpoint);
    if (endpointError) return { ok: false, message: endpointError, field: "wpEndpoint" };
    if (!wpApiKey) {
      return { ok: false, message: "WP API Key is required before testing connection.", field: "wpApiKey" };
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

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
      let bodyText = "";
      let json: unknown = null;

      if (contentType.includes("application/json")) {
        try {
          json = await res.json();
        } catch {
          bodyText = await res.text().catch(() => "");
        }
      } else {
        bodyText = await res.text().catch(() => "");
      }

      if (!res.ok) {
        const preview =
          (bodyText || (json ? JSON.stringify(json) : "")).slice(0, 240) || "(empty response)";
        return {
          ok: false,
          message: `Connection failed: ${res.status} ${res.statusText}`,
          details: preview,
          status: res.status,
        };
      }

      const postsCount = extractPostsCount(json);
      return {
        ok: true,
        message: postsCount === null ? "Connected. (200 OK)" : `Connected. (200 OK) Posts: ${postsCount}`,
        status: res.status,
      };
    } catch (e: unknown) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      return {
        ok: false,
        message: isAbort
          ? "Connection timed out. Please check your endpoint/firewall."
          : "Network error. Please check endpoint and server availability.",
        details: e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(t);
    }
  }

  if (intent === "save_wp") {
    if (!shop) {
      return { ok: false, message: "Shop is missing. Please reload the app and try again." };
    }
    const wpEndpoint = String(form.get("wpEndpoint") || "").trim();
    const wpApiKey = String(form.get("wpApiKey") || "").trim();

    const endpointError = validateEndpoint(wpEndpoint);
    if (endpointError) return { ok: false, message: endpointError, field: "wpEndpoint" };
    if (!wpApiKey) return { ok: false, message: "WP API Key is required.", field: "wpApiKey" };

    await prisma.settings.upsert({
      where: { shop },
      update: { wpEndpoint, wpApiKey },
      create: { shop, wpEndpoint, wpApiKey },
    });

    return { ok: true, message: "Saved WordPress settings." };
  }

  if (intent === "enable_product_mf") {
    const result = await createProductMetafieldDefinition(admin);
    return {
      ok: result.ok,
      message: result.ok ? "Enabled product metafield." : "Failed to enable product metafield.",
      errors: result.errors,
    };
  }

  return { ok: false, message: "Unknown action." };
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

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>() as ActionResponse | undefined;
  const nav = useNavigation();
  const submit = useSubmit();

  const navigate = useNavigate();
  const { search } = useLocation();

  const { t } = useI18n();
  const nsKey = CONTENT_BRIDGE_METAFIELD.qualifiedKey;

  const busy = nav.state !== "idle";
  const currentIntent = (() => {
    const fd = nav.formData;
    const v = fd?.get("intent");
    return typeof v === "string" ? v : "";
  })();

  const savingWp = busy && currentIntent === "save_wp";
  const testingWp = busy && currentIntent === "test_wp";
  const enablingProduct = busy && currentIntent === "enable_product_mf";

  const mf = data.metafield ?? { hasProduct: null } as const;
  const isChecking = mf.hasProduct === null;

  // controlled inputs
  const [showApiKey, setShowApiKey] = useState(false);
  const [wpEndpoint, setWpEndpoint] = useState(data.wpEndpoint ?? "");
  const [wpApiKey, setWpApiKey] = useState(data.wpApiKey ?? "");

  // Keep the originally loaded settings as the dirty-check baseline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialValues = useMemo(
    () => ({
      wpEndpoint: data.wpEndpoint ?? "",
      wpApiKey: data.wpApiKey ?? "",
    }),
    [] // ★ここ重要：初回だけ固定
  );

  const isDirty =
  wpEndpoint !== initialValues.wpEndpoint || wpApiKey !== initialValues.wpApiKey;

  // ★Checkingが続いたら、自動回復（ただし dirty のときは止める）
  useEffect(() => {
    if (!isChecking) return;
    if (isDirty) return;

    const t = setTimeout(() => {
      window.location.reload();
    }, 3500);

    return () => clearTimeout(t);
  }, [isChecking, isDirty]);

  const [endpointError, setEndpointError] = useState<string | undefined>(undefined);
  const [apiKeyError, setApiKeyError] = useState<string | undefined>(undefined);

  const errorList = useMemo(() => {
    const errs = actionData?.errors;
    return Array.isArray(errs) && errs.length ? errs : null;
  }, [actionData]);

  const validateEndpointClient = (value: string) => {
    const v = value.trim();
    if (!v) return "WP Posts Endpoint is required.";
    try {
      const url = new URL(v);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "Endpoint must start with http:// or https://";
    } catch {
      return "Endpoint must be a valid URL.";
    }
    if (!v.includes("/wp-json/")) return "Endpoint should include /wp-json/ (WordPress REST API).";
    if (!v.endsWith("/posts")) return "Endpoint should end with /posts.";
    return undefined;
  };

  const validateBeforeSave = () => {
    const epErr = validateEndpointClient(wpEndpoint);
    const keyErr = !wpApiKey.trim() ? "WP API Key is required." : undefined;

    setEndpointError(epErr);
    setApiKeyError(keyErr);

    return !(epErr || keyErr);
  };

  const onEnable = (intent: "enable_product_mf") => {
    const fd = new FormData();
    fd.set("intent", intent);
    submit(fd, { method: "post" });
  };

  const onSubmitWp = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validateBeforeSave()) {
      e.preventDefault();
    }
  };

  const onTestConnection = () => {
    const epErr = validateEndpointClient(wpEndpoint);
    const keyErr = !wpApiKey.trim() ? "WP API Key is required." : undefined;
    setEndpointError(epErr);
    setApiKeyError(keyErr);
    if (epErr || keyErr) return;

    // save then test (MVP: small delay; can be refined later)
    const saveFd = new FormData();
    saveFd.set("intent", "save_wp");
    saveFd.set("wpEndpoint", wpEndpoint.trim());
    saveFd.set("wpApiKey", wpApiKey.trim());
    submit(saveFd, { method: "post" });

    setTimeout(() => {
      const fd = new FormData();
      fd.set("intent", "test_wp");
      submit(fd, { method: "post" });
    }, 350);
  };

  const tone = actionData?.message ? (actionData.ok ? "success" : "critical") : undefined;

  return (
    <Page
      title={t("settings.pageTitle")}
      subtitle={t("settings.pageSubtitle")}
      backAction={{
        content: t("settings.back"),
        onAction: () => navigate(`/app${search || ""}`),
      }}
      primaryAction={{
        content: t("settings.save"),
        onAction: () => {
          if (!validateBeforeSave()) return;
          const fd = new FormData();
          fd.set("intent", "save_wp");
          fd.set("wpEndpoint", wpEndpoint.trim());
          fd.set("wpApiKey", wpApiKey.trim());
          submit(fd, { method: "post" });
        },
        disabled: savingWp || testingWp,
        loading: savingWp,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {isChecking && isDirty && (
              <Banner tone="warning" title={t("settings.refreshingTitle")}>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    {t("settings.refreshingBodyPrefix")}
                    <b>{t("settings.refreshingBodyMid")}</b>
                    {t("settings.refreshingBodySuffix")}
                  </Text>

                  <InlineStack gap="200" align="start">
                    <Button onClick={() => window.location.reload()}>{t("settings.reload")}</Button>
                  </InlineStack>
                </BlockStack>
              </Banner>
            )}

            {actionData?.message ? (
              <Banner tone={tone} title={actionData.message}>
                {actionData.details ? (
                  <Text as="p" variant="bodyMd">
                    <InlineCode>{actionData.details.slice(0, 240)}</InlineCode>
                  </Text>
                ) : null}

                {errorList ? (
                  <List type="bullet">
                    {errorList.map((e, i) => (
                      <List.Item key={i}>{e?.message ?? t("settings.unknownError")}</List.Item>
                    ))}
                  </List>
                ) : null}
              </Banner>
            ) : null}

            <PanelCard title={t("settings.wpCardTitle")}>
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Paste your WordPress endpoint and API key from the{" "}
                  <a
                    href="https://wordpress.org/plugins/content-bridge-for-commerce/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Content Bridge for Commerce WordPress plugin
                  </a>
                  .
                </Text>

                <Form method="post" onSubmit={onSubmitWp}>
                  <input type="hidden" name="intent" value="save_wp" />

                  <FormLayout>
                    <TextField
                      label={t("settings.wpEndpointLabel")}
                      name="wpEndpoint"
                      value={wpEndpoint}
                      onChange={(v) => {
                        setWpEndpoint(v);
                        setEndpointError(undefined);
                      }}
                      autoComplete="off"
                      placeholder="https://example.com/wp-json/content-bridge/v1/posts"
                      helpText={
                        <>
                          {t("settings.wpEndpointHelpPrefix")}{" "}
                          <InlineCode>https://example.com/wp-json/content-bridge/v1/posts</InlineCode>
                        </>
                      }
                      error={endpointError}
                    />

                    <TextField
                      label={t("settings.wpApiKeyLabel")}
                      name="wpApiKey"
                      value={wpApiKey}
                      onChange={(v) => {
                        setWpApiKey(v);
                        setApiKeyError(undefined);
                      }}
                      type={showApiKey ? "text" : "password"}
                      autoComplete="off"
                      helpText={
                        <>
                          {t("settings.sentAsHeaderPrefix")}
                          <InlineCode>X-Content-Bridge-Key</InlineCode>
                          {t("settings.sentAsHeaderSuffix")}
                        </>
                      }
                      connectedRight={
                        <Button
                          onClick={() => setShowApiKey((s) => !s)}
                        >
                          {showApiKey ? t("settings.hide") : t("settings.show")}
                        </Button>
                      }
                      error={apiKeyError}
                    />

                    <InlineStack align="end" gap="200">
                      <Button variant="secondary" onClick={onTestConnection} loading={testingWp} disabled={savingWp}>
                        {t("settings.testConnection")}
                      </Button>
                    </InlineStack>
                  </FormLayout>
                </Form>
              </BlockStack>
            </PanelCard>

            <PanelCard title="Product term override">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Optional. Create <InlineCode>{nsKey}</InlineCode> when products need their own WordPress category or tag slug.
                  If this field is set on a product, it overrides the term source selected in the theme app block.
                </Text>

                <Divider />

                <BlockStack gap="300">
                  <Box paddingBlockStart="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          Product metafield
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {t("settings.status")}:{" "} 
                          <b>
                            {mf.hasProduct === null
                              ? t("settings.checking")
                              : mf.hasProduct
                                ? t("settings.enabled")
                                : t("settings.notEnabled")}
                          </b>
                        </Text>
                      </BlockStack>

                      {mf.hasProduct === null ? (
                        <Button disabled>{t("settings.checking")}</Button>
                      ) : !mf.hasProduct ? (
                        <Button onClick={() => onEnable("enable_product_mf")} loading={enablingProduct}>
                          {t("settings.enable")}
                        </Button>
                      ) : (
                        <Button disabled>{t("settings.enabledButton")}</Button>
                      )}
                    </InlineStack>
                  </Box>
                </BlockStack>
              </BlockStack>
            </PanelCard>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <PanelCard title={t("settings.checklistTitle")} headerColor="#d8d8d8">
              <BlockStack gap="300">
                <List type="bullet">
                  <List.Item>
                    {t("settings.checklist1Prefix")}{" "}
                    <InlineCode>/posts</InlineCode>
                    {t("settings.checklist1Suffix")}
                  </List.Item>
                  <List.Item>
                    {t("settings.checklist2Prefix")}{" "}
                    <InlineCode>/wp-json/</InlineCode>
                    {t("settings.checklist2Suffix")}
                  </List.Item>
                  <List.Item>{t("settings.checklist3")}</List.Item>
                </List>
              </BlockStack>
            </PanelCard>

            <PanelCard title={t("settings.howTitle")} headerColor="#d8d8d8">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Choose a WordPress taxonomy in the theme app block: category or tag. Then choose the product value used as the
                  matching term: product vendor, product type, first product tag, first collection handle, or custom term. If a
                  product has <InlineCode>{nsKey}</InlineCode>, that value is used instead.
                </Text>
              </BlockStack>
            </PanelCard>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
