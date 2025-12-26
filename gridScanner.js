// GRID SCANNER - Refactored & Fixed
// Scannt ALLE Items im Grid

console.log('🚀 Grid Scanner loaded');


// ===== DETECTION =====
function isGridPage() {
  return document.querySelector('ul.grid') !== null;
}

// ===== EXTRACTION =====
function extractItemData(itemElement) {
  // Extract all data from a SINGLE item element
  const weaponEl = itemElement.querySelector('.badge-wrapper.badgetext');
  const skinEl = itemElement.querySelector('.lName.big');
  const wearEl = itemElement.querySelector('.exteriorName');
  const priceEl = itemElement.querySelector('.price.item');
  
  const weapon = weaponEl?.textContent.trim();
  const skin = skinEl?.textContent.trim();
  const wearRaw = wearEl?.textContent.trim();
  const priceRaw = priceEl?.textContent.trim();
  
  // Parse price
  const priceMatch = priceRaw?.match(/€\s*([0-9,]+\.?\d*)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  
  // Standardize wear
  const normalized = wearRaw?.toLowerCase() || '';
  let wear = null;
  if (normalized.includes('factory')) wear = 'Factory New';
  else if (normalized.includes('minimal')) wear = 'Minimal Wear';
  else if (normalized.includes('field')) wear = 'Field-Tested';
  else if (normalized.includes('well')) wear = 'Well-Worn';
  else if (normalized.includes('battle')) wear = 'Battle-Scarred';
  
  if (!weapon || !skin || !wear || !price) {
    return null;
  }
  
  return {
    element: itemElement,
    name: `${weapon} | ${skin}`,
    wear: wear,
    price: price
  };
}

// ===== UI MANIPULATION =====
function colorItemBackground(itemElement, type) {
  const offerCard = itemElement.querySelector('.offer-card');
  
  if (!offerCard) {
    console.log('❌ No offer-card found');
    return;
  }
  
  // Remove previous coloring (reset)
  offerCard.style.background = '';
  offerCard.style.border = '';
  offerCard.style.boxShadow = '';
  
  if (type === 'good') {
    // GRÜN - Undervalued / Good Deal
    offerCard.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)';
    offerCard.style.border = '2px solid rgba(34, 197, 94, 0.4)';
    offerCard.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)';
    
  } else if (type === 'bad') {
    // ROT - Overvalued / Bad Deal
    offerCard.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)';
    offerCard.style.border = '2px solid rgba(239, 68, 68, 0.4)';
    offerCard.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
    
  } else if (type === 'skip') {
    // GRAU - Skipped / No Data
    offerCard.style.background = 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(107, 114, 128, 0.1) 100%)';
    offerCard.style.border = '2px solid rgba(156, 163, 175, 0.3)';
    offerCard.style.boxShadow = '0 4px 12px rgba(156, 163, 175, 0.15)';
  }
  
  // Smooth transition
  offerCard.style.transition = 'all 0.3s ease';
}

// ===== ORACLE ANALYSIS =====
async function calculateItemState(itemData) {
  if (!itemData) {
    return 'skip';
  }
  
  try {
    // Calculate min sell price
    const minSell = (itemData.price * (1 + profitPercentage / 100)) / (1 - feePercentage / 100);
        
    // Call Oracle API
    const response = await fetch('http://127.0.0.1:5000/oracle/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: itemData.name,
        wear: itemData.wear
      })
    });
    
    const oracleData = await response.json();
    
    if (oracleData && !oracleData.error) {
      const marketPrice = oracleData.second_lowest;
      
      if (marketPrice > minSell) {
        //console.log(`  ✅ GOOD (+€${profit.toFixed(2)})`);
        return 'good';
      } else {
        //console.log(`  ❌ BAD (${profit.toFixed(2)})`);
        return 'bad';
      }
    }
    
    console.log('  ⚠️ No data');
    return 'skip';
    
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return 'skip';
  }
}


// ===== MAIN SCANNER =====
async function scanItemList(maxItems) {
  console.log('=== Starting Grid Scan ===');
  
  if (!isGridPage()) {
    console.log('❌ Not on grid page');
    return;
  }
  
  if (!oracleEnabled) {
    console.log('❌ Oracle disabled');
    return;
  }
  
  const grid = document.querySelector('ul.grid');
  if (!grid) {
    console.log('❌ No grid found');
    return;
  }
  
  // Get all items as array
  const items = Array.from(grid.querySelectorAll('li.product-box'));
  console.log(`Found ${items.length} items, scanning first ${maxItems}...`);
  
  // Limit to maxItems
  const itemsToScan = items.slice(0, maxItems);
  
  // Scan each item
  for (let i = 0; i < itemsToScan.length; i++) {
    const item = itemsToScan[i];
    
    
    // Extract data
    const itemData = extractItemData(item);
    
    if (!itemData) {
      console.log('  ⚠️ Could not extract data');
      colorItemBackground(item, 'skip');
      continue;
    }
    
    // Analyze with Oracle
    const result = await calculateItemState(itemData);
    
    // Update UI
    colorItemBackground(item, result);
    
    // Small delay between requests (rate limiting)
    if (i < itemsToScan.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n=== Scan Complete ===');
}

// ===== INIT FUNCTION (called from main content.js) =====
function initGridScanner(settings = {}, numItems) {
  // Update settings if provided
  if (settings.feePercentage) feePercentage = settings.feePercentage;
  if (settings.profitPercentage) profitPercentage = settings.profitPercentage;
  if (typeof settings.oracleEnabled === 'boolean') oracleEnabled = settings.oracleEnabled;
  
  console.log('Grid Scanner initialized with settings:', {
    feePercentage,
    profitPercentage,
    oracleEnabled
  });
  
  // Auto-start scan after small delay
  if (isGridPage()) {
    console.log('Grid page detected, starting scan in 2s...');
    setTimeout(() => {
      scanItemList(numItems); // Scan first N items
    }, 2000);
  }
}

// ===== EXPORTS (for integration) =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initGridScanner,
    scanItemList,
    isGridPage
  };
}

console.log('✅ Grid Scanner ready');