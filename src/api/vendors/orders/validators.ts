import { z } from "@medusajs/framework/zod"

const FulfillmentItem = z.object({
  id: z.string(),
  quantity: z.number(),
})

export const VendorCreateFulfillment = z.object({
  items: z.array(FulfillmentItem).min(1),
  location_id: z.string().nullish(),
  shipping_option_id: z.string().optional(),
  no_notification: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullish(),
})

const ShipmentLabel = z.object({
  tracking_number: z.string(),
  tracking_url: z.string().optional().default(""),
  label_url: z.string().optional().default(""),
})

export const VendorCreateShipment = z.object({
  items: z.array(FulfillmentItem).min(1),
  labels: z.array(ShipmentLabel).min(1),
  no_notification: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullish(),
})

export const VendorCancelFulfillment = z.object({
  no_notification: z.boolean().optional(),
})
