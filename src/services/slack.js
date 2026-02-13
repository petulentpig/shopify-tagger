const https = require("https");
const config = require("../../config");

/**
 * Send a message to Slack via incoming webhook
 */
async function sendSlackMessage(payload) {
  const webhookUrl = config.slack.webhookUrl;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not set — skipping notification");
    return;
  }

  const url = new URL(webhookUrl);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", (err) => {
      console.error("Slack notification failed:", err.message);
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

/**
 * Send a summary notification after bulk tagging
 */
async function notifyBulkTagSummary({ total, tagged, failed, dryRun, results }) {
  const emoji = failed > 0 ? ":warning:" : ":white_check_mark:";
  const status = dryRun ? "DRY RUN" : "COMPLETE";

  const failedProducts = results.filter((r) => !r.success);
  let failedSection = "";
  if (failedProducts.length > 0) {
    const failedList = failedProducts
      .slice(0, 10)
      .map((r) => `• _${r.title}_ — ${r.error}`)
      .join("\n");
    failedSection = `\n\n*Failed products:*\n${failedList}`;
    if (failedProducts.length > 10) {
      failedSection += `\n_...and ${failedProducts.length - 10} more_`;
    }
  }

  const topTags = getTopTags(results, 10);
  const topTagsSection = topTags.length > 0
    ? `\n\n*Top tags generated:* ${topTags.map((t) => `\`${t.tag}\` (${t.count})`).join(", ")}`
    : "";

  await sendSlackMessage({
    channel: "#products",
    text: `${emoji} *Shopify Auto-Tagger — ${status}*\n\n` +
      `• *Total products:* ${total}\n` +
      `• *Successfully tagged:* ${tagged}\n` +
      `• *Failed:* ${failed}` +
      topTagsSection +
      failedSection,
  });
}

/**
 * Send an exception notification when a single product fails
 */
async function notifyTagException({ productId, title, error }) {
  await sendSlackMessage({
    channel: "#products",
    text: `:x: *Tagging failed* for product _${title}_ (ID: ${productId})\n` +
      `*Error:* ${error}`,
  });
}

/**
 * Get the most frequently generated tags across results
 */
function getTopTags(results, limit = 10) {
  const tagCounts = {};
  for (const r of results) {
    if (!r.success || !r.aiGenerated) continue;
    const tags = Array.isArray(r.aiGenerated) ? r.aiGenerated : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

module.exports = { sendSlackMessage, notifyBulkTagSummary, notifyTagException };
