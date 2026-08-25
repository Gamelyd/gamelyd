import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Admins/hosts paste image URLs (game art, tournament icons, org logos)
    // from arbitrary hosts, so allow any HTTPS image source. Known CDNs are
    // listed first for clarity.
    remotePatterns: [
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**" },
    ],
    qualities: [75, 90],
  },
  serverExternalPackages: ["mongodb", "nodemailer", "bcryptjs"],
};

export default nextConfig;
