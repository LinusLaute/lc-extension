function initExtension() {
  // Check Modal
  if (isItemDetailPage()) addArbitrageInfo();
  
  // Check Grid
  processGridItems(5); 

  const observer = new MutationObserver(() => {
    if (isItemDetailPage() && !document.querySelector('.arb-info-container')) {
      addArbitrageInfo();
    }
    // Also trigger grid processing on scroll/DOM change
    processGridItems(5);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}


// NEW: Scoped Extraction for Grid Items
function extractGridItemDetails(itemElement) {
  const nameEl = itemElement.querySelector('.product-name'); // Selector usually differs in grid
  const wearEl = itemElement.querySelector('.product-exterior');
  const priceEl = itemElement.querySelector('.product-price');
  const isStatTrak = nameEl?.innerText.includes('StatTrak™');
  const isSouvenir = nameEl?.innerText.includes('Souvenir');

  if (!nameEl || !priceEl) return null;

  // Simplified regex for the price inside the grid box
  const priceMatch = priceEl.innerText.match(/€\s*([0-9,]+\.?\d*)/);
  const buyPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  return {
    element: itemElement,
    name: nameEl.innerText.trim(),
    wear: standardizeWear(wearEl?.innerText || 'N/A'),
    price: buyPrice,
    isStatTrak,
    isSouvenir
  };
}


async function processGridItems(limit = 5) {
  const gridItems = document.querySelectorAll('li.product-box:not(.oracle-processed)');
  
  // Only process the first N items for testing
  const itemsToProcess = Array.from(gridItems).slice(0, limit);

  for (const item of itemsToProcess) {
    item.classList.add('oracle-processed'); // Mark so we don't double-inject
    
    const details = extractGridItemDetails(item);
    if (!details || details.isSouvenir) {
      injectMiniUI(item, null, 'skipped'); // Gray background
      continue;
    }

    // Call your existing calculation
    const minSell = calculateMinimumSellPrice(details.price, profitPercentage, feePercentage);

    try {
      const response = await fetch('http://127.0.0.1:5000/oracle/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: details.name, wear: details.wear })
      });
      const data = await response.json();
      
      const isGoodDeal = data.second_lowest > minSell;
      injectMiniUI(item, minSell, isGoodDeal ? 'good' : 'bad');
    } catch (e) {
      injectMiniUI(item, minSell, 'error');
    }
  }
}

function injectMiniUI(container, minSell, status) {
  const miniDiv = document.createElement('div');
  miniDiv.className = `arb-mini-badge arb-status-${status}`;
  
  let content = '';
  if (status === 'skipped') content = '<span>SKIPPED</span>';
  else if (status === 'error') content = '<span>ERR</span>';
  else {
    content = `<span>Min: €${minSell.toFixed(2)}</span>`;
  }

  miniDiv.innerHTML = content;
  // Append it to the bottom of the product box
  container.appendChild(miniDiv);
}