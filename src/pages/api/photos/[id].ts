import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;
    if (!id) return new Response('Falta ID', { status: 400 });

    const dataPath = path.join(process.cwd(), 'data', 'photos.json');
    const raw = await readFile(dataPath, 'utf-8');
    const photos = JSON.parse(raw);

    const index = photos.findIndex((p: any) => p.id === id);
    if (index === -1) return new Response('Foto no encontrada', { status: 404 });

    const body = await request.json();
    
    // Si viene la accion de "like"
    if (body.action === 'like') {
      photos[index].likes = (photos[index].likes || 0) + 1;
    } 
    // Si viene un comentario
    else if (body.action === 'comment' && body.comment) {
      if (!photos[index].comments) photos[index].comments = [];
      photos[index].comments.push({
        text: body.comment.text,
        author: body.comment.author || 'Invitado',
        createdAt: new Date().toISOString()
      });
    }

    await writeFile(dataPath, JSON.stringify(photos, null, 2));

    return new Response(JSON.stringify(photos[index]), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response('Error interno', { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;
    if (!id) return new Response('Falta ID', { status: 400 });

    const auth = request.headers.get('Authorization');
    if (auth !== 'Bearer 2026') return new Response('No autorizado', { status: 401 });

    const dataPath = path.join(process.cwd(), 'data', 'photos.json');
    const raw = await readFile(dataPath, 'utf-8');
    let photos = JSON.parse(raw);

    photos = photos.filter((p: any) => p.id !== id);
    await writeFile(dataPath, JSON.stringify(photos, null, 2));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response('Error interno', { status: 500 });
  }
};
