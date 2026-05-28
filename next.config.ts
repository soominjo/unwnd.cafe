import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  async headers() {
    const sharedSecurityHeaders = [
      { key: 'X-Content-Type-Options',    value: 'nosniff' },
      { key: 'X-Frame-Options',           value: 'DENY' },
      { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    ]

    // Restrictive CSP for all app routes — no unsafe-eval
    const appCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://cdn.sanity.io",
      "frame-src https://maps.google.com https://www.google.com",
      "connect-src 'self' https://*.sanity.io https://cdn.sanity.io",
      "media-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    // Permissive CSP scoped only to /studio — Sanity Studio requires unsafe-eval for GROQ tooling
    const studioCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://cdn.sanity.io https://lh3.googleusercontent.com",
      "frame-src https://maps.google.com https://www.google.com",
      "connect-src 'self' https://*.sanity.io https://cdn.sanity.io https://api.sanity.io wss://*.sanity.io",
      "media-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    return [
      {
        // All non-studio routes — restrictive CSP
        source: '/((?!studio).*)',
        headers: [
          ...sharedSecurityHeaders,
          { key: 'Content-Security-Policy', value: appCsp },
        ],
      },
      {
        // Sanity Studio — unsafe-eval required
        source: '/studio/(.*)',
        headers: [
          ...sharedSecurityHeaders,
          { key: 'Content-Security-Policy', value: studioCsp },
        ],
      },
      {
        // Static assets — immutable for 1 year
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public images — cache for 7 days
        source: '/(unwnd.*|favicon.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ]
  },
};

export default nextConfig;
