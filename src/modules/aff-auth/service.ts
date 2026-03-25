import { AbstractAuthModuleProvider } from "@medusajs/framework/utils"
import {
    AuthenticationInput,
    AuthenticationResponse,
    AuthIdentityProviderService,
    Logger,
} from "@medusajs/framework/types"

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
    constructor({ logger }: InjectedDependencies, options: Options) {
        // @ts-ignore upstream base signature
        super(...arguments)
        this.logger_ = logger
        this.options_ = options
    }

    async authenticate(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService
    ): Promise<AuthenticationResponse> {
        return this.handleAuth(data, authIdentityProviderService)
    }

    async validateCallback(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService
    ): Promise<AuthenticationResponse> {
        return this.handleAuth(data, authIdentityProviderService)
    }

    /**
     * Shared auth handler for both authenticate and validateCallback
     */
    private async handleAuth(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService
    ): Promise<AuthenticationResponse> {
        const beUser = await this.fetchBeUser(data)
        if (!beUser) {
            return { success: false, error: "Authentication failed" }
        }

        const externalId = (beUser as any).id || (beUser as any).user_id || (beUser as any).email
        if (!externalId) {
            return { success: false, error: "External user id missing" }
        }

        const entityId = String(externalId)

        const authIdentity = await this.upsertAuthIdentity(
            entityId,
            beUser,
            authIdentityProviderService
        )

        return { success: true, authIdentity }
    }

    private async fetchBeUser(data: AuthenticationInput): Promise<Record<string, unknown> | null> {
        const beUrl = process.env.BACKEND_URL
        if (!beUrl) {
            this.logger_?.error?.("BACKEND_URL env var is missing")
            return null
        }
        const response = await fetch(`${beUrl}/users/me`, {
            headers: {
                Authorization: `Bearer ${data.headers?.['x-aff-token'] ?? ""}`,
                "x-api-key": this.options_?.apiKey ?? "",
                Accept: "application/json",
            },
        })

        if (!response.ok) {
            this.logger_?.warn?.(`Custom BE auth failed with status ${response.status}`)
            return null
        }

        return response.json()
    }

    private async upsertAuthIdentity(
        entityId: string,
        beUser: Record<string, unknown>,
        authIdentityProviderService: AuthIdentityProviderService
    ) {
        try {
            return await authIdentityProviderService.retrieve({ entity_id: entityId })
        } catch (e) {
            return await authIdentityProviderService.create({
                entity_id: entityId,
                provider_metadata: {
                    external_user: beUser,
                },
                user_metadata: beUser,
            })
        }
    }
}
