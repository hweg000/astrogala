import type { APIRoute } from 'astro';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const guestName = (form.get('guestName') as string | null)?.trim();
    const caption = (form.get('caption') as string | null)?.trim() ?? '';

    if (!file || !guestName) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    // Validate type
    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato no permitido (usa JPG, PNG, MP4, MOV o WEBM)' }), { status: 400 });
    }

    // Validate size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Archivo demasiado grande (máx 50MB)' }), { status: 400 });
    }

    // Create uploads dir
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    // Save file
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Save metadata
    const dataDir = path.join(process.cwd(), 'data');
    if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
    const dataPath = path.join(dataDir, 'photos.json');
    let photos: any[] = [];
    if (existsSync(dataPath)) {
      const raw = await readFile(dataPath, 'utf-8');
      photos = JSON.parse(raw);
    }
    const entry = {
      id: randomUUID(),
      filename,
      url: `/uploads/${filename}`,
      guestName,
      caption,
      uploadedAt: new Date().toISOString(),
      approved: true, // cambiar a false si quieres moderación
    };
    photos.unshift(entry);
    await writeFile(dataPath, JSON.stringify(photos, null, 2));

    return new Response(JSON.stringify({ success: true, url: entry.url, id: entry.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[upload]', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
