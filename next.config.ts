import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cache Components (PPR) disabled for admin dashboard — all data is user-specific/real-time.
  // Enable and add 'use cache' directives if caching is needed in future.
  experimental: {
    serverActions: {
      // Increased for bulk import — stock batch imports can exceed the default 1 MB limit
      // (e.g. 9,000+ rows sent to prepareStockBatchImportAction at once).
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
