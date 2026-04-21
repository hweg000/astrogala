import type { APIRoute } from 'astro';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const GET: APIRoute = async () => {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'photos.json');
    if (!existsSync(dataPath)) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const raw = await readFile(dataPath, 'utf-8');
    const photos = JSON.parse(raw);
    const approved = photos.filter((p: any) => p.approved !== false);
    return new Response(JSON.stringify(approved), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
