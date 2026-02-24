import {
    createWorkflow,
    WorkflowResponse,
    createStep,
    StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

type CreateCartInput = {
    customer_id: string
    currency_code?: string
}

const createCartStep = createStep(
    "create-cart",
    async ({ customer_id, currency_code = "usd" }: CreateCartInput, { container }) => {
        const cartModuleService = container.resolve(Modules.CART)

        const cart = await cartModuleService.createCarts({
            currency_code,
            customer_id,
            shipping_address: {
                address_1: "1512 Barataria Blvd",
                country_code: "us",
            },
        })

        return new StepResponse({ cart }, cart.id)
    },
    async (cartId, { container }) => {
        if (!cartId) {
            return
        }
        const cartModuleService = container.resolve(Modules.CART)

        await cartModuleService.deleteCarts([cartId])
    }
)

export const createCartWorkflow = createWorkflow(
    "create-cart-work",
    (input: CreateCartInput) => {
        const { cart } = createCartStep(input)

        return new WorkflowResponse({
            cart,
        })
    }
)
