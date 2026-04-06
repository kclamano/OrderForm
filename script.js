// ============================================================
//  PEPTIDE BABE CO — Order Form Script
// ============================================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw8o3AhN6cWrhbCtDzRKmDROCGCAKDH8eZ4H2HlFz0mWGeqpcuCB_KgaWvnjsBq-r4n/exec';

// ── Cart State ──────────────────────────────────────────────
const cart = {};
const orders = [];
let paymentImageData = '';
let paymentImageName = '';

// ── Toggle product selected / deselected ───────────────────
function toggleProduct(card) {
  const key = card.dataset.name;

  if (card.classList.contains('selected')) {
    card.classList.remove('selected');
    delete cart[key];
  } else {
    card.classList.add('selected');
    cart[key] = {
      name:  key,
      price: parseInt(card.dataset.price),
      qty:   1
    };
    card.querySelector('.qty-num').textContent = '1';
  }

  renderOrder();
}

// ── Change quantity ─────────────────────────────────────────
function changeQty(e, btn, delta) {
  e.stopPropagation();
  const card = btn.closest('.product-card');
  const key  = card.dataset.name;
  if (!cart[key]) return;

  cart[key].qty = Math.max(1, cart[key].qty + delta);
  card.querySelector('.qty-num').textContent = cart[key].qty;
  renderOrder();
}

// ── Render order summary panel ──────────────────────────────
function renderOrder() {
  const container = document.getElementById('orderItems');
  const keys      = Object.keys(cart);
  const ordersList = document.getElementById('ordersList');

  let currentTotal = 0;
  let html  = '';

  if (!keys.length) {
    html = `
      <div class="empty-state" id="emptyState">
        <span>🛒</span>
        Tap products to add them!
      </div>`;
  } else {
    keys.forEach(k => {
      const item = cart[k];
      const sub  = item.price * item.qty;
      currentTotal += sub;
      html += `
        <div class="order-item current-item">
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-qty">×${item.qty} @ ₱${item.price.toLocaleString()}</div>
          </div>
          <div class="item-price">₱${sub.toLocaleString()}</div>
        </div>`;
    });
  }

  container.innerHTML = html;

  let ordersHtml = '';
  if (orders.length) {
    orders.forEach((order, index) => {
      ordersHtml += `
        <div class="order-item" style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10B981; padding: 8px 12px; margin-bottom: 6px; border-radius: 8px;">
          <div class="item-info">
            <div class="item-name">Order #${index + 1}</div>
          </div>
          <div class="item-price">₱${order.total.toLocaleString()}</div>
        </div>`;
    });
  } else {
    ordersHtml = '<div style="opacity: 0.5; font-size: 12px; text-align: center; padding: 20px; color: var(--muted);">No previous orders</div>';
  }
  ordersList.innerHTML = ordersHtml;

  updateTotals(currentTotal, calculateGrandTotal());
}

function updateTotals(currentTotal, grandTotal) {
  document.getElementById('totalAmount').textContent = grandTotal.toLocaleString();
  document.getElementById('submitBtn').disabled = grandTotal === 0 || !paymentImageData;
}

function calculateGrandTotal() {
  let grand = 0;
  orders.forEach(order => grand += order.total);
  const currentKeys = Object.keys(cart);
  currentKeys.forEach(k => {
    const item = cart[k];
    grand += item.price * item.qty;
  });
  return grand;
}

