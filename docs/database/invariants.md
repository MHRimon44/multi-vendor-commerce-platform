# Commerce Platform — Data Invariants

## What is an invariant?

An invariant is a rule that must always remain true regardless of which API,
user, background job, payment callback, or application workflow changes the data.

Important invariants should be protected as close to the data as practical
using PostgreSQL constraints, unique indexes, transactions, locking, and
application-level validation.

---

## 1. Quantities Cannot Be Negative

Inventory quantities must never become negative.

Rules:

- `inventory.quantity_on_hand >= 0`
- `inventory_reservations.quantity > 0`
- `order_items.quantity > 0`

Example database constraint:

```sql
CHECK (quantity_on_hand >= 0)
```

Why:

Selling more stock than exists can create overselling and inconsistent
fulfillment.

---

## 2. Monetary Amounts Cannot Be Negative

Normal commerce amounts must never be negative.

Examples:

- SKU price >= 0
- order subtotal >= 0
- order total >= 0
- vendor-order subtotal >= 0
- payment amount >= 0
- order-item unit price >= 0
- order-item line total >= 0

Refund records are modeled as positive refund amounts rather than negative
payments.

Why:

Negative monetary values can make totals, refunds, reporting, and payment
reconciliation ambiguous.

---

## 3. External Identifiers Must Not Be Processed Twice

Identifiers received from external systems must be unique when present.

Examples:

- payment `external_transaction_id`
- refund `external_refund_id`

Why:

Payment providers can retry callbacks.

Receiving the same callback twice must not create two payments or two refunds.

This is part of making external payment processing idempotent.

---

## 4. Every Order Item Belongs to the Correct Vendor Order

An order item belongs to:

- one parent order
- one vendor order
- one SKU

The SKU's product vendor must match the vendor associated with the
`vendor_order`.

Example:

If:

Product A → Vendor A

then its order item cannot be assigned to:

Vendor Order → Vendor B

Why:

Otherwise Vendor B could accidentally receive, fulfill, or access Vendor A's
sale.

This rule should be validated by the application and protected by the data
model wherever practical.

---

## 5. Vendor Orders Must Belong to Their Parent Order

Every `vendor_order` must reference exactly one parent `order`.

A vendor order cannot exist without a parent customer order.

The relationship is:

```text
Order
  ├── Vendor Order A
  └── Vendor Order B
```

Why:

The parent order represents the customer's checkout while vendor orders
represent independent fulfillment responsibilities.

---

## 6. Order History Must Not Depend on Current Catalog Data

Purchased order data must preserve the values that existed when checkout
occurred.

Therefore an order item stores snapshot values such as:

- product name
- SKU code
- unit price
- quantity
- line total

Example:

Customer buys:

```text
T-Shirt
Price: 1000
```

Tomorrow the vendor changes the catalog price to:

```text
1200
```

The historical order must still show:

```text
1000
```

Why:

Invoices, refunds, customer history, financial records, and audit trails must
remain historically correct.

---

## 7. Inventory Reservation Must Be Atomic

Stock availability must be checked and reserved safely.

Two concurrent customers must not both successfully reserve the same final
unit.

Example:

```text
Available stock = 1

Customer A → attempts reservation
Customer B → attempts reservation
```

Only one reservation may succeed.

Implementation will later require a transaction and an appropriate concurrency
strategy such as row locking or an atomic conditional update.

Why:

A normal read followed by a later write can cause overselling under
concurrency.

---

## 8. Refunds Cannot Exceed the Refundable Paid Amount

For a payment:

```text
total successful refunds <= refundable paid amount
```

Example:

```text
Paid = 5000

Refund #1 = 2000
Refund #2 = 3000
```

Total:

```text
5000
```

A further refund must not be accepted.

Why:

The platform must never return more money than the successfully refundable
amount.

This rule generally requires transactional application logic because it
depends on multiple records.

---

## 9. Fulfillment History Must Be Preserved

Shipment progress must not be represented only by repeatedly overwriting one
status field.

Important shipment changes should create `shipment_events`.

Example:

```text
CREATED
→ PACKED
→ SHIPPED
→ IN_TRANSIT
→ DELIVERED
```

The shipment may store its current status for efficient reads, while
`shipment_events` preserve the historical timeline.

Why:

Support, debugging, customer service, audit, and operational analysis need to
know what happened previously.

---

## 10. Audit Records Are Append-Only

Important business actions must create audit records.

Examples:

- inventory changed
- order cancelled
- payment status changed
- refund approved
- vendor membership changed
- admin performed a privileged operation

Existing audit history should not normally be edited or deleted by ordinary
application workflows.

Why:

Audit logs are evidence of what happened, who performed the action, and when.

---

# Summary

The MVP protects these core rules:

1. Quantities cannot become invalid.
2. Monetary amounts cannot become negative.
3. External payment/refund identifiers cannot be processed twice.
4. Order items cannot cross vendor ownership boundaries.
5. Vendor orders always belong to a parent order.
6. Historical orders preserve purchase-time values.
7. Inventory reservations are concurrency-safe.
8. Refunds cannot exceed the refundable paid amount.
9. Fulfillment history is preserved.
10. Audit history is append-only.

These invariants should later be enforced using a combination of:

- PostgreSQL constraints
- foreign keys
- unique indexes
- transactions
- locking/concurrency control
- NestJS domain/application validation
- authorization/ownership checks
- automated tests
