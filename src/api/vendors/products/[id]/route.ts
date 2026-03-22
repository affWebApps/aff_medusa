import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { HttpTypes } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import VendorProductLink from "../../../../links/vendor-product"

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProduct>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: vendorAdmins } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: {
      id: [req.auth_context.actor_id],
    },
  })

  const vendorId = vendorAdmins?.[0]?.vendor?.id
  if (!vendorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Vendor admin not found"
    )
  }

  const { data: productLinks } = await query.graph({
    entity: VendorProductLink.entryPoint,
    fields: ["product_id", "vendor_id"],
    filters: {
      vendor_id: vendorId,
      product_id: req.params.id,
    },
  })

  if (!productLinks?.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id "${req.params.id}" not found for this vendor`
    )
  }

  const { additional_data, ...update } = (req.validatedBody ?? {}) as any

  const { result } = await updateProductsWorkflow(req.scope).run({
    input: {
      selector: { id: req.params.id },
      update,
      additional_data,
    },
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "*",
      "variants.*",
      "variants.prices.*",
      "options.*",
      "tags.*",
      "type.*",
      "collection.*",
    ],
    filters: {
      id: [result[0].id],
    },
  })

  res.status(200).json({
    product: products[0],
  })
}

