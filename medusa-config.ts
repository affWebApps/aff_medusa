import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { identifierToKeywordKind } from 'typescript'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || ''

module.exports = defineConfig({
  admin: {
    disable: process.env.NODE_ENV === 'production',
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "./src/modules/marketplace",
      /**
       * Pass vendor config here if needed later, e.g.
       * options: { defaultVendorId: "" }
       */
    },
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      // ...
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
            options: {
              // optional hash config
            },
          },
          {
            resolve: "./src/modules/aff-auth",
            id: "my-auth",
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          // other payment providers like stripe, paypal etc
          {
            resolve: "medusa-payment-paystack",
            options: {
              secret_key: paystackSecretKey,
            } satisfies import("medusa-payment-paystack").PluginOptions,
          },
        ],
      },
    },


  ],
})
