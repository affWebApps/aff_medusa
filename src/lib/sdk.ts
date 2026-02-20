import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
    baseUrl: process.env.BACKEND_URL || "/",
    debug: process.env.NODE_ENV !== "production",
    auth: {
        type: "jwt",
    },
})