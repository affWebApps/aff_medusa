import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// export const GET = async (req, res) => {
//   const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
//
//   const vendorId = req.query.vendor_id as string
//
//   const { data } = await query.graph({
//     entity: "vendor",
//     fields: ["id, thumbnail, title"],
//     filters: {
//       id: [vendorId],
//     },
//   })
//
//   const vendor = data[0]
//   res.json({ products: vendor?.products ?? [], message: "yam" })
// }

export const GET = async (req, res) => {
  const query = req.scope.resolve("query")

  const {
    data: products,
    metadata: { count, take, skip } = {},
  } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "vendor_id"],
    filters: { vendor_id: null },
    // your filters, e.g. by vendor_id
    ...req.queryConfig, // includes pagination + fields,
  })

  res.json({
    products,
    count,
    limit: take,
    offset: skip,
  })
}
