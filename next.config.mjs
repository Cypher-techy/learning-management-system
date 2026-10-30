/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default nextConfig;
