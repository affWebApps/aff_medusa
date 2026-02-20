import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from "@medusajs/framework/http";
import {
  HttpTypes,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys
} from "@medusajs/framework/utils"
import createVendorProductWorkflow from "../../../workflows/marketplace/create-vendor-product";
import { logger } from "@medusajs/framework";
import VendorAdmin from "../../../modules/marketplace/models/vendor-admin";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [vendorAdmin] } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.*"],
    filters: {
      id: [
        // ID of the authenticated vendor admin
        req.auth_context.actor_id
      ],
    },
  })

  res.json({
    products: vendorAdmin.vendor.products
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProduct>,
  res: MedusaResponse
) => {
  console.log(req.auth_context.actor_id, "is the vendor_admin_id")
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