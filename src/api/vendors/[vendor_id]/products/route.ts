import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import createVendorProductWorkflow from "../../../../workflows/marketplace/create-vendor-product"

// GET /vendors/:vendor_id/products?limit=10&offset=0
// Store route; requires x-publishable-api-key.
export const GET = async (req, res) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [vendor] } = await query.graph({
    entity: "vendor",
    fields: ["vendor.products.*"],
    filters: {
      id: [
        // ID of the authenticated vendor admin
        req.params.vendor_id,
      ],
    },
  })

  if (!vendor) {
    res.status(404).json({
      message: "Vendor not found",
    })
  }

  res.json({
    products: vendor.products,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProduct>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductWorkflow(req.scope)
    .run({
      input: {
        vendor_admin_id: req.auth_context.actor_id,
        product: req.validatedBody
      }
    })

  res.json({
    product: result.product
  })
}