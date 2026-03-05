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
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import createVendorWorkflow from "../workflows/marketplace/create-vendor"
import { logger } from "@medusajs/framework/logger"


// other imports...

export const GetVendorsSchema = z.object({
    vendor_id: z.string().optional(),
}).merge(createFindParams())

export default defineMiddlewares({
    routes: [
        // Custom token auth from external BE (x-aff-token)
        {
            matcher: /^(\/vendors($|\/.*)|\/store\/.*)/,
            middlewares: [affTokenAuth],
        },
        // ...
        {
            matcher: "/vendors",
            method: ["POST"],
            middlewares: [
                affTokenAuth,
                validateAndTransformBody(PostVendorCreateSchema),
            ],
        },
        // {
        //     matcher: "/vendors/*",
        //     middlewares: [
        //         authenticate("vendor", ["session", "bearer"]),
        //     ],
        // },
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
                affTokenAuth,
                validateAndTransformBody(AdminCreateProduct),
            ]
        },
        {
            matcher: "/store/cart",
            method: ["GET", "POST"],
            middlewares: [
                affTokenAuth,
            ]
        },
        {
            matcher: "/store/auth-context",
            method: ["GET"],
            middlewares: [
                affTokenAuth,
            ]
        },

    ],
})

// Middleware to accept custom BE token instead of Medusa email/password
async function affTokenAuth(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
) {
    // Cast to any to set auth_context
    const reqAny = req as any
    console.log("Inside middleware")

    // If already authenticated and already has customer/vendor, skip. Otherwise proceed to hydrate.
    if (
        reqAny.auth_context?.auth_identity_id &&
        reqAny.auth_context?.customer_id &&
        reqAny.auth_context?.vendor_id
    ) {
        return next()
    }

    //send the users aff jwt auth token as x-aff-token on the request header 
    const token = req.headers["x-aff-token"] as string | undefined
    const beUrl = process.env.BACKEND_URL
    const beApiKey = process.env.BACKEND_API_KEY

    if (!token || !beUrl) {
        return next()
    }

    try {
        const response = await fetch(`${beUrl}/users/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
                ...(beApiKey ? { "x-api-key": beApiKey } : {}),
                Accept: "application/json",
            },
        })

        if (!response.ok) {
            return next()
        }

        const user = await response.json()
        // Prefer vendor_id from BE, fall back to user identifiers
        const actorId = user.vendor_id || user.id || user.user_id || user.email

        // Try to find an existing auth_identity via provider_identity entity_id = user.id
        let authIdentityId
        let existingProviderMetadata: Record<string, any> | undefined
        try {
            const query = req.scope.resolve("query")
            const { data: providerIdentities } = await query.graph({
                entity: "provider_identity",
                fields: ["auth_identity_id", "provider", "entity_id", "auth_identity.app_metadata"],
                filters: {
                    entity_id: [user.id ?? actorId],
                    provider: ["my-auth"],
                },
            })

            const match = providerIdentities?.[0]
            if (match?.auth_identity_id) {
                authIdentityId = match.auth_identity_id
                existingProviderMetadata = match.auth_identity.app_metadata as any
            }
        } catch (e) {
            // ignore lookup errors
        }

        reqAny.auth_context = {
            actor_id: actorId,
            auth_identity_id: authIdentityId,
            user_id: user.id ?? user.user_id,
            customer_id: existingProviderMetadata?.customer_id ?? user.customer_id,
            vendor_id: existingProviderMetadata?.vendor_id ?? user.vendor_id,
            email: user.email,
            app_metadata: user,
        }
    } catch (err) {
        // ignore errors and fall through
        logger.log(err)
    }

    return next()
}
