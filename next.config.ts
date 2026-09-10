import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/grid", destination: "/timetable", permanent: false },
      { source: "/students/upload", destination: "/students", permanent: false },
    ];
  },
};

export default nextConfig;
