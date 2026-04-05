import { createClient } from 'redis'

const redis = createClient({
  url: process.env.REDIS_URL,
})

export async function initRedis() {
  await redis.connect()
}

export async function isRedisReady(): Promise<boolean> {
  try {
    if (!redis.isOpen) {
      return false;
    }
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export { redis }
