(function () {
  var input = document.getElementById('app-url');
  var saveBtn = document.getElementById('save');
  var status = document.getElementById('status');

  chrome.storage.local.get(['accessScanAppUrl'], function (data) {
    input.value = data.accessScanAppUrl || 'https://app.a11ytest.ai';
  });

  saveBtn.addEventListener('click', function () {
    var url = (input.value || '').trim().replace(/\/$/, '');
    if (!url) {
      status.textContent = 'Please enter a URL.';
      status.style.color = '#b91c1c';
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    chrome.storage.local.set({ accessScanAppUrl: url }, function () {
      status.textContent = 'Saved. Reopen the side panel to use the new URL.';
      status.style.color = '#059669';
    });
  });
})();
