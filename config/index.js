require("dotenv").config();

module.exports = {
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SHOPIFY_SCOPES || "read_products,write_products").split(","),
    host: process.env.SHOPIFY_HOST,
    shopDomain: process.env.SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
  },
};
