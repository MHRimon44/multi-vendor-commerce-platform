# Inventory Concurrency Strategy

## Problem

Two customers can attempt to purchase the same remaining inventory at the same time.

A normal read followed by an update is unsafe:

1. Checkout A reads available stock = 1.
2. Checkout B reads available stock = 1.
3. Checkout A creates an order.
4. Checkout B creates an order.
5. Two units are promised although only one exists.

This is an oversell race condition.

## Selected Strategy

The Commerce Platform uses PostgreSQL pessimistic row locking during checkout.

The inventory row is loaded inside the checkout transaction using:

`SELECT ... FOR UPDATE`

TypeORM implements this with:

`setLock('pessimistic_write')`

The lock remains active until the transaction commits or rolls back.

## Checkout Flow

1. Start transaction.
2. Load cart.
3. Sort cart items by SKU ID.
4. Lock inventory rows in deterministic order.
5. Calculate available quantity:
   `quantity - reservedQuantity`
6. Reject checkout with HTTP 409 if stock is insufficient.
7. Increase `reservedQuantity`.
8. Create an auditable inventory reservation.
9. Create order and order items.
10. Clear cart.
11. Commit transaction.

If any step fails, the transaction rolls back.

## Why Pessimistic Locking

Commerce inventory is a correctness-sensitive resource.

Preventing overselling is more important than allowing maximum concurrent writes to the same SKU.

Pessimistic locking gives straightforward database-enforced serialization for competing checkout operations.

## Tradeoffs

Advantages:

- Strong oversell protection.
- Simple reasoning model.
- PostgreSQL enforces concurrency.
- Works naturally with the existing checkout transaction.
- No application retry loop is required for normal version conflicts.

Disadvantages:

- Competing checkouts may wait for the same inventory row.
- Long transactions reduce throughput.
- Multiple inventory locks can create deadlock risk if acquired inconsistently.

## Deadlock Mitigation

Cart items are sorted by SKU ID before inventory rows are locked.

This gives concurrent transactions a consistent lock order and reduces deadlock risk.

Transactions must remain short.

External API calls must not be performed while inventory locks are held.

## Reservation Model

Inventory stores:

- `quantity`
- `reservedQuantity`

Available stock is:

`quantity - reservedQuantity`

Each reservation is also persisted in `inventory_reservations`.

A reservation records:

- inventory
- SKU
- order
- customer
- quantity
- status
- creation time
- release time

This makes reservation state auditable.

## Cancellation

When a pending order is cancelled:

1. Start transaction.
2. Find active reservations.
3. Lock corresponding inventory rows.
4. Decrease `reservedQuantity`.
5. Mark reservations as `RELEASED`.
6. Store `releasedAt`.
7. Mark the order `CANCELLED`.
8. Commit.

This prevents released stock from remaining unavailable.

## Reservation Expiry

Automatic reservation expiry is recognized as part of the design but is not implemented in Day 74.

A future background job can release stale reservations based on business/payment rules.

## Conflict Response

When available inventory is insufficient, checkout returns:

HTTP 409 Conflict

This communicates that the request was valid but could not be completed because inventory state changed.

## Testing

Concurrency tests deliberately reduce a SKU to one available unit and start two competing checkouts.

Expected result:

- exactly one checkout succeeds;
- exactly one checkout fails;
- reserved quantity never exceeds physical quantity;
- only one active reservation exists.

This proves the platform prevents overselling under the tested race condition.
