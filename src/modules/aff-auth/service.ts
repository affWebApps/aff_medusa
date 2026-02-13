import { AbstractAuthModuleProvider } from "@medusajs/framework/utils"
import { AuthenticationInput, AuthenticationResponse, AuthIdentityProviderService, Logger } from "@medusajs/framework/types"
import { Client, ClientConfig } from "@medusajs/framework/pg"

type InjectedDependencies = {
    logger: Logger
}

type Options = {
    apiKey: string
}


export default class MyAuthProviderService extends AbstractAuthModuleProvider {
    static identifier = "my-auth"
    protected logger_: Logger
    protected options_: Options
    // assuming you're initializing a client
    protected client

    // constructor(
    //     { logger }: InjectedDependencies,
    //     options: Options
    // ) {
    //     super(...arguments)

    //     this.logger_ = logger
    //     this.options_ = options

    //     // assuming you're initializing a client
    //     this.client = new Client(options as ClientConfig)
    // }

    authenticate(data: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
        throw new Error("Method not implemented.")
    }
    async validateCallback(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService
    ): Promise<AuthenticationResponse> {
        let isAuthenticated = false
        let beUser: Record<string, unknown> | undefined
        console.log('authenticating.....')
        try {
            const beUrl = process.env.BE_URL
            if (!beUrl) {
                throw new Error("BE_URL env var is missing")
            }

            const response = await fetch(`${beUrl}/users/me`, {
                headers: {
                    Authorization: `Bearer ${data?.body?.token ?? ""}`,
                    "x-api-key": this.options_?.apiKey ?? "",
                    Accept: "application/json",
                },
            })

            if (response.ok) {
                beUser = await response.json()
                isAuthenticated = true
            } else {
                this.logger_?.warn?.(
                    `Custom BE auth failed with status ${response.status}`
                )
            }
        } catch (error) {
            this.logger_?.error?.("Error calling custom BE", error)
        }

        if (!isAuthenticated) {
            return {
                success: false,
                error: "Something went wrong",
            }
        }

        let authIdentity
        try {
            authIdentity = await authIdentityProviderService.retrieve({
                entity_id: data?.body?.email as string, // or your external user ID
            })
        } catch (e) {
            authIdentity = await authIdentityProviderService.create({
                entity_id: data?.body?.email as string,
                provider_metadata: {
                    // store provider‑specific data (tokens, ids, etc.)
                },
                user_metadata: {
                    // store user profile data from your custom BE
                },
            })
        }

        return {
            success: true,
            authIdentity,
        }
    }
}
