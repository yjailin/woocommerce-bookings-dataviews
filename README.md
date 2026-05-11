# WooCommerce Bookings — DataViews

A WordPress mini-extension that adds a DataViews-powered "All Bookings" admin screen to WooCommerce Bookings, behind a feature flag.

## Requirements

- WooCommerce
- WooCommerce Bookings
- WordPress 6.5+
- PHP 7.4+
- Node 20+ (for development only)

## Install & build (from source)

```bash
npm install
npm run build
```

Then activate the plugin in `wp-admin → Plugins`.

## Install (from a zip)

```bash
npm install
npm run build
npm run plugin-zip
```

This produces `woocommerce-bookings-dataviews.zip` which can be uploaded via `wp-admin → Plugins → Add New → Upload Plugin`.

## Development

```bash
npm run start
```

Watches `src/` for changes and rebuilds incrementally.

## Enabling the feature

Once activated, go to `WooCommerce → Bookings → Settings → Features` and toggle **All Bookings (DataViews)**. The classic "All bookings" submenu is replaced with the DataViews-powered version.

## What's inside

| Path | Purpose |
| --- | --- |
| `woocommerce-bookings-dataviews.php` | Plugin bootstrap — defines constants and wires up the classes on `plugins_loaded` |
| `includes/admin/class-wc-bookings-features.php` | Feature-flag plumbing + `Settings → Features` tab |
| `includes/admin/class-wc-bookings-dataviews-menu.php` | Registers the DataViews submenu, removes the classic list |
| `includes/admin/class-wc-bookings-dataviews-page.php` | Renders the page shell, enqueues the React bundle |
| `includes/admin/class-wc-bookings-dataviews-rest.php` | REST endpoints under `wc-bookings/v1/dataviews/*` |
| `src/index.js` | Entry point — mounts the React app |
| `src/app.js` | The DataViews component, tabs, filters, actions |
| `src/fields.js` | Field definitions (columns, filter elements, renderers) |
| `src/style.scss` | Page-scoped styles |
| `build/` | Output of `npm run build` (gitignored) |
