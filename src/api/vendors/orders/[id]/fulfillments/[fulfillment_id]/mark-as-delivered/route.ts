import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrderDetailWorkflow, markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import { getVendorOwnedOrder, VENDOR_ORDER_DETAIL_FIELDS } from "../../../../utils"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { orderId } = await getVendorOwnedOrder(req)

  await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
    input: {
      orderId,
      fulfillmentId: req.params.fulfillment_id,
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
