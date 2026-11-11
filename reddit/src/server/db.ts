import {redis} from '@devvit/web/server'

const saveKey = (userId: string): string => `save:${userId}`

export async function dbGetSave(userId: string): Promise<string | null> {
  return (await redis.get(saveKey(userId))) ?? null
}

export async function dbPutSave(userId: string, text: string): Promise<void> {
  await redis.set(saveKey(userId), text)
}
