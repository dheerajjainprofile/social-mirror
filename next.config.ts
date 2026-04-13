import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 15.2+ requires explicit allow-listing of dev origins when the dev server
  // is accessed from a different origin than localhost (e.g. your Mac's LAN IP from
  // another device on the same Wi-Fi). Without this, HMR + RSC dev endpoints silently
  // reject cross-origin requests and client JS never fully hydrates — the page renders
  // from SSR HTML but React event listeners are never attached. Allow all local LAN
  // subnets so `next dev -H 0.0.0.0` works from iPhone / iPad / another laptop.
  allowedDevOrigins: [
    '*.local',
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ],
};

export default nextConfig;
