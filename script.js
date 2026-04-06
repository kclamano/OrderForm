// ============================================================
//  PEPTIDE BABE CO — Order Form Script
// ============================================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo9ZXAxz9Vt7VF1MzAo6K5bPkCMhucha8yjKzB1rYcC-iDhCxSt4-5wWBb997ImDT2/exec';

// ── Cart State ──────────────────────────────────────────────
const cart = {};
const orders = [];

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
  document.getElementById('submitBtn').disabled = grandTotal === 0;
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
    timestamp: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
  };

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

  // Success
  submitBtn.disabled = false;
  submitBtn.textContent = '💗 Submit My Order 💗';

  document.getElementById('successMsg').textContent =
    `Thank you, ${name}! 🌸 Your order totalling ₱${grandTotal.toLocaleString()} has been received. We'll contact you at ${contact} shortly!`;

  document.getElementById('successOverlay').classList.add('show');
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
}

// ── Search / filter products ────────────────────────────────
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

