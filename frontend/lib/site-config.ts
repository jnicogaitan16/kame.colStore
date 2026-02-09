export const siteConfig = {
  name: "Kame.col",
  location: "Bogotá, Colombia",

  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "",
  },

  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
  },
};
