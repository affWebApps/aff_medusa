import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import VendorProductLink from "../../../links/vendor-product"


export const GET = async (req, res) => {
  // ...

  const query = req.scope.resolve("query")
  const vendorParam = req.query.vendor_id as string
  if (!vendorParam) {
    return res.status(400).json({ message: "vendor_id is required" })
  }

  // Resolve the real vendor id from the vendor_admin record (if it exists)
  const { data: admins } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor_id", "vendor.id"],
    filters: { id: vendorParam },
  })

  const vendorId = admins?.[0]?.vendor_id || admins?.[0]?.vendor?.id || vendorParam


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
      take: req.queryConfig.pagination.take,  // how many linked rows (and thus products) to return
      skip: req.queryConfig.pagination.skip,  // how many to skip
    },
  })
  const products = productLinks.map((productLink) => { return productLink.product })
  const pagination = { take, skip, count }

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

  res.json({
    products: productsWithPrices,
    take,
    skip,
    count
  })
}
