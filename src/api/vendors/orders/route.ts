import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import VendorOrderLink from "../../../links/vendor-order"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [vendorAdmin] } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: {
      id: [req.auth_context.actor_id],
    },
  })

  if (!vendorAdmin?.vendor?.id) {
    return res.status(404).json({ message: "Vendor not found" })
  }

  const vendorId = vendorAdmin.vendor.id

  const {
    data: orderLinks,
    metadata: { take, skip, count } = {},
  } = await query.graph({
    entity: VendorOrderLink.entryPoint,
    fields: [
      "*",
      "order.*",
      "order.items.*",
      "order.shipping_address.*",
      "order.billing_address.*",
    ],
    filters: {
      vendor_id: vendorId,
    },
    pagination: {
      take: req.queryConfig.pagination.take,
      skip: req.queryConfig.pagination.skip,
    },
  })

  const orders = orderLinks.map((link) => link.order)

  res.json({
    orders,
    count,
    take,
    skip,
  })
}
