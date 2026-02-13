const express = require("express");
const config = require("../config");
const productRoutes = require("./routes/products");
const healthRoutes = require("./routes/health");

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/products", productRoutes);

// Root
app.get("/", (req, res) => {
  res.json({
    name: "Shopify Auto-Tagger",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/health",
      listProducts: "GET /api/products",
      tagProduct: "POST /api/products/:id/tag",
      tagAll: "POST /api/products/tag-all",
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(config.server.port, () => {
  console.log(`Shopify Auto-Tagger running on port ${config.server.port}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(`Shop: ${config.shopify.shopDomain || "not configured"}`);
});

module.exports = app;
