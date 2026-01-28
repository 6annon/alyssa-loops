const API_BASE = "https://alyssa-loops.onrender.com";

const cartBtn = document.getElementById("cartBtn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const closeDrawer = document.getElementById("closeDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartEmptyEl = document.getElementById("cartEmpty");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");

const customForm = document.getElementById("customForm");
const formNote = document.getElementById("formNote");

const newsletterEmail = document.getElementById("newsletterEmail");
const newsletterBtn = document.getElementById("newsletterBtn");
const newsletterNote = document.getElementById("newsletterNote");

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

let cart = JSON.parse(localStorage.getItem("crochet_cart") || "{}");

function money(n) {
  return `$${Number(n).toFixed(0)}`;
}

function openCart() {
  if (!drawer) return;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function saveCart() {
  localStorage.setItem("crochet_cart", JSON.stringify(cart));
}

function cartCount() {
  return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
}

function cartTotal() {
  return Object.values(cart).reduce((sum, item) => sum + item.qty * item.price, 0);
}

function renderCart() {
  if (!cartItemsEl || !cartEmptyEl || !cartTotalEl || !cartCountEl) return;

  cartItemsEl.innerHTML = "";
  const items = Object.values(cart);

  cartCountEl.textContent = cartCount();
  cartTotalEl.textContent = money(cartTotal());

  cartEmptyEl.style.display = items.length ? "none" : "block";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const left = document.createElement("div");
    left.innerHTML = `
      <strong>${item.name}</strong>
      <div class="sub">${money(item.price)} each</div>
    `;

    const right = document.createElement("div");
    right.className = "qty";
    right.innerHTML = `
      <button type="button" aria-label="Decrease quantity">−</button>
      <span>${item.qty}</span>
      <button type="button" aria-label="Increase quantity">+</button>
    `;

    const [minusBtn, , plusBtn] = right.children;

    minusBtn.addEventListener("click", () => {
      cart[item.name].qty -= 1;
      if (cart[item.name].qty <= 0) delete cart[item.name];
      saveCart();
      renderCart();
    });

    plusBtn.addEventListener("click", () => {
      cart[item.name].qty += 1;
      saveCart();
      renderCart();
    });

    row.appendChild(left);
    row.appendChild(right);
    cartItemsEl.appendChild(row);
  });
}

function addToCart(name, price) {
  const itemName = (name || "").toString().trim();
  const itemPrice = Number(price);

  if (!itemName || !Number.isFinite(itemPrice)) return;

  if (!cart[itemName]) cart[itemName] = { name: itemName, price: itemPrice, qty: 0 };
  cart[itemName].qty += 1;
  saveCart();
  renderCart();
  openCart();
}

// Delegated add-to-cart listener
document.addEventListener(
  "click",
  (e) => {
    const btn = e.target.closest('button[data-add][data-price]');
    if (!btn) return;
    addToCart(btn.dataset.add, btn.dataset.price);
  },
  true
);

if (cartBtn) cartBtn.addEventListener("click", openCart);
if (closeDrawer) closeDrawer.addEventListener("click", closeCart);
if (drawerOverlay) drawerOverlay.addEventListener("click", closeCart);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
});

/* ======================
   CONTACT FORM -> EMAIL
====================== */
if (customForm) {
  customForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(customForm);
    const name = (data.get("name") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const details = (data.get("details") || "").toString().trim();

    if (!name || !email || !details) {
      if (formNote) formNote.textContent = "Please fill out all fields.";
      return;
    }

    if (formNote) formNote.textContent = "Sending…";

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, details })
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok || !out.ok) {
        throw new Error(out?.error || "Failed to send");
      }

      if (formNote) formNote.textContent = `Thanks${name ? ", " + name : ""}! Message sent ✿`;
      customForm.reset();
      setTimeout(() => {
        if (formNote) formNote.textContent = "";
      }, 3500);
    } catch (err) {
      console.error(err);
      if (formNote) formNote.textContent = "Couldn’t send. Is the server running?";
    }
  });
}

