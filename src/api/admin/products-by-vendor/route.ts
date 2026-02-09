import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Filter } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/products-by-vendor?vendor_id=V123
 * Admin-authenticated endpoint that returns all products matching the given vendor_id.
 * Uses a raw query so we can filter on the custom column without extending Medusa's core types.
 */
// src/api/admin/vendor-products/route.ts
export const GET = async (req, res) => {
  const query = req.scope.resolve("query")

  const {
    data: products,
    metadata: { count, take, skip } = {},
  } = await query.graph({
    entity: "product",
    // your filters, e.g. by vendor_id
    ...req.queryConfig, // includes pagination + fields
  })

  res.json({
    products,
    count,
    limit: take,
    offset: skip,
  })
}
