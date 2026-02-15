import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const vendorId = req.query.vendor_id as string


  const { data: [vendor] } = await query.graph({
    entity: "vendor",
    fields: ["products.*"],
    filters: {
      id: [
        // ID of the authenticated vendor admin
        vendorId
      ],
    },
  })

  res.json({
    products: vendor.products,
    vendorId
  })
}