/* ======================
   CHECKOUT -> EMAIL ORDER
====================== */
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", async () => {
    if (cartCount() === 0) {
      alert("Your cart is empty!");
      return;
    }

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Redirecting…";

    try {
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart })
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok || !out.url) {
        throw new Error(out?.error || "Failed to start checkout");
      }

      // Send them to Stripe Checkout
      window.location.href = out.url;
    } catch (err) {
      console.error(err);
      alert("Couldn’t start Stripe checkout. Is the server running?");
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Checkout";
    }
  });
}

/* ======================
   Newsletter (still demo)
====================== */
if (newsletterBtn) {
  newsletterBtn.addEventListener("click", () => {
    const email = (newsletterEmail?.value || "").trim();
    if (!email || !email.includes("@")) {
      if (newsletterNote) newsletterNote.textContent = "Please enter a valid email.";
      return;
    }
    if (newsletterNote) newsletterNote.textContent = "Subscribed! (Demo — no email is actually sent.)";
    if (newsletterEmail) newsletterEmail.value = "";
    setTimeout(() => {
      if (newsletterNote) newsletterNote.textContent = "";
    }, 3500);
  });
}

/* ===== Turntable init (AUTO SPIN + CENTER POP SUPPORT) ===== */
function initTurntable(root) {
  const ring = root.querySelector(".tt-ring");
  const slides = Array.from(root.querySelectorAll(".tt-card"));
  const prev = root.querySelector('[data-tt="prev"]');
  const next = root.querySelector('[data-tt="next"]');
  const dotsWrap = root.querySelector(".tt-dots");
  const stage = root.querySelector(".tt-stage");

  if (!ring || slides.length === 0) return;

  slides.forEach((s) => {
    s.querySelectorAll("button.btn[data-add][data-price]").forEach((b) => {
      b.type = "button";
    });
  });

  const n = slides.length;
  const step = 360 / n;

  function computeRadius() {
    const card = slides[0].getBoundingClientRect();
    const w = Math.max(320, Math.min(card.width || 360, 420));
    return Math.round((w / 2) / Math.tan(Math.PI / n)) + 90;
  }

  let index = 0;

  function setActiveCard() {
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
  }

  function layout() {
    const radius = computeRadius();
    slides.forEach((slide, i) => {
      slide.style.transform = `translate(-50%, -50%) rotateY(${i * step}deg) translateZ(${radius}px)`;
    });
    rotateTo(index, true);
  }

  function ensureDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "tt-dot" + (i === index ? " active" : "");
      dot.setAttribute("aria-label", `Go to item ${i + 1}`);
      dot.addEventListener("click", () => rotateTo(i));
      dotsWrap.appendChild(dot);
    }
  }

  function setActiveDot() {
    if (!dotsWrap) return;
    dotsWrap.querySelectorAll(".tt-dot").forEach((d, i) => {
      d.classList.toggle("active", i === index);
    });
  }

  function rotateTo(i, instant = false) {
    index = ((i % n) + n) % n;

    if (instant) ring.style.transition = "none";
    ring.style.transform = `rotateY(${-index * step}deg)`;

    if (instant) {
      requestAnimationFrame(() => {
        ring.style.transition = "transform 650ms cubic-bezier(.2,.9,.2,1)";
      });
    }

    setActiveDot();
    setActiveCard();
  }

  prev?.addEventListener("click", () => rotateTo(index - 1));
  next?.addEventListener("click", () => rotateTo(index + 1));

  let autoTimer = null;
  const autoDelay = 2600;

  function startAuto() {
    if (autoTimer) return;
    autoTimer = setInterval(() => rotateTo(index + 1), autoDelay);
  }

  function stopAuto() {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = null;
  }

  stage?.addEventListener("mouseenter", stopAuto);
  stage?.addEventListener("mouseleave", startAuto);
  root.addEventListener("focusin", stopAuto);
  root.addEventListener("focusout", startAuto);

  stage?.addEventListener("touchstart", stopAuto, { passive: true });
  stage?.addEventListener("touchend", () => setTimeout(startAuto, 600), { passive: true });

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") rotateTo(index - 1);
    if (e.key === "ArrowRight") rotateTo(index + 1);
  });

  ensureDots();
  layout();
  setActiveCard();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 80);
  });

  startAuto();
}

document.querySelectorAll("[data-turntable]").forEach(initTurntable);

renderCart();

