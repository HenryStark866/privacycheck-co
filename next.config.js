/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14: paquetes que solo corren en el servidor (no se bundlean al cliente)
    serverComponentsExternalPackages: ['jspdf', 'jspdf-autotable', 'firebase-admin'],
  },
};

module.exports = nextConfig;
