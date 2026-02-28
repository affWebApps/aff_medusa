import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// GET /store/paystack-verify?reference=REF123
// Verifies a Paystack transaction using the test secret key
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const reference = (req.query.reference as string) || (req.body as any)?.reference
  if (!reference) {
    return res.status(400).json({ message: "reference is required" })
  }

  const secretKey = process.env.PAYSTACK_TEST_SECRET_KEY
  if (!secretKey) {
    return res.status(500).json({ message: "PAYSTACK_TEST_SECRET_KEY is not configured" })
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}` , {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.json(data)
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to verify transaction", error: err?.message })
  }
}
