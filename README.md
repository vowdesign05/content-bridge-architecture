# Content Bridge

Content Bridge is a Shopify app that displays related WordPress posts on Shopify product pages through a theme app block.

## Production App

- App URL: `https://content-bridge.fly.dev`
- App proxy: `/apps/content-bridge/posts`
- Shopify distribution: App Store

## Merchant Setup

1. Install the app and approve/select a pricing plan if Shopify prompts for one.
2. Open the app in Shopify Admin.
3. Go to Settings and save the WordPress REST endpoint and API key.
4. Optionally enable the product metafield `custom.content_bridge` for product-level term overrides.
5. In Online Store > Themes > Customize, add the Content Bridge Post app block to a product template.
6. Choose the WordPress taxonomy and store term source in the app block settings.

## Development

```shell
npm install
npm run typecheck
npm run build
```

## Deployment

The Fly.io process runs `dbsetup.js`, applies Prisma migrations, and starts the React Router server.
