import {
    authenticate,
    defineMiddlewares,
    validateAndTransformBody,
    validateAndTransformQuery,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { PostVendorCreateSchema } from "./vendors/route"

// other imports...

export const GetVendorsSchema = createFindParams()

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

    ],
})