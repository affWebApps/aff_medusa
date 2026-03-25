import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const fields =
    req.queryConfig.fields?.filter(
      (field): field is string => typeof field === "string" && field.trim().length > 0
    ) ?? [
      "id",
      "order_id",
      "version",
      "amount",
      "currency_code",
      "reference",
      "reference_id",
      "metadata",
      "created_at",
      "updated_at",
    ]
  const authContext = (req as any).auth_context
  const email = authContext?.email || authContext?.app_metadata?.email

  if (!email) {
    return res.status(401).json({
      message: "Unable to resolve email from auth context",
    })
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: {
      email,
    },
  })

  const orderIds = orders?.map((order) => order.id).filter(Boolean) ?? []

  if (!orderIds.length) {
    return res.json({
      transactions: [],
      count: 0,
      take: req.queryConfig.pagination.take,
      skip: req.queryConfig.pagination.skip,
    })
  }

  const {
    data: transactions,
    metadata: { take, skip, count } = {},
  } = await query.graph({
    entity: "order_transaction",
    fields,
    filters: {
      order_id: orderIds,
    },
    pagination: {
      take: req.queryConfig.pagination.take,
      skip: req.queryConfig.pagination.skip,
    },
  })

  res.json({
    transactions,
    count,
    take,
    skip,
  })
}
