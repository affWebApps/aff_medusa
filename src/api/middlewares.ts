import {
    authenticate,
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { PostVendorCreateSchema } from "./vendors/route"
import { z } from "@medusajs/framework/zod"
import { AdminCreateProduct } from "@medusajs/medusa/api/admin/products/validators"


// other imports...

export const GetVendorsSchema = z.object({
    vendor_id: z.string().optional(),
}).merge(createFindParams())

export default defineMiddlewares({
    routes: [
        // ...
        {
            matcher: "/vendors",
            method: ["POST"],
            middlewares: [
                authenticate("vendor", ["session", "bearer"], {
                    allowUnregistered: true,
                }),
                validateAndTransformBody(PostVendorCreateSchema),
            ],
        },
        {
            matcher: "/vendors/*",
            middlewares: [
                authenticate("vendor", ["session", "bearer"]),
            ],
        },
        {
            matcher: "/store/products-by-vendor",
            method: "GET",
            middlewares: [
                validateAndTransformQuery(
                    GetVendorsSchema,
                    {
                        defaults: [
                            "id",
                            "name",
                            "products.*",
                        ],
                        isList: true,
                    }
                ),
            ],
        },
        {
            matcher: "/vendors/products",
            method: ["POST"],
            middlewares: [
                validateAndTransformBody(AdminCreateProduct),
            ]
        },

    ],
})