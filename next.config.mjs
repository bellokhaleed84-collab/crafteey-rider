/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // firebase-admin pulls in jwks-rsa, which pulls in jose (ESM-only) —
  // this breaks Vercel's serverless require() bundling. The "jose"
  // override in package.json is the real fix; this is a harmless second
  // layer of defense. On Next.js 14.x this option lives under
  // `experimental` — `serverExternalPackages` as a top-level key is a
  // Next 15 option and gets silently ignored on 14.x.
  experimental: {
    serverComponentsExternalPackages: ["jwks-rsa", "jose"],
  },
};

export default nextConfig;
