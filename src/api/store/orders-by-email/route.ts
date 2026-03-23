import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const email = req.query.email as string

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

