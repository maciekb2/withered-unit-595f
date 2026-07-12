export const prerender = false;

export function GET() {
  return new Response(JSON.stringify({
    ok: true,
    service: "pseudointelekt",
    runtime: "node",
    time: new Date().toISOString(),
  }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
