// SkinBaron Arbitrage Helper - Content Script

// Default fee percentage
let feePercentage = 8;

// Load saved fee percentage from storage
chrome.storage.sync.get(['feePercentage'], (result) => {
  if (result.feePercentage) {
    feePercentage = result.feePercentage;
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
  // Check if we're on the item detail modal/page
  const priceElement = document.querySelector('.modal-content');
  return priceElement !== null;
}

function extractPrice() {
  // Try to find the price element - SkinBaron specific selectors
  const priceSelectors = [
    '.product-price-heading',  // Main price element
    '.product-price span',
    'h2.text-white',
    '[class*="price"]'
  ];
  
  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent.trim();
      // Match price pattern like €1,000.00
      const match = text.match(/€\s*([0-9,]+\.?\d*)/);
      if (match) {
        // Remove commas and convert to number
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

  // Map the common variations to the exact keys your Python dictionary uses
  if (normalized.includes('factory')) return 'Factory New';
  if (normalized.includes('minimal')) return 'Minimal Wear';
  if (normalized.includes('field'))   return 'Field-Tested';
  if (normalized.includes('well'))    return 'Well-Worn';
  if (normalized.includes('battle'))  return 'Battle-Scarred';

  return rawWear; // Fallback if no match
}

function extractItemDetails() {
  const nameEl = document.querySelector('.modal-title');
  const wearEl = document.querySelector('.product-exterior');

  if (!nameEl || !wearEl) {
    console.log('Waiting for modal elements...');
    return null;
  }

  // Use innerText instead of textContent—it's cleaner for what's visible
  // Then use regex to replace any tabs/newlines/extra spaces with a single space
  const cleanName = nameEl.innerText.replace(/\s+/g, ' ').trim();
  const cleanWear = standardizeWear(wearEl.innerText);
  
  // Log exactly what we are sending so you can compare it to your Python logs
  // console.log('Parsed for Oracle:', {
  //   name: cleanName,
  //   wear: cleanWear,
  //   combined: `${cleanName} (${cleanWear})`
  // });

  return {
    name: cleanName,
    wear: cleanWear,
  };
}

function calculateMinimumSellPrice(buyPrice, feePercent) {
  // Calculate minimum sell price for 10% profit after fees
  const minSellPrice = (buyPrice * 1.1) / (1 - feePercent / 100);
  return minSellPrice;
}

function calculateProfit(buyPrice, sellPrice, feePercent) {
  // Calculate actual profit after fees
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
  // 1. Check if we already added the info to avoid duplicates
  if (document.querySelector('.arb-info-container')) return;

  const details = extractItemDetails();
  const buyPrice = extractPrice();
  const minSell = calculateMinimumSellPrice(buyPrice, feePercentage);

  if (!details || !buyPrice) {
    console.log('Waiting for item details and price...');
    setTimeout(addArbitrageInfo, 500);
    return;
  }

  // 2. Create UI container immediately with loading state
  const infoDiv = document.createElement('div');
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
  
  // Insert AFTER the product-price container (better position)
  const priceContainer = document.querySelector('.product-price');
  if (priceContainer) {
    priceContainer.parentElement.insertBefore(infoDiv, priceContainer.nextSibling);
  } else {
    // Fallback: try to insert intelligently
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

  try {
    // 3. Call your local Flask server
    const response = await fetch('http://127.0.0.1:5000/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });

    const oracleData = await response.json();
    //  console.log('Oracle response:', oracleData);

    if (oracleData && !oracleData.error) {
      updateUIWithOracleData(infoDiv, buyPrice, oracleData, minSell);
    } else {
      // No data available
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
          Item may be too rare or new
        </div>
      `;
    }
  } catch (error) {
    console.error('Oracle error:', error);
    // Offline state
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
        Start: python oracle_server.py
      </div>
    `;
  }
}

function updateUIWithOracleData(container, buyPrice, data, minSell) {
  const fairValue = data.fair_value;
  
  // Calculate potential profit based on Oracle's Fair Value vs current Buy Price
  const netReceived = fairValue * (1 - (feePercentage / 100));
  const potentialProfit = netReceived - buyPrice;
  const profitPercent = (potentialProfit / buyPrice) * 100;
  const isGoodDeal = potentialProfit > 0;

  // Update container class for styling
  container.className = `arb-info-container ${isGoodDeal ? 'arb-container-good' : 'arb-container-bad'}`;

  // Build the beautiful UI
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

// Listen for messages from popup to update fee
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateFee') {
    feePercentage = request.fee;
    addArbitrageInfo();
    sendResponse({ success: true });
  }
});