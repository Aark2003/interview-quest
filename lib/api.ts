/// <reference types="vite/client" />

const configuredBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : '';

export function apiUrl(path: string) {
  if (!configuredBase) return path;
  return `${configuredBase.replace(/\/$/, '')}${path}`;
}
