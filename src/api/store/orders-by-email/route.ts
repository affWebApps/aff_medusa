import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrdersListWorkflow } from "@medusajs/core-flows"
import type { OrderDTO } from "@medusajs/framework/types"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const authContext = (req as any).auth_context
  const email =
    authContext?.email ||
    authContext?.app_metadata?.email

  if (!email) {
    return res.status(401).json({
      message: "Unable to resolve email from auth context",
    })
  }

  const workflow = getOrdersListWorkflow(req.scope)
  const { result } = await workflow.run({
    input: {
      fields: req.queryConfig.fields,
      variables: {
        filters: { email },
        ...req.queryConfig.pagination,
      },
    },
  })

  const { rows: orders, metadata } = result as {
    rows: OrderDTO[]
    metadata: { count: number; take: number; skip: number }
  }

  res.json({
    orders,
    count: metadata.count,
    take: metadata.take,
    skip: metadata.skip,
  })
}
