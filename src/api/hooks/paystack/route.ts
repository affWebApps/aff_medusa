import { createHmac } from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import createVendorOrdersWorkflow from "../../../workflows/marketplace/create-vendor-orders"


// Paystack webhook: set the endpoint URL in your Paystack dashboard to /hooks/paystack
// Expects Paystack signature in x-paystack-signature header.

const isNotProduction = (process.env.CUSTOM_NODE_ENV !== "production") || (process.env.NODE_ENV !== "production");

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body ?? {}) as any
  const secret = isNotProduction ? process.env.PAYSTACK_TEST_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return res.status(500).json({ message: "PAYSTACK_SECRET_KEY not configured" })
  }

  const signature = req.headers["x-paystack-signature"] as string | undefined
  const rawBody = JSON.stringify(body)

  if (!signature) {
    logger.log("no signature.....req header is", req.headers)
    return res.status(400).json({ message: "Missing signature" })
  }

  const computed = createHmac("sha512", secret).update(rawBody).digest("hex")
  if (computed !== signature) {
    logger.log("Invallid signature")
    return res.status(400).json({ message: "Invalid signature" })
  }

  const event = body?.event
  const reference = body?.data?.reference

  if (event !== "charge.success" || !reference) {
    return res.json({ received: true, ignored: true })
  }

  // Verify the transaction with Paystack
  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
    })

    const verifyJson = await verifyRes.json()

    if (!verifyRes.ok || verifyJson?.data?.status !== "success" || !verifyJson?.data?.paid_at) {
      return res.status(400).json({ message: "Verification failed", verify: verifyJson })
    }

    const sessionId = verifyJson?.data?.metadata?.session_id ?? body?.data?.metadata?.session_id

    if (!sessionId) {
      logger.log("Paystack webhook missing session id", { reference })
      return res.status(400).json({ message: "Missing session id" })
    }

    try {
      const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
      const payment = await paymentModuleService.authorizePaymentSession(sessionId, {
        paystack_reference: reference,
      })

      const query = req.scope.resolve("query")
      const { data: paymentCollections } = await query.graph({
        entity: "payment_collection",
        fields: [
          "cart.id",
          "payment_sessions.*",
        ],
        filters: {
          payment_sessions: {
            id: sessionId, // your session_id from the webhook
          }
        }
      })

      const cartId = paymentCollections[0]?.cart?.id

      let cartCompleted = false
      if (cartId) {
        try {
          await createVendorOrdersWorkflow(req.scope).run({
            input: {
              cart_id: cartId,
            },
          })
          cartCompleted = true
        } catch (err: any) {
          logger.error(
            `Error completing cart after paystack webhook (cartId=${cartId}): ${err?.message}\n${err?.stack}`
          )
        }
      }

      return res.json({ received: true, verified: true, payment, cart_completed: cartCompleted, cart_id: cartId })
    } catch (err: any) {
      logger.error("Error finalizing payment after paystack webhook", err)
      return res.status(500).json({ message: "Failed to mark payment paid", error: err?.message })
    }
  } catch (err: any) {
    logger.error("Error verifying paystack transaction", err)
    return res.status(500).json({ message: "Error verifying transaction", error: err?.message })
  }
}
