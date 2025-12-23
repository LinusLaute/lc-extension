// SkinBaron Arbitrage Helper - Content Script

// Default settings
let feePercentage = 8;
let profitPercentage = 10;
let oracleEnabled = false;

// Load saved settings from storage
chrome.storage.sync.get(['feePercentage', 'profitPercentage', 'oracleEnabled'], (result) => {
  if (result.feePercentage) {
    feePercentage = result.feePercentage;
  }
  if (result.profitPercentage) {
    profitPercentage = result.profitPercentage;
  }
  if (typeof result.oracleEnabled === 'boolean') {
    oracleEnabled = result.oracleEnabled;
  }
  initExtension();
});

function initExtension() {
  // Check if we're on an item detail page
  if (isItemDetailPage()) {
    addArbitrageInfo();
  }
  
  // Watch for dynamic content changes (new items opening)
  const observer = new MutationObserver(() => {
    if (isItemDetailPage() && !document.querySelector('.arb-info-container')) {
      addArbitrageInfo();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function isItemDetailPage() {
  const priceElement = document.querySelector('.modal-content');
  return priceElement !== null;
}

function extractPrice() {
  const priceSelectors = [
    '.product-price-heading',
    '.product-price span',
    'h2.text-white',
    '[class*="price"]'
  ];
  
  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent.trim();
      const match = text.match(/€\s*([0-9,]+\.?\d*)/);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          console.log('Price found:', price);
          return price;
        }
      }
    }
  }
  
  console.log('No price found with any selector');
  return null;
}

function standardizeWear(rawWear) {
  const normalized = rawWear.toLowerCase().trim();

  if (normalized.includes('factory')) return 'Factory New';
  if (normalized.includes('minimal')) return 'Minimal Wear';
  if (normalized.includes('field'))   return 'Field-Tested';
  if (normalized.includes('well'))    return 'Well-Worn';
  if (normalized.includes('battle'))  return 'Battle-Scarred';

  return rawWear;
}

function extractItemDetails() {
  const nameEl = document.querySelector('.modal-title');
  const wearEl = document.querySelector('.product-exterior');

  if (!nameEl || !wearEl) {
    console.log('Waiting for modal elements...');
    return null;
  }

  const cleanName = nameEl.innerText.replace(/\s+/g, ' ').trim();
  const cleanWear = standardizeWear(wearEl.innerText);

  return {
    name: cleanName,
    wear: cleanWear,
  };
}

function calculateMinimumSellPrice(buyPrice, profitPercentage, feePercent) {
  const minSellPrice = (buyPrice * (1 + profitPercentage / 100)) / (1 - feePercent / 100);
  return minSellPrice;
}

function calculateProfit(buyPrice, sellPrice, feePercent) {
  const feeAmount = sellPrice * (feePercent / 100);
  const profit = sellPrice - feeAmount - buyPrice;
  const profitPercent = (profit / buyPrice) * 100;
  
  return {
    profit: profit,
    profitPercent: profitPercent,
    netReceived: sellPrice - feeAmount
  };
}

