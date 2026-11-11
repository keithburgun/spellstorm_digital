/** Generic error detail for all responses. */
export type ErrorRsp = {error: string; status: number}

/** Who is playing. `userId` is absent for logged-out viewers (their progress stays in the browser). */
export type MeRsp = {userId?: string; username?: string}

/** The player's saved progress (the same JSON document the Steam version keeps in Steam Cloud). */
export type GetSaveRsp = {text: string | null}
export type PutSaveReq = {text: string}
export type PutSaveRsp = {ok: boolean}

export type Endpoint = (typeof Endpoint)[keyof typeof Endpoint]
export const Endpoint = {
  Me: 'api/me',
  GetSave: 'api/save',
  PutSave: 'api/save/put',
  OnAppInstall: 'internal/on/app/install',
  OnMenuNewPost: 'internal/on/menu/new-post',
} as const

export const EndpointMethod = {
  [Endpoint.Me]: 'GET',
  [Endpoint.GetSave]: 'GET',
  [Endpoint.PutSave]: 'POST',
  [Endpoint.OnAppInstall]: 'POST',
  [Endpoint.OnMenuNewPost]: 'POST',
} as const satisfies {[endpoint: string]: 'GET' | 'POST'}

/** Largest save we accept (characters). A heavy player's save is well under 1 MB. */
export const MAX_SAVE = 2_000_000
