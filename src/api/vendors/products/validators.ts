import { z } from "@medusajs/framework/zod"
import { AdminCreateProduct as BaseAdminCreateProductFactory } from "@medusajs/medusa/api/admin/products/validators"

// Use the base schema but preprocess to move custom stock_quantity into metadata so validation passes
const BaseAdminCreateProduct = BaseAdminCreateProductFactory()

export const AdminCreateProductWithReqQty = z.preprocess((val) => {
  if (typeof val !== "object" || val === null) return val
  const obj: any = { ...(val as any) }
  if (Array.isArray(obj.variants)) {
    obj.variants = obj.variants.map((v: any) => {
      if (v && typeof v === "object") {
        const { stock_quantity, required_quantity, metadata, ...rest } = v
        const newMeta = { ...(metadata ?? {}) }
        if (stock_quantity !== undefined) newMeta.stock_quantity = stock_quantity
        // keep required_quantity if present in metadata but strip from top-level variant
        if (required_quantity !== undefined) newMeta.required_quantity = required_quantity
        return Object.keys(newMeta).length ? { ...rest, metadata: newMeta } : rest
      }
      return v
    })
  }
  return obj
}, BaseAdminCreateProduct).superRefine((val, ctx) => {
  if (!val?.shipping_profile_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shipping_profile_id"],
      message: "shipping_profile_id is required",
    })
  }
})

export type AdminCreateProductWithReqQtyType = z.infer<typeof AdminCreateProductWithReqQty>
