import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  console.log("auth context", (req as any).auth_context)
  const authContext = (req as any).auth_context
  const email =
    authContext?.email ||
    authContext?.app_metadata?.email

  if (!email) {
    return res.status(401).json({
      message: "Unable to resolve email from auth context",
    })
  }

  const {
    data: orders,
    metadata: { take, skip, count } = {},
  } = await query.graph({
    entity: "order",
    fields: req.queryConfig.fields,
    filters: {
      email,
    },
    pagination: {
      take: req.queryConfig.pagination.take,
      skip: req.queryConfig.pagination.skip,
    },
  })

  res.json({
    orders,
    count,
    take,
    skip,
  })
}
