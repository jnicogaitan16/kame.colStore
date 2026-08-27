import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kamecol.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/producto/", "/catalogo", "/categoria/"],
        disallow: ["/admin/", "/api/", "/checkout/", "/health"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
