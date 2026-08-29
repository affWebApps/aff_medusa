import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"
import { getVendorOwnedOrder } from "../utils"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { orderId } = await getVendorOwnedOrder(req)

  const { result: order } = await getOrderDetailWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      fields: req.queryConfig.fields,
    },
  })

  res.status(200).json({ order })
}
