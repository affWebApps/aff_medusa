import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderFulfillmentWorkflow, getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"
import { getVendorOwnedOrder, VENDOR_ORDER_DETAIL_FIELDS } from "../../../../utils"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { orderId } = await getVendorOwnedOrder(req)

  await cancelOrderFulfillmentWorkflow(req.scope).run({
    input: {
      ...(req.validatedBody as any),
      order_id: orderId,
      fulfillment_id: req.params.fulfillment_id,
      canceled_by: req.auth_context.actor_id,
    },
  })

  const { result: order } = await getOrderDetailWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      fields: VENDOR_ORDER_DETAIL_FIELDS,
    },
  })

  res.status(200).json({ order })
}
