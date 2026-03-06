import { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { 
  createWorkflow, 
  transform, 
  WorkflowResponse
} from "@medusajs/framework/workflows-sdk"
import { 
  createProductsWorkflow, 
  CreateProductsWorkflowInput, 
  createRemoteLinkStep, 
  useQueryGraphStep,
  createInventoryItemsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { Modules } from "@medusajs/framework/utils"

type WorkflowInput = {
  vendor_admin_id: string
  product: CreateProductWorkflowInputDTO
}

const createVendorProductWorkflow = createWorkflow(
  "create-vendor-product",
  (input: WorkflowInput) => {
    // Retrieve default sales channel to make the product available in.
    // Alternatively, you can link sales channels to vendors and allow vendors
    // to manage sales channels
    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["default_sales_channel_id", "default_location_id"],
    }).config({ name: "retrieve-stores" })
    const { data: locationsFallback } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id"],
      pagination: { take: 1 },
    }).config({ name: "retrieve-fallback-location" })

    // Create inventory items (with initial stock) for each incoming variant
    const inventoryItemsData = transform({ input, stores, locationsFallback }, (data) => {
      const locationId =
        data.stores?.[0]?.default_location_id ||
        data.locationsFallback?.[0]?.id

      if (!locationId) {
        return []
      }

      const items: any[] = []

      for (const variant of data.input.product.variants ?? []) {
        const meta = (variant as any).metadata || {}
        const stockQty = meta.stock_quantity ?? 100
        items.push({
          sku: variant.sku,
          title: `${data.input.product.title} - ${variant.title}`,
          requires_shipping: true,
          location_levels: [
            {
              location_id: locationId,
              stocked_quantity: stockQty, // use per-variant stock if provided
            },
          ],
        })
      }

      return items
    })

    const inventoryItems = createInventoryItemsWorkflow.runAsStep({
      input: { items: inventoryItemsData },
    })

    const productData = transform({
      input,
      stores,
      inventoryItems,
    }, (data) => {
      const variantsWithInventory = (data.input.product.variants ?? []).map(
        (variant, index) => {
          // default consume 1 inventory item per variant; required_quantity not user-facing now
          const reqQty = (variant as any).metadata?.required_quantity ?? 1
          return {
            ...variant,
            inventory_items: [
              {
                inventory_item_id: data.inventoryItems[index]?.id,
                required_quantity: reqQty,
              },
            ],
            manage_inventory: true,
          }
        }
      )

      return {
        products: [{
          ...data.input.product,
          variants: variantsWithInventory,
          sales_channels: [
            {
              id: data.stores[0].default_sales_channel_id
            }
          ]
        }]
      }
    })

    const createdProducts = createProductsWorkflow.runAsStep({
      input: productData as CreateProductsWorkflowInput
    })
    
    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: {
        id: input.vendor_admin_id
      }
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform({
      input,
      createdProducts,
      vendorAdmins
    }, (data) => {
      return data.createdProducts.map((product) => {
        return {
          [MARKETPLACE_MODULE]: {
            vendor_id: data.vendorAdmins[0].vendor.id
          },
          [Modules.PRODUCT]: {
            product_id: product.id
          }
        }
      })
    })

    createRemoteLinkStep(linksToCreate)
    
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["*", "variants.*"],
      filters: {
        id: createdProducts[0].id
      }
    }).config({ name: "retrieve-products" })

    return new WorkflowResponse({
      product: products[0]
    })
  }
)

export default createVendorProductWorkflow
