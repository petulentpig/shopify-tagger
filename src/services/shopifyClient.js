const config = require("../../config");

const API_VERSION = "2024-10";

/**
 * Make a Shopify Admin REST API request
 */
async function shopifyRequest(method, path, data = null) {
  const shop = config.shopify.shopDomain;
  const token = config.shopify.accessToken;
  const url = `https://${shop}/admin/api/${API_VERSION}/${path}.json`;

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Shopify API error (${response.status}): ${errorBody}`
    );
  }

  return response.json();
}

/**
 * Fetch all products from the shop (paginated)
 */
async function fetchAllProducts(limit = 50) {
  const shop = config.shopify.shopDomain;
  const token = config.shopify.accessToken;
  const products = [];
  let url = `https://${shop}/admin/api/${API_VERSION}/products.json?limit=${limit}`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Shopify API error (${response.status}): ${errorBody}`);
    }

    const body = await response.json();
    products.push(...body.products);

    // Handle pagination via Link header
    const linkHeader = response.headers.get("link");
    url = null;
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        url = nextMatch[1];
      }
    }
  }

  return products;
}

/**
 * Fetch a single product by ID
 */
async function fetchProduct(productId) {
  const result = await shopifyRequest("GET", `products/${productId}`);
  return result.product;
}

/**
 * Update tags for a single product
 */
async function updateProductTags(productId, tags) {
  const tagString = Array.isArray(tags) ? tags.join(", ") : tags;

  const result = await shopifyRequest("PUT", `products/${productId}`, {
    product: { id: productId, tags: tagString },
  });

  return result.product;
}

module.exports = {
  shopifyRequest,
  fetchAllProducts,
  fetchProduct,
  updateProductTags,
};
