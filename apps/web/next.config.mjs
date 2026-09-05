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
  // Compila el paquete workspace (TS) del monorepo.
  transpilePackages: ['@travelkit/db'],
  // Mantiene fuera del bundle deps nativas / de Node (se cargan en runtime).
  serverExternalPackages: ['pg', '@node-rs/argon2'],
};

export default nextConfig;
