# Multi-Vendor Commerce Platform — Architecture

## 1. High-Level Architecture

The platform uses three main layers:

Customer / Vendor / Admin
|
v
Next.js Web
|
REST API
|
v
NestJS API
|
v
PostgreSQL

## 2. Frontend — Next.js

Next.js provides the web interfaces.

Main surfaces:

### Storefront

Used by customers to:

- Browse products
- View product details
- Manage cart
- Checkout

### Customer Account

Used by customers to:

- View orders
- Track order status
- Manage account information
- Request cancellation/return/refund when allowed

### Vendor Dashboard

Used by vendors to:

- Manage products
- Manage inventory
- View their orders
- Manage fulfillment

### Admin Dashboard

Used by admins to:

- Manage marketplace data
- Manage vendors/users
- Monitor orders
- Monitor payments/refunds
- View audit information

## 3. Backend — NestJS

The backend will be a modular monolith.

Modules:

### Auth

Responsibilities:

- Authentication
- User identity
- Roles and permissions

### Catalog

Responsibilities:

- Products
- Product information
- Product browsing data

### Inventory

Responsibilities:

- Stock quantities
- Inventory availability
- Inventory reservation

### Cart

Responsibilities:

- Customer cart
- Cart items
- Cart calculations

### Orders

Responsibilities:

- Order creation
- Order state
- Vendor order splitting

### Payments

Responsibilities:

- COD / advance payment
- Payment status
- Payment callbacks

### Fulfillment

Responsibilities:

- Order processing
- Shipment/fulfillment status

### Refunds

Responsibilities:

- Cancellation
- Return
- Refund workflows

### Notifications

Responsibilities:

- Order notifications
- Payment notifications
- Other business notifications

### Audit

Responsibilities:

- Record important business/system actions
- Provide traceability

## 4. Database — PostgreSQL

PostgreSQL stores persistent business data.

Examples:

- Users
- Vendors
- Products
- Inventory
- Carts
- Orders
- Vendor orders
- Payments
- Refunds
- Fulfillment/shipment information
- Audit records

## 5. Request Flow

Example: customer places an order.

Next.js
|
| POST /orders
v
Orders Module
|
+--> Cart
|
+--> Inventory
|
+--> Order creation
|
v
PostgreSQL

Later modules such as Payments, Fulfillment,
Notifications and Audit participate in the order lifecycle.

## 6. Architecture Decision

We will start with a modular monolith instead of microservices.

The application is deployed as one backend application, but business
responsibilities are separated into clear NestJS modules.

This keeps the first version simpler while maintaining clear boundaries
between business domains.
