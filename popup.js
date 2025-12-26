// Popup script for SkinBaron Arbitrage Helper
const feeInput = document.getElementById('feeInput');
const profitInput = document.getElementById('profitInput');
const itemsInput = document.getElementById('itemsInput')

const oracleToggle = document.getElementById('oracleToggle');
const historicToggle = document.getElementById('historicToggle');

const historicSection = document.getElementById('historicSection');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

// Load saved settings on popup open
chrome.storage.sync.get(['feePercentage', 'profitPercentage', 'gridItems', 'oracleEnabled', 'historicEnabled'], (result) => {
  if (result.feePercentage) {
    feeInput.value = result.feePercentage;
  }
  if (result.profitPercentage) {
    profitInput.value = result.profitPercentage;
  }
  if (result.gridItems) {
    itemsInput.value = result.gridItems;
  }
  if (typeof result.oracleEnabled === 'boolean') {
    oracleToggle.checked = result.oracleEnabled;
  }
  if (typeof result.historicEnabled === 'boolean') {
    historicToggle.checked = result.historicEnabled;
  }
  
  // Update historic section visibility
  updateHistoricSection();
});

// Toggle historic section based on oracle toggle
oracleToggle.addEventListener('change', () => {
  updateHistoricSection();
});

function updateHistoricSection() {
  if (oracleToggle.checked) {
    historicSection.classList.remove('disabled');
  } else {
    historicSection.classList.add('disabled');
  }
}

// Save settings when button clicked
saveBtn.addEventListener('click', () => {
  const feeValue = parseFloat(feeInput.value);
  const profitValue = parseFloat(profitInput.value);
  const gridItems = parseInt(itemsInput.value);
  const oracleEnabled = oracleToggle.checked;
  const historicEnabled = oracleToggle.checked ? historicToggle.checked : false;
  
  if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
    showStatus('Please enter a valid fee between 0 and 100', 'error');
    return;
  }
  
  if (isNaN(profitValue) || profitValue < 0 || profitValue > 100) {
    showStatus('Please enter a valid profit between 0 and 100', 'error');
    return;
  }
  
  // Save to chrome storage
  chrome.storage.sync.set({ 
    feePercentage: feeValue,
    profitPercentage: profitValue,
    gridItems: gridItems,
    oracleEnabled: oracleEnabled,
    historicEnabled: historicEnabled
  }, () => {
    showStatus('Settings saved! Changes applied.', 'success');
    
    // Send message to content script to update
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          fee: feeValue,
          profit: profitValue,
          gridItems: gridItems,
          oracleEnabled: oracleEnabled,
          historicEnabled: historicEnabled
        });
      }
    });
  });
});

// Allow saving with Enter key
feeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveBtn.click();
  }
});

profitInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveBtn.click();
  }
});

itemsInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveBtn.click();
  }
});

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type} show`;
  
  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);
}