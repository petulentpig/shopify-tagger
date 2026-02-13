const express = require("express");
const { fetchAllProducts, updateProductTags } = require("../services/shopifyClient");
const { generateTags, generateTagsBatch } = require("../services/tagger");
const { notifyBulkTagSummary, notifyTagException } = require("../services/slack");
const config = require("../../config");

const router = express.Router();
const { shopDomain, accessToken } = config.shopify;

/**
 * GET /api/products
 * List all products with their current tags
 */
router.get("/", async (req, res) => {
  try {
    const products = await fetchAllProducts(shopDomain, accessToken);
    const summary = products.map((p) => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor,
      product_type: p.product_type,
      tags: p.tags,
      image: p.image?.src || null,
    }));
    res.json({ count: summary.length, products: summary });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * POST /api/products/:id/tag
 * Generate and apply AI tags to a single product
 */
router.post("/:id/tag", async (req, res) => {
  try {
    const productId = req.params.id;
    const { merge = true } = req.body; // merge with existing tags by default

    // Fetch the product
    const products = await fetchAllProducts(shopDomain, accessToken);
    const product = products.find((p) => String(p.id) === String(productId));

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Generate AI tags
    let newTags;
    try {
      newTags = await generateTags(product);
    } catch (tagError) {
      await notifyTagException({
        productId,
        title: product.title,
        error: tagError.message,
      }).catch(() => {});
      throw tagError;
    }

    // Merge or replace tags
    let finalTags;
    if (merge && product.tags) {
      const existingTags = product.tags.split(",").map((t) => t.trim().toLowerCase());
      finalTags = [...new Set([...existingTags, ...newTags])];
    } else {
      finalTags = newTags;
    }

    // Apply tags
    const updated = await updateProductTags(shopDomain, accessToken, productId, finalTags);

    res.json({
      productId: updated.id,
      title: updated.title,
      previousTags: product.tags,
      newTags: updated.tags,
      aiGenerated: newTags,
    });
  } catch (error) {
    console.error("Error tagging product:", error.message);
    res.status(500).json({ error: "Failed to tag product" });
  }
});

/**
 * POST /api/products/tag-all
 * Generate and apply AI tags to all products
 */
router.post("/tag-all", async (req, res) => {
  try {
    const { merge = true, dryRun = false } = req.body;

    // Fetch all products
    const products = await fetchAllProducts(shopDomain, accessToken);
    console.log(`Generating tags for ${products.length} products...`);

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

    // Apply tags (unless dry run)
    const results = [];
    for (const result of tagResults) {
      if (!result.success) {
        results.push({ ...result, applied: false });
        continue;
      }

      const product = products.find((p) => p.id === result.productId);
      let finalTags = result.tags;

      if (merge && product.tags) {
        const existingTags = product.tags.split(",").map((t) => t.trim().toLowerCase());
        finalTags = [...new Set([...existingTags, ...result.tags])];
      }

      if (!dryRun) {
        await updateProductTags(shopDomain, accessToken, result.productId, finalTags);
      }

      results.push({
        productId: result.productId,
        title: result.title,
        previousTags: product.tags,
        aiGenerated: result.tags,
        finalTags: finalTags.join(", "),
        applied: !dryRun,
      });
    }

    const summary = {
      total: products.length,
      tagged: results.filter((r) => r.applied).length,
      failed: results.filter((r) => !r.success).length,
      dryRun,
      results,
    };

    // Send bulk summary to Slack
    await notifyBulkTagSummary(summary).catch(() => {});

    res.json(summary);
  } catch (error) {
    console.error("Error in bulk tagging:", error.message);
    res.status(500).json({ error: "Failed to tag products" });
  }
});

module.exports = router;
