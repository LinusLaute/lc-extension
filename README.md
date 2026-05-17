# SkinBaron Arbitrage Helper

A Chrome extension for [skinbaron.de](https://skinbaron.de) that overlays pricing intelligence directly on CS:GO skin listings to assist with manual arbitrage decisions.

Built as a side project to speed up the process of eyeballing deals on the marketplace,  the extension talks to a local Flask backend that reuses oracle logic from the main arb bot, but is self-contained with no shared file imports.

## How it works

When you open a skin's detail modal, the extension injects an info panel next to the buy button showing whether the listing is worth buying based on your target fee and profit margins.

**Three modes, toggled in the popup:**

| Mode | What it does |
|------|--------------|
| Quick Calc | No backend needed. Just calculates the minimum sell price to hit your profit target after fees. |
| Oracle (Market) | Calls the local backend for the 2nd-cheapest active listing. Fast. Good for a quick sanity check. |
| Oracle (Full) | Market price + historic sales data blended into a fair value estimate. Slower but more reliable. |

The verdict is binary: **GOOD DEAL** (green) or **OVERPRICED** (red), based on whether the market/fair value exceeds your minimum sell threshold.

### Grid Scanner

On search/category grid pages, the scanner automatically color-codes the first N listings:
- **Green** — undervalued relative to market
- **Red** — overpriced
- **Grey** — no data or skipped (e.g. souvenir items)

## Backend

The extension talks to a Python Flask server running locally at `http://127.0.0.1:5000`.

Two endpoints are used:

- `POST /oracle/market` — returns the 2nd-lowest active listing price for an item
- `POST /oracle` — returns market + historic blended fair value

The server lives in the arb bot backend repo and is independently runnable — no external imports from the main bot are needed.

## Settings

Configured via the extension popup:

| Setting | Default | Description |
|---------|---------|-------------|
| Oracle Pricing | On | Enables backend calls |
| Include Historic Data | Off | Adds historic price to oracle analysis (slower) |
| SkinBaron Fee | 8% | Marketplace fee deducted from sale |
| Desired Profit | 10% | Target margin used to calculate min sell price |
| Grid Scan Count | 24 | How many grid items to analyze |

## Installation

1. Clone this repo
2. Open Chrome → `chrome://extensions` → Enable Developer Mode
3. Click **Load unpacked** and select this folder
4. Start the local Flask backend
5. Navigate to skinbaron.de
