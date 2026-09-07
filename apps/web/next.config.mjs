import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' produce un bundle autocontenido para la imagen Docker.
  output: 'standalone',
  reactStrictMode: true,
  // Raíz del monorepo (evita que Next infiera un lockfile ajeno como raíz).
  outputFileTracingRoot: join(here, '../../'),
  // Compila los paquetes workspace (TS) del monorepo.
  transpilePackages: ['@crm/db', '@crm/core'],
  // Mantiene fuera del bundle deps nativas / de Node (se cargan en runtime).
  serverExternalPackages: ['pg', '@node-rs/argon2', '@react-pdf/renderer'],
};

export default nextConfig;
