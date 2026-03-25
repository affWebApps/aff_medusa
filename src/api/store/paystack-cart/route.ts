import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /store/paystack-cart?reference=REF123
// Resolves a cart id by matching the Paystack reference stored on a payment session.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const reference = req.query.reference as string | undefined

  if (!reference) {
    return res.status(400).json({ message: "reference is required" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: paymentCollections } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "cart.id", "payment_sessions.id", "payment_sessions.data"],
      filters: {
        payment_sessions: {
          data: {
            paystackTxRef: reference,
          },
        },
      },
    })

    const cartId = paymentCollections?.[0]?.cart?.id
    const sessionId = paymentCollections?.[0]?.payment_sessions?.[0]?.id

    if (!cartId) {
      return res.status(404).json({
        message: "No cart found for this transaction reference",
        reference,
      })
    }

    return res.json({
      reference,
      session_id: sessionId,
      cart_id: cartId,
    })
  } catch (err: any) {
    return res.status(500).json({
      message: "Failed to resolve cart from transaction reference",
      error: err?.message,
    })
  }
}
