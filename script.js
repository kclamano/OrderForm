const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw8o3AhN6cWrhbCtDzRKmDROCGCAKDH8eZ4H2HlFz0mWGeqpcuCB_KgaWvnjsBq-r4n/exec';

const cart = {};
const orders = [];
let paymentImageData = '';
let paymentImageName = '';
let selectedShippingRegion = '';

const SHIPPING_RATES = {
  Luzon: { one: 80, two: 95, upto6: 120 },
  Visayas: { one: 100, two: 140, upto6: 180 },
  Mindanao: { one: 120, two: 180, upto6: 210 },
  Other: { one: 0, two: 0, upto6: 0 }
};

function normalizeShippingRegion(region) {
  if (!region) return '';

  const value = String(region).toLowerCase();

  if (value === 'luzon') return 'Luzon';
  if (value === 'visayas') return 'Visayas';
  if (value === 'mindanao') return 'Mindanao';
  if (value === 'other' || value.includes('lalamove') || value.includes('shopee')) return 'Other';

  return region;
}

function getShippingLabel(region = selectedShippingRegion) {
  if (region === 'Other') return 'Lalamove / Shopee Checkout';
  return region || 'No shipping selected';
}

function getTotalItemQty() {
  let qty = 0;

  orders.forEach(order => {
    qty += order.qty || 0;
  });

  Object.values(cart).forEach(item => {
    qty += item.qty;
  });

  return qty;
}

function getShippingBracket(qty) {
  if (qty <= 0) return 'none';
  if (qty === 1) return 'one';
  if (qty === 2) return 'two';
  return 'upto6';
}

function getShippingFee(region = selectedShippingRegion) {
  region = normalizeShippingRegion(region);

  const qty = getTotalItemQty();
  const bracket = getShippingBracket(qty);

  if (!region || bracket === 'none') return 0;
  if (!SHIPPING_RATES[region]) return 0;

  return SHIPPING_RATES[region][bracket] || 0;
}

function updateShippingUI() {
  const qty = getTotalItemQty();
  const bracket = getShippingBracket(qty);

  const bracketText =
    bracket === 'one'
      ? '1pc'
      : bracket === 'two'
        ? '2pcs'
        : qty > 0
          ? 'up to 6pcs'
          : 'no items';

  ['Luzon', 'Visayas', 'Mindanao'].forEach(region => {
    const priceEl = document.getElementById('ship' + region);

    if (priceEl) {
      priceEl.textContent =
        qty > 0
          ? '₱' + SHIPPING_RATES[region][bracket].toLocaleString()
          : '₱0';
    }
  });

  const otherEl = document.getElementById('shipOther');
  if (otherEl) otherEl.textContent = '₱0';

  const helper = document.getElementById('shippingHelper');
  if (helper) {
    helper.textContent =
      qty > 0
        ? `${qty} item(s) selected • rate bracket: ${bracketText}`
        : 'Select region after choosing items';
  }

  document.querySelectorAll('.shipping-option').forEach(btn => {
    const btnRegion = normalizeShippingRegion(btn.dataset.region || btn.dataset.shipping);
    const isSelected = btnRegion === selectedShippingRegion;

    btn.classList.toggle('selected', isSelected);
    btn.classList.toggle('active', isSelected);
  });

  const selected = document.getElementById('shippingSelected');
  if (selected) {
    selected.textContent = selectedShippingRegion
      ? `${getShippingLabel()} shipping: ₱${getShippingFee().toLocaleString()}`
      : 'No shipping selected';
  }
}

function selectShipping(input) {
  let region = '';

  if (typeof input === 'string') {
    region = input;
  } else if (input && input.dataset) {
    region = input.dataset.region || input.dataset.shipping || '';
  } else if (event && event.currentTarget) {
    region = event.currentTarget.dataset.region || event.currentTarget.dataset.shipping || '';
  }

  selectedShippingRegion = normalizeShippingRegion(region);
  renderOrder();
}

function toggleProduct(card) {
  const key = card.dataset.name;

  if (card.classList.contains('selected')) {
    card.classList.remove('selected');
    delete cart[key];
  } else {
    card.classList.add('selected');
    cart[key] = {
      name: key,
      price: parseInt(card.dataset.price),
      qty: 1
    };

    card.querySelector('.qty-num').textContent = '1';
  }

  renderOrder();
}

function changeQty(e, btn, delta) {
  e.stopPropagation();

  const card = btn.closest('.product-card');
  const key = card.dataset.name;

  if (!cart[key]) return;

  cart[key].qty = Math.max(1, cart[key].qty + delta);
  card.querySelector('.qty-num').textContent = cart[key].qty;

  renderOrder();
}

