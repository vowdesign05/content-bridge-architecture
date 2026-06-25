import { CONTENT_BRIDGE_METAFIELD } from "./metafields";

type AdminContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphql: (query: string, options?: any) => Promise<Response>;
};

type MetafieldDefinitionNode = {
  type?: { name?: string };
};

export type MetafieldDefinitionStatus = {
  hasProduct: boolean;
  productType?: string;
};

const METAFIELD_STATUS_QUERY = `#graphql
  query MetafieldDefinitionStatus($namespace: String!, $key: String!) {
    productDefs: metafieldDefinitions(first: 1, ownerType: PRODUCT, namespace: $namespace, key: $key) {
      nodes {
        id
        name
        type {
          name
        }
      }
    }
  }
`;

export async function getMetafieldDefinitionStatus(
  admin: AdminContext
): Promise<MetafieldDefinitionStatus> {
  const res = await admin.graphql(METAFIELD_STATUS_QUERY, {
    variables: {
      namespace: CONTENT_BRIDGE_METAFIELD.namespace,
      key: CONTENT_BRIDGE_METAFIELD.key,
    },
  });
  const data = await res.json();

  const productDef: MetafieldDefinitionNode | undefined =
    data?.data?.productDefs?.nodes?.[0];

  const productType = productDef?.type?.name;

  return {
    hasProduct: productType === CONTENT_BRIDGE_METAFIELD.type,
    productType,
  };
}
