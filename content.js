// SkinBaron Arbitrage Helper - Content Script

// Default settings
let feePercentage = 8;
let profitPercentage = 10;
let oracleEnabled = true;
let historicEnabled = false;

// Load saved settings from storage
chrome.storage.sync.get(['feePercentage', 'profitPercentage', 'oracleEnabled', 'historicEnabled'], (result) => {
  if (result.feePercentage) {
    feePercentage = result.feePercentage;
  }
  if (result.profitPercentage) {
    profitPercentage = result.profitPercentage;
  }
  if (typeof result.oracleEnabled === 'boolean') {
    oracleEnabled = result.oracleEnabled;
  }
  if (typeof result.historicEnabled === 'boolean') {
    historicEnabled = result.historicEnabled;
  }
  initExtension();
});

function initExtension() {
  if (isItemDetailPage()) {
    addArbitrageInfo();
  }
  
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
  const priceElement = document.querySelector('.modal-inner-content');
  return priceElement !== null;
}

function extractPrice() {
  const element = document.querySelector('.product-price-heading');
  
  if (!element) return null;

  const text = element.textContent.trim();
  const match = text.match(/([0-9,.]+)/);

  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }

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

async function addArbitrageInfo() {
  if (document.querySelector('.arb-info-container')) return;

  const details = extractItemDetails();
  const buyPrice = extractPrice();
  const minSell = calculateMinimumSellPrice(buyPrice, profitPercentage, feePercentage);

  if (!details || !buyPrice) {
    setTimeout(addArbitrageInfo, 500);
    return;
  }

  const infoDiv = document.createElement('div');
  
  // MODE 1: Oracle OFF - Simple Mode
  if (!oracleEnabled) {
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

  // MODE 2 & 3: Oracle ON - Show loading
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
    let oracleData;
    
    // MODE 2: Market Only (Fast)
    if (!historicEnabled) {
      const response = await fetch('http://127.0.0.1:5000/oracle/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details)
      });
      
      oracleData = await response.json();
      
      if (oracleData && !oracleData.error) {
        updateUIMarketOnly(infoDiv, buyPrice, oracleData, minSell, details);
      } else {
        showError(infoDiv, minSell, 'No market data available', oracleData);
      }
    } 
    // MODE 3: Full Oracle (Market + Historic)
    else {
      const response = await fetch('http://127.0.0.1:5000/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details)
      });
      
      oracleData = await response.json();
      console.log("recieved:", oracleData)
      
      if (oracleData && !oracleData.error && oracleData.fair_value) {
        updateUIWithFullOracle(infoDiv, buyPrice, oracleData, minSell);
      } else {
        showError(infoDiv, minSell, 'No sufficient market history', oracleData);
      }
    }
  } catch (error) {
    console.error('Oracle error:', error);
    showError(infoDiv, minSell, 'Oracle service offline');
  }
}

function updateUIMarketOnly(container, buyPrice, data, minSell, details) {
  const marketPrice = data.second_lowest;
  
  // Calculate profit based on market price
  const netReceived = marketPrice * (1 - (feePercentage / 100));
  const potentialProfit = netReceived - buyPrice;
  const profitPercent = (potentialProfit / buyPrice) * 100;
  const isGoodDeal = marketPrice > minSell;

  container.className = `arb-info-container ${isGoodDeal ? 'arb-container-good' : 'arb-container-bad'}`;
  
  // Store details for historic fetch button
  container.dataset.itemName = details.name;
  container.dataset.itemWear = details.wear;
  container.dataset.buyPrice = buyPrice;
  container.dataset.minSell = minSell;

  container.innerHTML = `
    <div class="arb-header">
      <span class="arb-title">${isGoodDeal ? '⚡' : '⚠️'} ORACLE</span>
      <span class="arb-fee">${feePercentage}% Fee</span>
    </div>
    
    <div class="arb-row arb-highlight">
      <span class="arb-label">Min. Sell:</span>
      <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
    </div>

    <div class="arb-row arb-highlight">
      <span class="arb-label">Market (2nd):</span>
      <span class="arb-value arb-breakeven">€${marketPrice.toFixed(2)}</span>
    </div>

    <div class="arb-divider"></div>

    <div class="arb-row">
      <span class="arb-label">Est. Profit:</span>
      <span class="arb-profit ${potentialProfit>0 ? 'positive' : 'negative'}">
        ${potentialProfit>0 ? '+' : ''}€${potentialProfit.toFixed(2)} (${profitPercent.toFixed(1)}%)
      </span>
    </div>

    <div class="arb-verdict ${isGoodDeal ? 'good-deal' : 'bad-deal'}">
      ${isGoodDeal ? '✅ GOOD DEAL' : '❌ OVERPRICED'}
    </div>

    <button class="arb-historic-btn">
      Fetch Historic Price Data
    </button>

    <div class="arb-footer">
      Luti Capital Extension
    </div>
  `;
  
  // Add fetch historic function
  container.fetchHistoric = async function() {
    const btn = this.querySelector('.arb-historic-btn');
    btn.textContent = '⏳ Loading...';
    btn.disabled = true;
    
    try {
      const response = await fetch('http://127.0.0.1:5000/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.dataset.itemName,
          wear: this.dataset.itemWear
        })
      });
      
      const oracleData = await response.json();
      console.log("Data", oracleData)
      
      if (oracleData && !oracleData.error && oracleData.fair_value) {
        updateUIWithFullOracle(this, parseFloat(this.dataset.buyPrice), oracleData, parseFloat(this.dataset.minSell));
      } else {
        btn.textContent = '❌ No historic data';
      }
    } catch (error) {
      btn.textContent = '❌ Failed';
    }
  };

  // Attach click handler to historic button, binding to the container
  const histBtn = container.querySelector('.arb-historic-btn');
  if (histBtn) {
    histBtn.addEventListener('click', container.fetchHistoric.bind(container));
  }
}

function updateUIWithFullOracle(container, buyPrice, data, minSell) {
  const fairValue = data.fair_value;
  
  const netReceived = fairValue * (1 - (feePercentage / 100));
  const potentialProfit = netReceived - buyPrice;
  const profitPercent = (potentialProfit / buyPrice) * 100;
  const isGoodDeal = fairValue > minSell;

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
      <span class="arb-profit ${potentialProfit>0 ? 'positive' : 'negative'}">
        ${potentialProfit>0 ? '+' : ''}€${potentialProfit.toFixed(2)} (${profitPercent.toFixed(1)}%)
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

function showError(container, minSell, message, data) {
  container.className = 'arb-info-container arb-container-neutral';
  container.innerHTML = `
    <div class="arb-header">
      <span class="arb-title">⚠️ ORACLE</span>
      <span class="arb-fee">${feePercentage}% Fee</span>
    </div>
    <div class="arb-row arb-highlight">
      <span class="arb-label">Min. Sell:</span>
      <span class="arb-value arb-breakeven">€${minSell.toFixed(2)}</span>
    </div>
    <div class="arb-verdict neutral-deal">
      ${message}
    </div>
    <div class="arb-row arb-compact">
      <span class="arb-label-small">Market: €${data.second_lowest.toFixed(2)}</span>
    </div>
    
    <div class="arb-footer">
      Luti Capital Extension
    </div>
  `;
}

function insertInfoDiv(infoDiv) {
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
    if (typeof request.historicEnabled === 'boolean') {
      historicEnabled = request.historicEnabled;
    }
    
    const existing = document.querySelector('.arb-info-container');
    if (existing) {
      existing.remove();
    }
    addArbitrageInfo();
    
    sendResponse({ success: true });
    return true;
  }
});