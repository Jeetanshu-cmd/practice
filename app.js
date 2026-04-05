const fruits = [
    { id: 1, name: 'Apple', icon: '🍎', price: 0.50 },
    { id: 2, name: 'Banana', icon: '🍌', price: 0.30 },
    { id: 3, name: 'Mango', icon: '🥭', price: 1.20 },
    { id: 4, name: 'Orange', icon: '🍊', price: 0.60 },
    { id: 5, name: 'Grapes', icon: '🍇', price: 2.00 },
    { id: 6, name: 'Strawberry', icon: '🍓', price: 1.50 },
    { id: 7, name: 'Watermelon', icon: '🍉', price: 3.00 },
    { id: 8, name: 'Pineapple', icon: '🍍', price: 2.50 },
    { id: 9, name: 'Kiwi', icon: '🥝', price: 0.80 },
    { id: 10, name: 'Peach', icon: '🍑', price: 0.90 }
];

let basket = {};

function init() {
    renderFruitList();
    updateCartCount();
    toggleCardDetails();
}

function renderFruitList() {
    const fruitListEl = document.getElementById('fruit-list');
    fruitListEl.innerHTML = fruits.map(fruit => `
        <div class="fruit-card" data-id="${fruit.id}">
            <span class="fruit-icon">${fruit.icon}</span>
            <div class="fruit-name">${fruit.name}</div>
            <div class="fruit-price">$${fruit.price.toFixed(2)}</div>
            <div class="quantity-control">
                <button onclick="decreaseQuantity(${fruit.id})">−</button>
                <span id="qty-${fruit.id}">${getSelectedQuantity(fruit.id)}</span>
                <button onclick="increaseQuantity(${fruit.id})">+</button>
            </div>
            <button class="add-btn" id="btn-${fruit.id}" onclick="addToBasket(${fruit.id})">
                ${basket[fruit.id] ? 'Update Basket' : 'Add to Basket'}
            </button>
        </div>
    `).join('');
}

function getSelectedQuantity(fruitId) {
    return basket[fruitId] ? basket[fruitId].quantity : 1;
}

function increaseQuantity(fruitId) {
    const currentQty = getSelectedQuantity(fruitId);
    updateQuantityDisplay(fruitId, currentQty + 1);
}

function decreaseQuantity(fruitId) {
    const currentQty = getSelectedQuantity(fruitId);
    if (currentQty > 1) {
        updateQuantityDisplay(fruitId, currentQty - 1);
    }
}

function updateQuantityDisplay(fruitId, quantity) {
    const qtyEl = document.getElementById(`qty-${fruitId}`);
    if (qtyEl) {
        qtyEl.textContent = quantity;
    }
}

function addToBasket(fruitId) {
    const fruit = fruits.find(f => f.id === fruitId);
    const quantity = getSelectedQuantity(fruitId);
    
    if (basket[fruitId]) {
        basket[fruitId].quantity = quantity;
    } else {
        basket[fruitId] = {
            ...fruit,
            quantity: quantity
        };
    }
    
    updateCartCount();
    renderFruitList();
    showToast(`${fruit.name} added to basket!`);
}

function removeFromBasket(fruitId) {
    const fruit = basket[fruitId];
    delete basket[fruitId];
    updateCartCount();
    renderCart();
    renderFruitList();
    if (fruit) {
        showToast(`${fruit.name} removed from basket`);
    }
}

function changeBasketQuantity(fruitId, delta) {
    if (basket[fruitId]) {
        basket[fruitId].quantity += delta;
        if (basket[fruitId].quantity <= 0) {
            removeFromBasket(fruitId);
        } else {
            renderCart();
            updateCartCount();
        }
    }
}

function updateCartCount() {
    const count = Object.values(basket).reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
}

function toggleCart() {
    const cartSection = document.getElementById('cart-section');
    cartSection.classList.toggle('hidden');
    if (!cartSection.classList.contains('hidden')) {
        renderCart();
        document.getElementById('payment-section').classList.add('hidden');
        document.getElementById('checkout-btn').classList.remove('hidden');
    }
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartValues = Object.values(basket);
    
    if (cartValues.length === 0) {
        cartItemsEl.innerHTML = '<div class="empty-cart">Your basket is empty</div>';
        document.getElementById('checkout-btn').disabled = true;
    } else {
        document.getElementById('checkout-btn').disabled = false;
        cartItemsEl.innerHTML = cartValues.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-icon">${item.icon}</span>
                    <div>
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
                    </div>
                </div>
                <div class="cart-item-quantity">
                    <button onclick="changeBasketQuantity(${item.id}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeBasketQuantity(${item.id}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromBasket(${item.id})">Remove</button>
            </div>
        `).join('');
    }
    
    const total = cartValues.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('total-price').textContent = `$${total.toFixed(2)}`;
}

function showPayment() {
    const cartValues = Object.values(basket);
    if (cartValues.length === 0) {
        showToast('Your basket is empty!');
        return;
    }
    
    document.getElementById('payment-section').classList.remove('hidden');
    document.getElementById('checkout-btn').classList.add('hidden');
    toggleCardDetails();
    
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.onchange = toggleCardDetails;
    });
}

function toggleCardDetails() {
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const cardDetails = document.getElementById('card-details');
    
    if (paymentMethod === 'card') {
        cardDetails.classList.remove('hidden');
    } else {
        cardDetails.classList.add('hidden');
    }
}

function processPayment() {
    const cartValues = Object.values(basket);
    const total = cartValues.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
    let paymentName = '';
    switch(paymentMethod) {
        case 'card': paymentName = 'Credit/Debit Card'; break;
        case 'paypal': paymentName = 'PayPal'; break;
        case 'cash': paymentName = 'Cash on Delivery'; break;
    }
    
    alert(`Payment Successful!\n\nAmount: $${total.toFixed(2)}\nPayment Method: ${paymentName}\n\nThank you for your order! 🍎`);
    
    basket = {};
    updateCartCount();
    renderFruitList();
    toggleCart();
    showToast('Order placed successfully!');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

init();
