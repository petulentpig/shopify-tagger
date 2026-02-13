const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const config = require("../../config");

// Initialize Shopify API client
const shopify = shopifyApi({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret,
  scopes: config.shopify.scopes,
  hostName: (config.shopify.host || "").replace(/https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

/**
 * Create a REST client for a given shop
 */
function createRestClient(shop, accessToken) {
  return new shopify.clients.Rest({
    session: { shop, accessToken },
  });
}

/**
 * Create a GraphQL client for a given shop
 */
function createGraphQLClient(shop, accessToken) {
  return new shopify.clients.Graphql({
    session: { shop, accessToken },
  });
}

/**
 * Fetch all products from the shop (paginated)
 */
async function fetchAllProducts(shop, accessToken, limit = 50) {
  const client = createRestClient(shop, accessToken);
  const products = [];
  let pageInfo;

  do {
    const params = { limit };
    if (pageInfo?.nextPage) {
      Object.assign(params, pageInfo.nextPage.query);
    }

    const response = await client.get({ path: "products", query: params });
    products.push(...response.body.products);
    pageInfo = response.pageInfo;
  } while (pageInfo?.nextPage);

  return products;
}

/**
 * Update tags for a single product
 */
async function updateProductTags(shop, accessToken, productId, tags) {
  const client = createRestClient(shop, accessToken);
  const tagString = Array.isArray(tags) ? tags.join(", ") : tags;

  const response = await client.put({
    path: `products/${productId}`,
    data: { product: { id: productId, tags: tagString } },
  });

  return response.body.product;
}

module.exports = {
  shopify,
  createRestClient,
  createGraphQLClient,
  fetchAllProducts,
  updateProductTags,
};
