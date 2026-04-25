# aff_medusa — Claude Context

## Project Overview

A **Medusa v2** (v2.13.1) backend that extends the standard Medusa e-commerce platform with a multi-vendor marketplace. Vendors register and manage their own products; orders placed by customers are split into per-vendor sub-orders at checkout. Authentication is delegated to an external "aff" backend via a custom token bridge rather than Medusa's native email/password flow.

**Stack:** TypeScript · Medusa v2 · PostgreSQL · Redis · Paystack (payments)

---

## Repository Layout

```
src/
├── api/
│   ├── middlewares.ts               # Global middleware: affTokenAuth, body/query validators
│   ├── admin/
│   │   └── products-by-vendor/      # Admin: list products filtered by vendor
│   ├── hooks/
│   │   └── paystack/route.ts        # POST /hooks/paystack — Paystack webhook handler
│   ├── store/
│   │   ├── auth-context/route.ts    # GET  /store/auth-context — debug auth info
│   │   ├── cart/
│   │   │   ├── route.ts             # GET  /store/cart — find or create cart for customer
│   │   │   └── [id]/complete-vendor/route.ts  # POST — complete cart + split vendor orders
│   │   ├── order-transactions/route.ts  # GET /store/order-transactions
│   │   ├── orders-by-email/route.ts     # GET /store/orders-by-email
│   │   ├── paystack-cart/route.ts       # GET /store/paystack-cart?reference=
│   │   ├── paystack-verify/route.ts     # GET /store/paystack-verify?reference=
│   │   ├── product/route.ts             # GET /store/product?product_id= (vendor details)
│   │   └── products-by-vendor/route.ts  # GET /store/products-by-vendor?vendor_id=
│   └── vendors/
│       ├── route.ts                 # POST /vendors — create vendor
│       ├── products/
│       │   ├── route.ts             # GET/POST /vendors/products
│       │   ├── [id]/route.ts        # POST/DELETE /vendors/products/:id
│       │   └── validators.ts        # AdminCreateProductWithReqQty zod schema
│       └── [vendor_id]/products/route.ts  # GET /vendors/:vendor_id/products (public)
├── links/
│   ├── vendor-product.ts            # Remote link: vendor → product[]
│   └── vendor-order.ts              # Remote link: vendor → order[]
├── modules/
│   ├── aff-auth/                    # Custom Medusa auth provider (my-auth)
│   │   ├── index.ts
│   │   └── service.ts
│   └── marketplace/                 # Core custom module
│       ├── index.ts
│       ├── service.ts               # MedusaService wrapping Vendor + VendorAdmin
│       ├── migrations/
│       └── models/
│           ├── vendor.ts
│           └── vendor-admin.ts
├── scripts/
│   └── seed.ts                      # medusa exec seed: regions, shipping, products
└── workflows/
    ├── create-cart.ts
    └── marketplace/
        ├── create-vendor/           # Workflow: vendor + admin + auth metadata
        ├── create-vendor-product/   # Workflow: product + inventory + vendor link
        ├── create-vendor-orders/    # Workflow: complete cart, split per-vendor orders
        └── delete-vendor-admin/     # Workflow: delete admin + clear auth metadata
```

---

## Data Model

### Vendor
| Field    | Type         | Notes              |
|----------|--------------|--------------------|
| id       | string (PK)  | auto-generated     |
| handle   | text (unique)|                    |
| name     | text         |                    |
| logo     | text         | nullable           |
| admins   | VendorAdmin[]| hasMany            |

### VendorAdmin
| Field      | Type         | Notes              |
|------------|--------------|--------------------|
| id         | string (PK)  | auto-generated     |
| email      | text (unique)|                    |
| first_name | text         | nullable           |
| last_name  | text         | nullable           |
| vendor     | Vendor       | belongsTo          |

### Remote Links
- `vendor → product[]` — (`src/links/vendor-product.ts`) connects Marketplace module to Medusa's Product module
- `vendor → order[]` — (`src/links/vendor-order.ts`) connects Marketplace module to Medusa's Order module

---

## Authentication

**All `/vendors/*` and `/store/*` routes go through `affTokenAuth`** (defined in `src/api/middlewares.ts`).

Flow:
1. Client sends `x-aff-token: <jwt>` header
2. Middleware calls `BACKEND_URL/users/me` with the token
3. Resolves the `provider_identity` from the local Medusa DB (provider: `my-auth`)
4. Populates `req.auth_context`:
   - `actor_id` — vendor_id from BE user (or user id)
   - `auth_identity_id` — Medusa auth identity
   - `vendor_id`, `customer_id`, `email`
   - `app_metadata` — full user object from external BE

There is also a custom Medusa auth provider (`my-auth`) in `src/modules/aff-auth/service.ts` that wraps the same token bridge for Medusa's own auth module flow.

**Key rule:** Never replace `affTokenAuth` with Medusa's native `authenticate()` for vendor/store routes. The external backend is the source of truth for identity.

---

## Payment (Paystack)

Two Paystack providers are registered in `medusa-config.ts`:
- `paystack-live` — uses `PAYSTACK_SECRET_KEY`
- `paystack-test` — uses `PAYSTACK_TEST_SECRET_KEY`

The environment variable `CUSTOM_NODE_ENV` controls which key the webhook uses (if not `"production"`, uses test key).

**Webhook flow** (`POST /hooks/paystack`):
1. Verify HMAC-SHA512 signature (`x-paystack-signature` header)
2. Re-verify transaction with Paystack API
3. Call `paymentModuleService.authorizePaymentSession(sessionId, ...)`
4. Resolve cart from payment collection and call `completeCartWorkflow`

