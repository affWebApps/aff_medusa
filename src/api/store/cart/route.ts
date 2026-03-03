import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
// import { createCartWorkflow } from "../../../workflows/create-cart"


export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const customerId = req.auth_context.app_metadata.customer_id
    let cart_id

    const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["id", "customer_id", "completed_at"],
        filters: {
            customer_id: customerId as string,
        },
    })

    if (carts.length && carts.length > 0) {
        const activeCart = carts.filter((cart) => cart.completed_at === null)[0]
        cart_id = activeCart?.id
    }
    if (!cart_id) {
        const { result } = await createCartWorkflow(req.scope).run({
            input: {
                customer_id: customerId as string,
            },
        })
        cart_id = result.id
    }
    return res.json({ cart_id })
}
