import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Lightweight helper endpoint so your external backend can
 * send `x-aff-token` and receive the hydrated identifiers
 * (vendor_id, customer_id, auth_identity_id, actor_id, email).
 *
 * The affTokenAuth middleware (configured in `src/api/middlewares.ts`)
 * runs before this route on `/store/*`, so `req.auth_context`
 * will already be populated when we get here.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx: any = req.auth_context || {}

  return res.json({
    actor_id: ctx.actor_id,
    auth_identity_id: ctx.auth_identity_id,
    vendor_id: ctx.vendor_id,
    customer_id: ctx.customer_id,
    email: ctx.email,
    app_metadata: ctx.app_metadata,
  })
}

