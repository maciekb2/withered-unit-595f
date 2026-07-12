export function isPrivateGeneratorRequest(request: Request): boolean {
  const expected = process.env.GENERATOR_PRIVATE_TOKEN;
  if (!expected) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-generator-private-token') === expected;
}
