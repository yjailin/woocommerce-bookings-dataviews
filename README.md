# WooCommerce Bookings DataViews

A mini extension that replaces the WooCommerce Bookings admin list with a modern [DataViews](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-dataviews/) interface. Installs on top of WooCommerce Bookings.

## What it does

Replaces the legacy bookings table with a DataViews-powered list featuring:

- Tabs for Today, Upcoming, Past, Canceled and All bookings
- Filtering by status, product, resource and date
- Search, sorting, pagination and bulk actions
- Actions: Confirm, Refuse, Cancel, Edit, View Order

## Requirements

- WordPress 6.3+
- WooCommerce 8.2+
- WooCommerce Bookings

## Installation

1. Download `woocommerce-bookings-dataviews.zip` from the latest release
2. Go to WP Admin, Plugins, Add New, Upload Plugin
3. Upload the ZIP and activate

## Enabling the feature

The new UI is behind a feature flag. Go to **WooCommerce → Bookings → Settings → Features** and toggle the **All Bookings (DataViews)** option.

## Development

```bash
npm install
npm run start       # watch mode
npm run build       # production build
npm run plugin-zip  # generate installable ZIP
```
