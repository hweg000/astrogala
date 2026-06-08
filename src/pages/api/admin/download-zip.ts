import type { APIRoute } from 'astro';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Readable } from 'stream';

export const GET: APIRoute = async ({ request }) => {
  // Check authorization
  const auth = request.headers.get('Authorization');
  if (auth !== 'Bearer 2026') {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'photos.json');
    if (!existsSync(dataPath)) {
      return new Response(JSON.stringify({ error: 'No hay fotos registradas.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const raw = await readFile(dataPath, 'utf-8');
    const photos = JSON.parse(raw);

    if (!Array.isArray(photos) || photos.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay fotos para descargar.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create zip archiver instance using the new class constructor from archiver v8
    const archive = new ZipArchive({ zlib: { level: 5 } });

    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('[archiver error]', err);
    });

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    // Add each file to the archive
    for (const photo of photos) {
      if (!photo.filename) continue;
      const filePath = path.join(uploadsDir, photo.filename);
      if (existsSync(filePath)) {
        // Sanitize the guest name to use as part of the filename in the ZIP
        const sanitizedGuest = (photo.guestName || 'Invitado')
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/[^a-zA-Z0-9-_]/g, '_'); // replace non-alphanumeric with underscore
        
        // Append guest name to ensure they are easy to search inside the ZIP
        const zipFileName = `${sanitizedGuest}_${photo.filename}`;
        
        archive.file(filePath, { name: zipFileName });
      }
    }

    // Finalize the archive (this will close the stream when done)
    // We don't await this synchronously before returning the response because it writes to the archive stream,
    // which is consumed asynchronously by the response body.
    archive.finalize();

    // Convert Node Readable stream to Web ReadableStream
    const webStream = Readable.toWeb(archive as any);

    return new Response(webStream as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="astrogala-fotos.zip"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (err: any) {
    console.error('[download-zip-error]', err);
    return new Response('Error interno del servidor al crear el ZIP', { status: 500 });
  }
};
