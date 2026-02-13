const OpenAI = require("openai");
const config = require("../../config");

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `You are a product tagging assistant for a Shopify store.
Given a product's title, description, vendor, product type, and other attributes,
generate a list of relevant tags that will help with search, filtering, and SEO.

Rules:
- Return ONLY a JSON array of lowercase tag strings
- Include tags for: category, material, color, style, season, use-case, audience
- Keep tags concise (1-3 words each)
- Generate 5-15 tags per product
- Do not include the product title verbatim as a tag
- Focus on attributes that customers would search for`;

/**
 * Generate tags for a single product using AI
 */
async function generateTags(product) {
  const productInfo = {
    title: product.title,
    description: stripHtml(product.body_html || ""),
    vendor: product.vendor,
    product_type: product.product_type,
    variants: (product.variants || []).map((v) => ({
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      price: v.price,
    })),
  };

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate tags for this product:\n${JSON.stringify(productInfo, null, 2)}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  // Handle both { tags: [...] } and direct array responses
  const tags = Array.isArray(parsed) ? parsed : parsed.tags || [];
  return tags.map((t) => t.toLowerCase().trim());
}

/**
 * Generate tags for multiple products with rate limiting
 */
async function generateTagsBatch(products, { delayMs = 200 } = {}) {
  const results = [];

  for (const product of products) {
    try {
      const tags = await generateTags(product);
      results.push({ productId: product.id, title: product.title, tags, success: true });
    } catch (error) {
      results.push({
        productId: product.id,
        title: product.title,
        tags: [],
        success: false,
        error: error.message,
      });
    }

    // Rate limiting
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = { generateTags, generateTagsBatch, stripHtml };