function renderOrder() {
  const container = document.getElementById('orderItems');
  const keys = Object.keys(cart);
  const ordersList = document.getElementById('ordersList');

  let currentTotal = 0;
  let html = '';

  if (!keys.length) {
    html = `
      <div class="empty-state" id="emptyState">
        <span>🛒</span>
        Tap products to add them!
      </div>`;
  } else {
    keys.forEach(k => {
      const item = cart[k];
      const sub = item.price * item.qty;
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

  if (selectedShippingRegion && getTotalItemQty() > 0) {
    html += `
      <div class="order-item current-item">
        <div class="item-info">
          <div class="item-name">🚚 Shipping Fee</div>
          <div class="item-qty">${getShippingLabel()}</div>
        </div>
        <div class="item-price">₱${getShippingFee().toLocaleString()}</div>
      </div>`;
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

  updateShippingUI();
  updateTotals(currentTotal, calculateGrandTotal());
}

function updateTotals(currentTotal, grandTotal) {
  document.getElementById('totalAmount').textContent = grandTotal.toLocaleString();

  document.getElementById('submitBtn').disabled =
    grandTotal === 0 ||
    !paymentImageData ||
    !selectedShippingRegion;
}

function calculateGrandTotal() {
  let grand = 0;

  orders.forEach(order => {
    grand += order.total;
  });

  Object.keys(cart).forEach(k => {
    const item = cart[k];
    grand += item.price * item.qty;
  });

  grand += getShippingFee();

  return grand;
}

async function submitOrder() {
  const name = document.getElementById('custName').value.trim();
  const contact = document.getElementById('custContact').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const notes = document.getElementById('custNotes').value.trim();

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

  if (!selectedShippingRegion) {
    alert('Please select a shipping option 🚚');
    return;
  }

  let allItemLines = [];

  orders.forEach(order => allItemLines.push(...order.itemLines));

  Object.keys(cart).forEach(k => {
    const item = cart[k];
    allItemLines.push(`${item.name} ×${item.qty} = ₱${(item.price * item.qty).toLocaleString()}`);
  });

  const shippingFee = getShippingFee();
  allItemLines.push(`Shipping - ${getShippingLabel()} = ₱${shippingFee.toLocaleString()}`);

  const grandTotal = calculateGrandTotal();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '💗 Sending...';

  const payload = {
    name,
    contact,
    address: address || '—',
    items: allItemLines.join(' | '),
    total: '₱' + grandTotal.toLocaleString(),
    notes: notes || '—',
    shipping: `${getShippingLabel()} - ₱${shippingFee.toLocaleString()}`,
    timestamp: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    imageName: paymentImageName || '—',
    imageData: paymentImageData || ''
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('show');

  orders.length = 0;
  Object.keys(cart).forEach(k => delete cart[k]);

  document.querySelectorAll('.product-card.selected')
    .forEach(c => c.classList.remove('selected'));

  document.querySelectorAll('.qty-num')
    .forEach(span => span.textContent = '1');

  ['custName', 'custContact', 'custAddress', 'custNotes']
    .forEach(id => document.getElementById(id).value = '');

  selectedShippingRegion = '';
  removePaymentScreenshot();
  renderOrder();
}

function addCurrentToOrders() {
  const keys = Object.keys(cart);

  if (keys.length === 0) {
    alert('No items in current cart 💗');
    return;
  }

  const orderTotal = Object.values(cart)
    .reduce((sum, item) => sum + item.price * item.qty, 0);

  const itemLines = keys.map(k => {
    const item = cart[k];
    return `${item.name} ×${item.qty} = ₱${(item.price * item.qty).toLocaleString()}`;
  });

  const orderQty = Object.values(cart)
    .reduce((sum, item) => sum + item.qty, 0);

  orders.push({
    total: orderTotal,
    itemLines,
    qty: orderQty
  });

  Object.keys(cart).forEach(k => delete cart[k]);

  document.querySelectorAll('.product-card.selected')
    .forEach(c => c.classList.remove('selected'));

  document.querySelectorAll('.qty-num')
    .forEach(span => span.textContent = '1');

  renderOrder();
}

function startNewOrder() {
  Object.keys(cart).forEach(k => delete cart[k]);

  document.querySelectorAll('.product-card.selected')
    .forEach(c => c.classList.remove('selected'));

  document.querySelectorAll('.qty-num')
    .forEach(span => span.textContent = '1');

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
      .forEach(d => {
        d.style.display = q ? 'none' : '';
      });
  });
});

function showPayTab(btn, id) {
  document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pay-content').forEach(c => c.classList.remove('active'));

  btn.classList.add('active');
  document.getElementById('pay-' + id).classList.add('active');
}