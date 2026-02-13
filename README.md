# Shopify Auto-Tagger

Automatically tag your Shopify products using AI. Analyzes product titles, descriptions, variants, and other attributes to generate relevant, search-friendly tags.

## Features

- **AI-Powered Tagging** — Uses OpenAI to generate contextual tags based on product attributes
- **Single & Bulk Tagging** — Tag one product or your entire catalog
- **Merge Mode** — Optionally merge AI tags with existing tags
- **Dry Run** — Preview generated tags before applying them
- **Rate Limited** — Built-in delays to respect API limits

## Setup

```bash
npm install
cp .env.example .env
# Fill in your credentials in .env
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List all products with current tags |
| POST | `/api/products/:id/tag` | Generate & apply AI tags to one product |
| POST | `/api/products/tag-all` | Generate & apply AI tags to all products |

## Configuration

Set these environment variables (see `.env.example`):

- `SHOP_DOMAIN` — Your myshopify.com domain
- `SHOPIFY_ACCESS_TOKEN` — Admin API access token
- `OPENAI_API_KEY` — OpenAI API key for tag generation

## Usage Examples

Tag a single product:
```bash
curl -X POST http://localhost:3000/api/products/123456/tag
```

Dry run on all products (preview tags without applying):
```bash
curl -X POST http://localhost:3000/api/products/tag-all \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

Tag all products (merging with existing tags):
```bash
curl -X POST http://localhost:3000/api/products/tag-all \
  -H "Content-Type: application/json" \
  -d '{"merge": true}'
```
