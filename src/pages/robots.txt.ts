export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: https://pseudointelekt.pl/sitemap-index.xml`,
    {
      headers: {
        'Content-Type': 'text/plain',
      },
    },
  );
}
