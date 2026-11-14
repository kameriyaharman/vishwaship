/* Vishwaship EDD widget — shows "Delivery by <date>" for a buyer pincode.
   Usage: <div id="vishwaship-edd" data-from="110034"></div>
          <script src="https://<your-site>/edd-widget.js" data-api="https://<api>" async></script> */
(function () {
  var s = document.currentScript || document.querySelector('script[src*="edd-widget.js"]');
  var api = (s && s.getAttribute('data-api')) || '/api';
  function mount(el) {
    if (el.__vs) return; el.__vs = 1;
    var from = el.getAttribute('data-from') || '';
    el.innerHTML = '<div style="font-family:system-ui,sans-serif;border:1px solid #e5e7eb;border-radius:10px;padding:12px;max-width:360px">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#0b1f3a">Check delivery date</div>' +
      '<div style="display:flex;gap:8px"><input maxlength="6" inputmode="numeric" placeholder="Enter pincode" style="flex:1;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px">' +
      '<button style="background:#f0712c;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer">Check</button></div>' +
      '<div class="vs-out" style="font-size:13px;margin-top:8px"></div></div>';
    var input = el.querySelector('input'), btn = el.querySelector('button'), out = el.querySelector('.vs-out');
    function go() {
      var to = (input.value || '').replace(/\D/g, '');
      if (to.length !== 6) { out.innerHTML = '<span style="color:#c62828">Enter a valid 6-digit pincode</span>'; return; }
      out.textContent = 'Checking…';
      fetch(api.replace(/\/$/, '') + '/public/edd?from=' + from + '&to=' + to).then(function (r) { return r.json(); }).then(function (d) {
        if (d.error) out.innerHTML = '<span style="color:#c62828">' + d.error + '</span>';
        else if (!d.serviceable) out.innerHTML = '<span style="color:#c62828">' + d.message + '</span>';
        else out.innerHTML = '<b style="color:#1e7b3a">' + d.label + '</b>' + (d.cod ? ' · COD available' : ' · Prepaid only');
      }).catch(function () { out.textContent = 'Could not check right now.'; });
    }
    btn.onclick = go; input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }
  function init() { var els = document.querySelectorAll('#vishwaship-edd, .vishwaship-edd'); for (var i = 0; i < els.length; i++) mount(els[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