async function addArbitrageInfo() {
  // Check if we already added the info to avoid duplicates
  if (document.querySelector('.arb-info-container')) return;

  const details = extractItemDetails();
  const buyPrice = extractPrice();
  const minSell = calculateMinimumSellPrice(buyPrice, profitPercentage, feePercentage);

  if (!details || !buyPrice) {
    console.log('Waiting for item details and price...');
    setTimeout(addArbitrageInfo, 500);
    return;
  }

  // Create UI container
  const infoDiv = document.createElement('div');
  
  // Check if Oracle is enabled
  if (!oracleEnabled) {
    // Simple mode: Just show Min Sell price
    infoDiv.className = 'arb-info-container';
    infoDiv.innerHTML = `
      <div class="arb-header">
        <span class="arb-title">💰 QUICK CALC</span>
        <span class="arb-fee">${feePercentage}% Fee</span>
      </div>
      <div class="arb-row arb-highlight">
        <span class="arb-label">Min. Sell:</span>
        <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
      </div>
      <div class="arb-footer">
        Enable Oracle in settings for market analysis
      </div>
    `;
    
    insertInfoDiv(infoDiv);
    return;
  }

  // Oracle mode: Show loading then fetch data
  infoDiv.className = 'arb-info-container arb-loading-state';
  infoDiv.innerHTML = `
    <div class="arb-header">
      <span class="arb-title">🔮 ORACLE</span>
      <span class="arb-fee">${feePercentage}% Fee</span>
    </div>
    <div class="arb-row arb-highlight">
      <span class="arb-label">Min. Sell:</span>
      <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
    </div>
    <div class="arb-loading">
      <span>⏳ Consulting Oracle...</span>
    </div>
  `;
  
  insertInfoDiv(infoDiv);

  try {
    const response = await fetch('http://127.0.0.1:5000/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });

    const oracleData = await response.json();

    if (oracleData && !oracleData.error) {
      updateUIWithOracleData(infoDiv, buyPrice, oracleData, minSell);
    } else {
      infoDiv.className = 'arb-info-container arb-container-neutral';
      infoDiv.innerHTML = `
        <div class="arb-header">
          <span class="arb-title">⚠️ ORACLE</span>
          <span class="arb-fee">${feePercentage}% Fee</span>
        </div>
        <div class="arb-row arb-highlight">
          <span class="arb-label">Min. Sell:</span>
          <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
        </div>
        <div class="arb-verdict neutral-deal">
          No sufficient market history
        </div>
        <div class="arb-footer">
          Luti Capital Extension
        </div>
      `;
    }
  } catch (error) {
    console.error('Oracle error:', error);
    infoDiv.className = 'arb-info-container arb-container-neutral';
    infoDiv.innerHTML = `
      <div class="arb-header">
        <span class="arb-title">❌ ORACLE</span>
        <span class="arb-fee">${feePercentage}% Fee</span>
      </div>
      <div class="arb-row arb-highlight">
        <span class="arb-label">Min. Sell:</span>
        <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
      </div>
      <div class="arb-verdict neutral-deal">
        Oracle service offline
      </div>
      <div class="arb-footer">
        Luti Capital Extension
      </div>
    `;
  }
}

function insertInfoDiv(infoDiv) {
  // Insert AFTER the product-price container
  const priceContainer = document.querySelector('.product-price');
  if (priceContainer) {
    priceContainer.parentElement.insertBefore(infoDiv, priceContainer.nextSibling);
  } else {
    const modal = document.querySelector('.modal-content');
    if (modal) {
      const h2 = modal.querySelector('h2');
      if (h2) {
        h2.parentElement.insertBefore(infoDiv, h2.nextSibling);
      } else {
        modal.prepend(infoDiv);
      }
    }
  }
}

function updateUIWithOracleData(container, buyPrice, data, minSell) {
  const fairValue = data.fair_value;
  
  const netReceived = fairValue * (1 - (feePercentage / 100));
  const potentialProfit = netReceived - buyPrice;
  const profitPercent = (potentialProfit / buyPrice) * 100;
  const isGoodDeal = potentialProfit > 0;

  container.className = `arb-info-container ${isGoodDeal ? 'arb-container-good' : 'arb-container-bad'}`;

  container.innerHTML = `
    <div class="arb-header">
      <span class="arb-title">${isGoodDeal ? '🚀' : '⚠️'} ORACLE</span>
      <span class="arb-fee">${feePercentage}% Fee</span>
    </div>
    
    <div class="arb-row arb-highlight">
      <span class="arb-label">Min. Sell:</span>
      <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
    </div>

    <div class="arb-row arb-highlight">
      <span class="arb-label">Fair Value:</span>
      <span class="arb-value arb-breakeven">€${fairValue.toFixed(2)}</span>
    </div>

    <div class="arb-row arb-compact">
      <span class="arb-label-small">Market: €${data.second_lowest.toFixed(2)}</span>
      <span class="arb-separator">•</span>
      <span class="arb-label-small">Historic: €${data.historic.toFixed(2)}</span>
    </div>

    <div class="arb-divider"></div>

    <div class="arb-row">
      <span class="arb-label">Est. Profit:</span>
      <span class="arb-profit ${isGoodDeal ? 'positive' : 'negative'}">
        ${isGoodDeal ? '+' : ''}€${potentialProfit.toFixed(2)} (${profitPercent.toFixed(1)}%)
      </span>
    </div>

    <div class="arb-verdict ${isGoodDeal ? 'good-deal' : 'bad-deal'}">
      ${isGoodDeal ? '✅ GOOD DEAL' : '❌ OVERPRICED'}
    </div>

    <div class="arb-footer">
      Luti Capital Extension
    </div>
  `;
}

// Listen for messages from popup to update settings
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    if (typeof request.fee === 'number') {
      feePercentage = request.fee;
    }
    if (typeof request.profit === 'number') {
      profitPercentage = request.profit;
    }
    if (typeof request.oracleEnabled === 'boolean') {
      oracleEnabled = request.oracleEnabled;
    }
    
    // Remove existing box and recreate with new settings
    const existing = document.querySelector('.arb-info-container');
    if (existing) {
      existing.remove();
    }
    addArbitrageInfo();
    
    sendResponse({ success: true });
    return true;
  }
});