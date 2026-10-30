/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async redirects() {
    // Legacy URLs from before the Tutor rename
    return [
      { source: "/instructors", destination: "/tutors", permanent: true },
      { source: "/instructors/:path*", destination: "/tutors/:path*", permanent: true },
      { source: "/auth/teacher", destination: "/auth/tutor", permanent: true },
      { source: "/dashboard/teacher", destination: "/dashboard/tutor", permanent: true },
      { source: "/dashboard/teacher/:path*", destination: "/dashboard/tutor/:path*", permanent: true },
      { source: "/dashboard/admin/teachers", destination: "/dashboard/admin/tutors", permanent: true },
    ];
  },
};
export default nextConfig;
