/** @type {import('next').NextConfig} */
const nextConfig = {
  // En Next.js 14.2+ se usa serverExternalPackages (fuera de experimental)
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'firebase-admin'],
};

module.exports = nextConfig;
