import {once} from 'node:events'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {context, reddit} from '@devvit/web/server'
import type {
  PartialJsonValue,
  TriggerResponse,
  UiResponse,
} from '@devvit/web/shared'
import {
  Endpoint,
  EndpointMethod,
  type ErrorRsp,
  type GetSaveRsp,
  MAX_SAVE,
  type MeRsp,
  type PutSaveReq,
  type PutSaveRsp,
} from '../shared/api.ts'
import {dbGetSave, dbPutSave} from './db.ts'

const POST_TITLE = 'Spellstorm: duel the wizards of the storm'

type AnyRsp =
  | MeRsp
  | GetSaveRsp
  | PutSaveRsp
  | UiResponse
  | TriggerResponse
  | ErrorRsp

export async function onReq(
  reqMsg: IncomingMessage,
  rspMsg: ServerResponse,
): Promise<void> {
  try {
    await route(reqMsg, rspMsg)
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`
    console.error(msg)
    writeJson<ErrorRsp>(500, {error: msg, status: 500}, rspMsg)
  }
}

async function route(
  reqMsg: IncomingMessage,
  rspMsg: ServerResponse,
): Promise<void> {
  const endpoint = reqMsg.url?.slice(1) as Endpoint
  const method = EndpointMethod[endpoint]

  let rsp: AnyRsp
  if (method !== reqMsg.method) {
    rsp = {error: 'not found', status: 404}
  } else {
    switch (endpoint) {
      case Endpoint.Me:
        rsp = await routeMe()
        break
      case Endpoint.GetSave:
        rsp = await routeGetSave()
        break
      case Endpoint.PutSave:
        rsp = await routePutSave(reqMsg)
        break
      case Endpoint.OnMenuNewPost:
        rsp = await routeMenuNewPost()
        break
      case Endpoint.OnAppInstall:
        rsp = await routeAppInstall()
        break
      default:
        endpoint satisfies never
        rsp = {error: 'not found', status: 404}
        break
    }
  }

  writeJson<PartialJsonValue>('status' in rsp ? rsp.status : 200, rsp, rspMsg)
}

async function routeMe(): Promise<MeRsp> {
  const userId = context.userId
  if (!userId) return {}
  return {userId, username: context.username ?? undefined}
}

async function routeGetSave(): Promise<GetSaveRsp | ErrorRsp> {
  const userId = context.userId
  if (!userId) return {error: 'not logged in', status: 401}
  return {text: await dbGetSave(userId)}
}

async function routePutSave(reqMsg: IncomingMessage): Promise<PutSaveRsp | ErrorRsp> {
  const userId = context.userId
  if (!userId) return {error: 'not logged in', status: 401}
  const req = await readJson<PutSaveReq>(reqMsg)
  if (typeof req?.text !== 'string' || req.text.length > MAX_SAVE)
    return {error: 'bad save', status: 400}
  try {
    JSON.parse(req.text)
  } catch {
    return {error: 'bad save', status: 400}
  }
  await dbPutSave(userId, req.text)
  return {ok: true}
}

async function routeMenuNewPost(): Promise<UiResponse> {
  const post = await reddit.submitCustomPost({title: POST_TITLE})
  return {
    showToast: {text: `Post ${post.id} created.`, appearance: 'success'},
    navigateTo: post.url,
  }
}

async function routeAppInstall(): Promise<TriggerResponse> {
  await reddit.submitCustomPost({title: POST_TITLE})
  return {}
}

async function readJson<T>(reqMsg: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = []
  reqMsg.on('data', chunk => chunks.push(chunk))
  await once(reqMsg, 'end')
  return JSON.parse(`${Buffer.concat(chunks)}`)
}

function writeJson<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json)
  const len = Buffer.byteLength(body)
  rsp.writeHead(status, {
    'Content-Length': len,
    'Content-Type': 'application/json',
  })
  rsp.end(body)
}