// ── Submit ALL orders to Google Sheets ──────────────────────
async function submitOrder() {
  const name    = document.getElementById('custName').value.trim();
  const contact = document.getElementById('custContact').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const notes   = document.getElementById('custNotes').value.trim();

  if (!name || !contact) {
    alert('Please enter your name and contact details 💗');
    return;
  }

  if (!paymentImageData) {
    alert('Please upload your payment screenshot before submitting.');
    return;
  }

  if (orders.length === 0 && Object.keys(cart).length === 0) {
    alert('Please add some items to your order 💗');
    return;
  }

  // Flatten all orders + current cart
  let allItemLines = [];
  orders.forEach(order => allItemLines.push(...order.itemLines));
  const currentKeys = Object.keys(cart);
  currentKeys.forEach(k => {
    const item = cart[k];
    allItemLines.push(`${item.name} ×${item.qty} = ₱${(item.price * item.qty).toLocaleString()}`);
  });
  const grandTotal = calculateGrandTotal();

  // Show loading
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '💗 Sending...';

  // Payload
  const payload = {
    name,
    contact,
    address:   address || '—',
    items:     allItemLines.join(' | '),
    total:     '₱' + grandTotal.toLocaleString(),
    notes:     notes || '—',
    timestamp: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    imageName: paymentImageName || '—',
    imageData: paymentImageData || ''
  };

  // Send as JSON via fetch (no-cors to avoid CORS errors with Google Apps Script)
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Submission error:', err);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = '💗 Submit My Order 💗';

  document.getElementById('successMsg').textContent =
    `Thank you, ${name}! 🌸 Your order totalling ₱${grandTotal.toLocaleString()} has been received. We'll contact you at ${contact} shortly!`;

  document.getElementById('successOverlay').classList.add('show');
}

function handlePaymentScreenshot(event) {
  const file = event.target.files[0];
  const previewEl = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');

  if (!file) {
    paymentImageData = '';
    paymentImageName = '';
    previewEl.style.display = 'none';
    previewImg.src = '';
    updateTotals(0, calculateGrandTotal());
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Please choose an image smaller than 5MB.');
    event.target.value = '';
    updateTotals(0, calculateGrandTotal());
    return;
  }

  paymentImageName = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    paymentImageData = reader.result;
    previewImg.src = paymentImageData;
    previewEl.style.display = 'flex';
    updateTotals(0, calculateGrandTotal());
  };
  reader.readAsDataURL(file);
}

function removePaymentScreenshot() {
  const fileInput = document.getElementById('custImage');
  const previewEl = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');

  fileInput.value = '';
  paymentImageData = '';
  paymentImageName = '';
  previewImg.src = '';
  previewEl.style.display = 'none';
  updateTotals(0, calculateGrandTotal());
}

// ── Close success modal & reset ─────────────────────────────
function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('show');

  // Clear all orders and current cart
  orders.length = 0;
  Object.keys(cart).forEach(k => delete cart[k]);
  renderOrder();

  // Deselect all cards
  document.querySelectorAll('.product-card.selected')
    .forEach(c => c.classList.remove('selected'));

  // Clear form
  ['custName', 'custContact', 'custAddress', 'custNotes']
    .forEach(id => document.getElementById(id).value = '');
  removePaymentScreenshot();
}

// ── Add current cart to orders list ────────────────────────
function addCurrentToOrders() {
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    alert('No items in current cart 💗');
    return;
  }
  const orderTotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemLines = keys.map(k => {
    const item = cart[k];
    return `${item.name} ×${item.qty} = ₱${(item.price * item.qty).toLocaleString()}`;
  });
  orders.push({ total: orderTotal, itemLines });

  Object.keys(cart).forEach(k => delete cart[k]);
  document.querySelectorAll('.product-card.selected').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.qty-num').forEach(span => span.textContent = '1');
  renderOrder();
}

function startNewOrder() {
  Object.keys(cart).forEach(k => delete cart[k]);
  document.querySelectorAll('.product-card.selected').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.qty-num').forEach(span => span.textContent = '1');
  renderOrder();
}

document.addEventListener('DOMContentLoaded', () => {
  renderOrder();

  document.getElementById('searchInput').addEventListener('input', function () {
    const q = this.value.toLowerCase();

    document.querySelectorAll('.product-card').forEach(card => {
      card.style.display = card.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });

    document.querySelectorAll('[data-group]').forEach(group => {
      const hasVisible = [...group.querySelectorAll('.product-card')]
        .some(c => c.style.display !== 'none');
      group.style.display = hasVisible ? '' : 'none';
    });

    document.querySelectorAll('.cat-divider')
      .forEach(d => { d.style.display = q ? 'none' : ''; });
  });
});


// ── Payment tab switcher ────────────────────────────────────
function showPayTab(btn, id) {
  document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pay-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pay-' + id).classList.add('active');
}
