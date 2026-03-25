import {
    AuthenticatedMedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import createVendorWorkflow, {
    CreateVendorWorkflowInput,
} from "../../workflows/marketplace/create-vendor"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"


export const PostVendorCreateSchema = z.object({
    name: z.string(),
    handle: z.string().optional(),
    logo: z.string().optional(),
    admin: z.object({
        email: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
    }).strict(),
}).strict()

type RequestBody = z.infer<typeof PostVendorCreateSchema>

export const POST = async (
    req: AuthenticatedMedusaRequest<RequestBody>,
    res: MedusaResponse
) => {
    // If a vendor is already linked to this auth context, prevent duplicate creation
    if (req.auth_context?.user_metadata?.vendor_id) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Vendor already exists for this account."
        )
    }

    const vendorData = req.validatedBody
    const authIdentityId = req.auth_context?.auth_identity_id

    if (!authIdentityId) {
        throw new MedusaError(
            MedusaError.Types.UNAUTHORIZED,
            "Authentication required to create a vendor."
        )
    }

    // Ensure a customer exists for this admin email (idempotent by email)
    let customer
    try {
        const { result: customerResult } = await createCustomerAccountWorkflow(req.scope).run({
            input: {
                authIdentityId,      // your existing auth_identity ID, e.g. "au_1234"
                customerData: {      // CreateCustomerDTO
                    email: vendorData.admin.email,
                    first_name: vendorData.admin.first_name,
                    last_name: vendorData.admin.last_name,
                    // phone, company_name, metadata, etc. if needed
                },
            },
        })
        customer = customerResult
    }
    catch (e) {
        // proceed even if customer creation fails; vendor creation may still succeed
    }

    // create vendor admin
    const { result } = await createVendorWorkflow(req.scope)
        .run({
            input: {
                ...vendorData,
                authIdentityId,
            } as CreateVendorWorkflowInput,
        })

    res.json({
        vendor: result.vendor,
        customer,
    })
}
