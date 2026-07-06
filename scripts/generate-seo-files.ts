// Generates sitemap.xml and robots.txt at build time
// Run: bun run scripts/generate-seo-files.ts

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenetpg.com';

const publicRoutes = ['/', '/#features', '/#about', '/#contact'];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes.map((route) => `  <url><loc>${BASE_URL}${route}</loc><changefreq>monthly</changefreq><priority>${route === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;

await Bun.write('apps/web/public/sitemap.xml', sitemap);

const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /dashboard
Disallow: /settings
Disallow: /tenants
Disallow: /rooms
Disallow: /floors
Disallow: /payments
Disallow: /invoices
Disallow: /electricity
Disallow: /complaints
Disallow: /enquiries
Disallow: /meals
Disallow: /menus
Disallow: /services
Disallow: /notifications
Disallow: /notices
Disallow: /visitors
Disallow: /guardians
Disallow: /assets
Disallow: /leaves
Disallow: /attendance

Sitemap: ${BASE_URL}/sitemap.xml
`;

await Bun.write('apps/web/public/robots.txt', robots);

console.log('SEO files generated successfully');
