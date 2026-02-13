const express = require("express");
const cron = require("node-cron");
const config = require("../config");
const productRoutes = require("./routes/products");
const healthRoutes = require("./routes/health");
const { fetchAllProducts, updateProductTags } = require("./services/shopifyClient");
const { generateTagsBatch } = require("./services/tagger");
const { notifyBulkTagSummary, notifyTagException } = require("./services/slack");

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

/**
 * Scheduled auto-tagging job
 * Runs on CRON_SCHEDULE (default: every 4 hours)
 */
async function runAutoTag() {
  console.log(`[CRON] Auto-tagging started at ${new Date().toISOString()}`);

  try {
    const products = await fetchAllProducts();
    console.log(`[CRON] Found ${products.length} products`);

    // Generate tags for all products
    const tagResults = await generateTagsBatch(products);

    // Notify Slack about individual failures
    for (const result of tagResults) {
      if (!result.success) {
        await notifyTagException({
          productId: result.productId,
          title: result.title,
          error: result.error,
        }).catch(() => {});
      }
    }

    // Apply tags
    const results = [];
    for (const result of tagResults) {
      if (!result.success) {
        results.push({ ...result, applied: false });
        continue;
      }

      const product = products.find((p) => p.id === result.productId);
      let finalTags = result.tags;

      // Merge with existing tags
      if (product.tags) {
        const existingTags = product.tags.split(",").map((t) => t.trim().toLowerCase());
        finalTags = [...new Set([...existingTags, ...result.tags])];
      }

      await updateProductTags(result.productId, finalTags);

      results.push({
        productId: result.productId,
        title: result.title,
        previousTags: product.tags,
        aiGenerated: result.tags,
        finalTags: finalTags.join(", "),
        applied: true,
      });
    }

    const summary = {
      total: products.length,
      tagged: results.filter((r) => r.applied).length,
      failed: results.filter((r) => !r.success).length,
      dryRun: false,
      results,
    };

    // Send bulk summary to Slack
    await notifyBulkTagSummary(summary).catch(() => {});

    console.log(`[CRON] Auto-tagging complete: ${summary.tagged} tagged, ${summary.failed} failed`);
  } catch (error) {
    console.error("[CRON] Auto-tagging failed:", error.message);
  }
}

// Start server
app.listen(config.server.port, () => {
  console.log(`Shopify Auto-Tagger running on port ${config.server.port}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(`Shop: ${config.shopify.shopDomain || "not configured"}`);

  // Schedule cron job
  const schedule = process.env.CRON_SCHEDULE || "0 */4 * * *";
  if (cron.validate(schedule)) {
    cron.schedule(schedule, runAutoTag);
    console.log(`Cron scheduled: ${schedule}`);
  } else {
    console.error(`Invalid cron schedule: ${schedule}`);
  }
});

module.exports = app;
