/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' produce un bundle autocontenido para la imagen Docker.
  output: 'standalone',
  reactStrictMode: true,
  // Compila el paquete workspace (TS) del monorepo.
  transpilePackages: ['@travelkit/db'],
  // Mantiene fuera del bundle deps nativas / de Node (se cargan en runtime).
  serverExternalPackages: ['pg', '@node-rs/argon2'],
};

export default nextConfig;
