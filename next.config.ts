import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

// Next reloads config in build workers. Inherit one ID from the parent process
// instead of generating a different ID for each prerender worker.
const readerBuildId = process.env.READER_BUILD_ID ||= randomUUID();

const nextConfig: NextConfig = {
  generateBuildId: async () => readerBuildId,
  env: { NEXT_PUBLIC_READER_BUILD_ID: readerBuildId },
};

export default nextConfig;
