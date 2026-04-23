import type { APIRoute } from 'astro';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const GET: APIRoute = async ({ request }) => {
  // Simple auth check
  const auth = request.headers.get('Authorization');
  if (auth !== 'Bearer 2026') {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'photos.json');
    if (!existsSync(dataPath)) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Return ALL photos unfiltered (admin sees everything)
    const raw = await readFile(dataPath, 'utf-8');
    const photos = JSON.parse(raw);
    // Sort newest first
    photos.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return new Response(JSON.stringify(photos), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