**Helper endpoints:**
- `GET /store/paystack-cart?reference=` — find cart_id from a Paystack transaction reference stored in payment session data (`paystackTxRef`)
- `GET /store/paystack-verify?reference=` — proxy verify to Paystack API (test key only)

---

## Key Workflows

### `create-vendor`
1. `createVendorStep` — creates Vendor record (with rollback)
2. `createVendorAdminStep` — creates VendorAdmin linked to vendor (with rollback)
3. `setAuthAppMetadataStep` — stores `vendorAdmin.id` in auth identity app_metadata
4. Returns vendor with admins via `useQueryGraphStep`

### `create-vendor-product`
1. Resolves store's `default_sales_channel_id` and `default_location_id`
2. Creates inventory items per variant — reads `stock_quantity` and `required_quantity` from `variant.metadata` (defaults: stock=100, required=1)
3. `createProductsWorkflow` — creates the product with inventory links and sales channel
4. `createRemoteLinkStep` — links vendor → product
5. Returns full product with variants

### `create-vendor-orders`
1. Fetches cart items
2. `acquireLockStep` on cart_id (timeout=2s, ttl=10s)
3. `completeCartWorkflow` — creates the parent order
4. Checks for existing vendor→order links (idempotency guard)
5. `groupVendorItemsStep` — groups items by vendor via product→vendor link
6. `createVendorOrdersStep`:
   - **Single vendor:** links parent order directly to vendor (no child order created)
   - **Multiple vendors:** creates a child `Order` per vendor inheriting shipping/address from parent, then stores vendor→order links
7. `releaseLockStep`
8. Compensation: cancels any created child orders on failure

---

## Environment Variables

| Variable                  | Required | Description                                      |
|---------------------------|----------|--------------------------------------------------|
| `DATABASE_URL`            | Yes      | PostgreSQL connection string                     |
| `REDIS_URL`               | Yes      | Redis connection string                          |
| `JWT_SECRET`              | Yes      | Medusa JWT secret                                |
| `COOKIE_SECRET`           | Yes      | Medusa cookie secret                             |
| `STORE_CORS`              | Yes      | Allowed store origins (comma-separated)          |
| `ADMIN_CORS`              | Yes      | Allowed admin origins (comma-separated)          |
| `AUTH_CORS`               | Yes      | Allowed auth origins (comma-separated)           |
| `BACKEND_URL`             | Yes      | External aff backend base URL (e.g. `http://localhost:8080/v1`) |
| `BACKEND_API_KEY`         | No       | Optional API key sent to external backend        |
| `PAYSTACK_SECRET_KEY`     | Yes      | Paystack live secret key                         |
| `PAYSTACK_TEST_SECRET_KEY`| Yes      | Paystack test secret key                         |
| `CUSTOM_NODE_ENV`         | No       | Set to `"production"` to use live Paystack key in webhook |

---

## Commands

```bash
npm run dev          # Start in development mode (with hot reload)
npm run build        # Build for production
npm run start        # Start production server
npm run seed         # Seed demo data (regions, shipping, products)

# Tests
npm run test:unit
npm run test:integration:http
npm run test:integration:modules
```

---

## Common Patterns

### Adding a new authenticated vendor route

```ts
// src/api/vendors/my-route/route.ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  // req.auth_context is always populated by affTokenAuth for /vendors/* routes
  const vendorAdminId = req.auth_context.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // ...
}
```

The middleware registration in `src/api/middlewares.ts` already covers all `/vendors/*` paths — no extra middleware needed unless you require body validation.

### Checking vendor ownership of a product

Use the helper pattern from `src/api/vendors/products/[id]/route.ts`: query `vendor_admin` to get `vendor.id`, then query the `VendorProductLink` entry point filtering on both `vendor_id` and `product_id`. Throw `MedusaError.Types.NOT_FOUND` if no match.

### Reading vendor from a product in a workflow

```ts
const { data: [product] } = await query.graph({
  entity: "product",
  fields: ["vendor.*"],
  filters: { id: productId },
})
const vendorId = product.vendor?.id
```

### Product creation requirements

- `shipping_profile_id` is **required** (enforced in `AdminCreateProductWithReqQty` validator)
- Pass `stock_quantity` and `required_quantity` as top-level variant fields — the validator preprocesses them into `variant.metadata` before Medusa sees them
- The workflow automatically links the product to the store's default sales channel and creates inventory items

---

## Known Quirks & Watch-outs

- **Admin panel is disabled in production** (`admin: { disable: process.env.NODE_ENV === 'production' }`)
- The `affTokenAuth` middleware is a no-op if `x-aff-token` or `BACKEND_URL` is missing — it silently passes through rather than blocking. This is intentional so public endpoints still work.
- `GET /store/cart` returns the first non-completed cart for a customer, or creates one. It does not support multiple active carts.
- In `createVendorOrdersStep`, if there's only one vendor in the cart, the parent order itself is linked — no child order is created. This avoids unnecessary order duplication for single-vendor checkouts.
- The `delete-vendor-admin` workflow expects the auth identity's `app_metadata` to have `vendor_id` set. If it's missing, the workflow throws `NOT_FOUND`.
- `CUSTOM_NODE_ENV` is checked separately from `NODE_ENV` in the Paystack webhook — both must equal `"production"` for the live key to be used.
- The `identifierToKeywordKind` import in `medusa-config.ts` is unused and can be removed.
