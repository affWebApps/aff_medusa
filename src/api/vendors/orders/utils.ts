import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import VendorOrderLink from "../../../links/vendor-order"

export const VENDOR_ORDER_DETAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "currency_code",
  "total",
  "created_at",
  "updated_at",
  "items.*",
  "items.variant.*",
  "shipping_address.*",
  "billing_address.*",
  "shipping_methods.*",
  "fulfillments.items.*",
  "fulfillments.labels.*",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

export const getVendorOwnedOrder = async (req: AuthenticatedMedusaRequest) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [vendorAdmin] } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: {
      id: [req.auth_context.actor_id],
    },
  })

  const vendorId = vendorAdmin?.vendor?.id
  if (!vendorId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Vendor admin not found")
  }

  const orderId = req.params.id

  const { data: orderLinks } = await query.graph({
    entity: VendorOrderLink.entryPoint,
    fields: ["order_id", "vendor_id"],
    filters: {
      vendor_id: vendorId,
      order_id: orderId,
    },
  })

  if (!orderLinks?.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order with id "${orderId}" not found for this vendor`
    )
  }

  return { query, vendorId, orderId }
}
