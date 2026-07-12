import { nodeGenerationEnv } from './nodeEnv';
import { requireCloudflareAccess } from '../utils/accessAuth';

export async function isPrivateGeneratorRequest(request: Request): Promise<boolean> {
  const expected = process.env.GENERATOR_PRIVATE_TOKEN;
  if (expected && request.headers.get('x-generator-private-token') === expected) return true;
  const env = nodeGenerationEnv();
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return process.env.NODE_ENV !== 'production';
  const result = await requireCloudflareAccess(request, env);
  return !result.response;
}
