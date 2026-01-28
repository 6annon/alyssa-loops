import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import Stripe from "stripe";

dotenv.config();

const app = express();

/* ======================
   CORS
====================== */
app.use(
  cors({
    origin: [
      "https://ubiquitous-dango-f87547.netlify.app",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
  })
);

/* ======================
   Services
====================== */
const resend = new Resend(process.env.RESEND_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ======================
   Env
====================== */
const TO_EMAIL = process.env.TO_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL;
const CLIENT_URL = process.env.CLIENT_URL; // ✅ ONLY frontend URL we use

/* ======================
   Health
====================== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ======================
   Stripe webhook (RAW)
====================== */
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("WEBHOOK SIGNATURE ERROR:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const customerEmail =
          session.customer_details?.email || session.customer_email;
        const customerName = session.customer_details?.name || "Customer";

        const ship = session.shipping_details;
        const shippingText = ship
          ? `${ship.name || customerName}
${ship.address?.line1 || ""}${ship.address?.line2 ? "\n" + ship.address.line2 : ""}
${ship.address?.city || ""}, ${ship.address?.state || ""} ${ship.address?.postal_code || ""}
${ship.address?.country || ""}`
          : "No shipping address provided.";

        let cart = {};
        try {
          cart = JSON.parse(session.metadata?.cart_json || "{}");
        } catch {
          cart = {};
        }

        const items = Object.values(cart)
          .map((i) => `${i.qty}× ${i.name} — $${i.price}`)
          .join("\n");

        const total = session.amount_total
          ? `$${(session.amount_total / 100).toFixed(2)}`
          : "(unknown)";

        // Email YOU
        await resend.emails.send({
          from: `Alyssa Loops <${FROM_EMAIL}>`,
          to: [TO_EMAIL],
          subject: `PAID Order — Alyssa Loops (${total})`,
          text:
            `PAID ORDER ✅\n\n` +
            `Customer: ${customerName}\n` +
            `Customer Email: ${customerEmail || "unknown"}\n\n` +
            `Shipping:\n${shippingText}\n\n` +
            `Items:\n${items || "(no items)"}\n\n` +
            `Stripe Session: ${session.id}\n` +
            `— Alyssa Loops Website`,
        });

        // Email CUSTOMER
        if (customerEmail) {
          await resend.emails.send({
            from: `Alyssa Loops <${FROM_EMAIL}>`,
            to: [customerEmail],
            subject: "Order Confirmed — Alyssa Loops ✿",
            text:
              `Thanks for your order, ${customerName}!\n\n` +
              `We received your payment and will start preparing your items.\n\n` +
              `Shipping to:\n${shippingText}\n\n` +
              `Your items:\n${items || "(items not available)"}\n\n` +
              `Total paid: ${total}\n\n` +
              `If you need anything, just reply to this email.\n` +
              `— Alyssa Loops`,
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("WEBHOOK HANDLER ERROR:", err);
      res.json({ received: true });
    }
  }
);

/* ======================
   JSON (after webhook)
====================== */
app.use(express.json());

/* ======================
   Contact form
====================== */
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, details } = req.body;

    if (!name || !email || !details) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    await resend.emails.send({
      from: `Alyssa Loops <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      replyTo: email,
      subject: `Custom Order Request — ${name}`,
      text:
        `NEW CUSTOM REQUEST\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n\n` +
        `Request:\n${details}\n\n` +
        `— Alyssa Loops Website`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("CONTACT ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ======================
   Create Stripe Checkout
====================== */
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { cart } = req.body;

    if (!cart || Object.keys(cart).length === 0) {
      return res.status(400).json({ ok: false, error: "Cart empty" });
    }

    const line_items = Object.values(cart).map((i) => ({
      quantity: Number(i.qty) || 1,
      price_data: {
        currency: "usd",
        product_data: { name: i.name },
        unit_amount: Math.round(Number(i.price) * 100),
      },
    }));

    const cart_json = JSON.stringify(cart);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: { enabled: true },

      // ✅ FIXED — NO LOCALHOST
      success_url: `${CLIENT_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel.html`,

      metadata: { cart_json },
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("CREATE SESSION ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ======================
   Start server
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
