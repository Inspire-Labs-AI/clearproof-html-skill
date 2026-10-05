---
kicker: System architecture
title: An order goes from the shopper's tap to the database in 4 hops
tldr: The **API gateway** checks every request, the **Orders** service writes the order, and slow work moves to a queue.
for: anyone new to the shop's backend
---
## The system {hero}
```architecture caption="The bold line is the order itself. Dashed lines happen later, in the background. Press ▶ to follow one order."
tier Users
  Shopper (user) mobile and web
tier Apps
  Web app (client) Next.js, Mobile app (mobile) React Native
tier Edge
  API gateway (gateway) auth + rate limit
tier Services
  *Orders (service) src/orders/, Payments (service) src/payments/, Email worker (worker) BullMQ, Recommender (ai) embeddings
tier Data
  Orders DB (db) Postgres 15, Cache (cache) Redis, Events (queue) Kafka, Receipts (storage) S3
tier External
  Stripe (external) card payments, SendGrid (external) email
Shopper -> Web app & Mobile app: taps "Buy" | The shopper buys from the web or the phone app.
Web app ==> API gateway: HTTPS | Every request passes the gateway. It checks the token and the rate limit.
Mobile app -> API gateway: HTTPS | The phone app uses the same gateway.
API gateway ==> Orders: POST /orders | The gateway forwards the order to the Orders service.
Orders ==> Orders DB: INSERT | Orders writes the order in one transaction.
Orders -> Cache: stock check | Orders checks stock in the cache before it writes.
Orders -> Payments: charge | Orders asks Payments to charge the card.
Payments -> Stripe: charge card | Payments calls Stripe, and Stripe charges the card.
Orders --> Events: order.created | After the commit, Orders publishes an event. Nothing waits for it.
Events --> Email worker: consume | The email worker reads the event from the queue.
Email worker --> SendGrid: send receipt | The worker sends the receipt through SendGrid.
Email worker --> Receipts: PDF | The worker stores a PDF copy in S3.
Recommender --> Orders DB: reads history | Separately, the recommender reads order history.
```

## What to remember
- **One entry point.** Every request passes the API gateway, so auth and rate limits live in one place.
- **Orders writes the order before anything slow happens.** Email and receipts run later, from the queue.
- **Only Payments talks to Stripe.** Card data never touches the Orders service.
