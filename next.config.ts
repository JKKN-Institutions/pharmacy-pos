import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cache Components (PPR) disabled for admin dashboard — all data is user-specific/real-time.
  // Enable and add 'use cache' directives if caching is needed in future.
}

export default nextConfig
