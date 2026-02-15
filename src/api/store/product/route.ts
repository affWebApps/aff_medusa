import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

//get vendor details for a particular product

export const GET = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {

    const productId = req.query.product_id
    const query = req.scope.resolve("query")

    const { data: [product] } = await query.graph({
        entity: "product",
        fields: ["vendor.*"], // include linked vendor
        filters: {
            id: productId as string,           // the product you care about
        },
    })

    const vendorId = product.vendor?.id
    const vendorEmail = product.vendor?.handle

    res.json({
        vendorId,
        vendorEmail,
        vendorLogo: product.vendor?.logo
    })
}