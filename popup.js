// Popup script for SkinBaron Arbitrage Helper

const feeInput = document.getElementById('feeInput');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

// Load saved fee on popup open
chrome.storage.sync.get(['feePercentage'], (result) => {
  if (result.feePercentage) {
    feeInput.value = result.feePercentage;
  }
});

// Save fee when button clicked
saveBtn.addEventListener('click', () => {
  const feeValue = parseFloat(feeInput.value);
  
  if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
    showStatus('Please enter a valid fee between 0 and 100', 'error');
    return;
  }
  
  // Save to chrome storage
  chrome.storage.sync.set({ feePercentage: feeValue }, () => {
    showStatus('Settings saved! Refresh the page to see changes.', 'success');
    
    // Send message to content script to update
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateFee',
          fee: feeValue
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

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type} show`;
  
  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);
}