import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import VendorProductLink from "../../../links/vendor-product"


export const GET = async (req, res) => {
  // ...

  const query = req.scope.resolve("query")
  const vendorId = req.query.vendor_id as string


  const {
    data: productLinks,
    metadata: { take, skip, count } = {},
  } = await query.graph({
    // NOTE: use the link's entryPoint, not "product" or "post"
    entity: VendorProductLink.entryPoint,
    fields: [
      "*",          // fields on the link table (e.g. product_id, post_id, custom cols)
      "product.*",  // full linked product
      // full linked post
    ],
    // optional: filter to a specific post, analogous to filtering to a specific vendor
    filters: {
      vendor_id: vendorId,
    },
    pagination: {
      take: 10,  // how many linked rows (and thus products) to return
      skip: 0,  // how many to skip
    },
  })
  const products = productLinks.map((productLink) => { return productLink.product })
  console.log(products)

  const { data: productsWithPrices } = await query.graph({
    entity: "product",
    fields: [
      "*",
      "variants.*",
      "variants.prices.*",
    ],
    filters: {
      id: products?.map((p) => p?.id) as any,
    },
  })


  res.json(
    productsWithPrices,
  )
}

// export const GET = async (
//   req: MedusaRequest,
//   res: MedusaResponse
// ) => {
//   const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
//   const vendorId = req.query.vendor_id as string
//   console.log(req.queryConfig)

//   const { data: [vendor] } = await query.graph({
//     entity: "vendor",
//     fields: ["products.*"],
//     filters: {
//       id: [
//         // ID of the authenticated vendor admin
//         vendorId,
//       ],
//     },
//     pagination: {
//       take: 1, skip: 0, order: {
//         name: "DESC", // or "ASC"
//       }
//     },
//   })
//   console.log(vendor.products?.length)

//   const publishedProducts = vendor.products?.filter((product) => { return product?.status === 'published' })

//   const { data: productsWithPrices } = await query.graph({
//     entity: "product",
//     fields: [
//       "*",
//       "variants.*",
//       "variants.prices.*",
//     ],
//     filters: {
//       id: publishedProducts?.map((p) => p?.id) as any,
//     },
//   })


//   res.json(
//     productsWithPrices,
//   )
// }