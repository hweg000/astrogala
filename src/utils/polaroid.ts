export async function downloadPolaroid(imageUrl: string, guestName: string, caption: string) {
  // Solo para imágenes (video no soportado en canvas estático fácilmente)
  if (imageUrl.match(/\\.(mp4|webm|mov)$/i)) {
    alert("Todavía no podemos armar polaroids de videos, pero puedes descargarlo dejando presionado el video.");
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Tamaño de historia de instagram sugerido (1080x1920) pero haremos formato polaroid (1080 x 1350)
  canvas.width = 1080;
  canvas.height = 1350;

  // Fondo
  ctx.fillStyle = '#0f051e'; // Mismo fondo oscuro de la app
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    // Cargar imagen
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Dibujar borde polaroid (blanco con un poco de opacidad o tipo cristal)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(60, 60, 960, 1230);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, 960, 1230);

    // Calcular recorte para que la imagen sea cuadrada (1:1) o mantenga aspecto
    const size = 880; 
    const dx = 100, dy = 100;
    
    // Object-fit: cover en canvas
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = dx + (size - w) / 2;
    const y = dy + (size - h) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, size, size);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    // Textos
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    // Nombre
    ctx.font = 'bold 50px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(guestName || 'Invitado', canvas.width / 2, 1070);

    // Dedicatoria
    if (caption) {
      ctx.font = 'italic 36px Georgia, serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      
      // Word wrap manual simple
      const words = caption.split(' ');
      let line = '';
      let textY = 1140;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 800 && n > 0) {
          ctx.fillText('"' + line.trim() + '"', canvas.width / 2, textY);
          line = words[n] + ' ';
          textY += 40;
        } else {
          line = testLine;
        }
      }
      ctx.fillText('"' + line.trim() + '"', canvas.width / 2, textY);
    }

    // Branding AstroGala / Boda
    ctx.fillStyle = '#e11d48'; // Color rosa
    ctx.font = '30px sans-serif';
    ctx.fillText('AstroGala 2026', canvas.width / 2, 1240);

    // Convertir canvas a imagen y compartir
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      const file = new File([blob], `AstroGala-${guestName || 'Invitado'}.jpg`, { type: 'image/jpeg' });

      // Intentar usar la API nativa de compartir (Instagram/WhatsApp directo)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'AstroGala 2026',
            text: '¡Mira este recuerdo de la boda!'
          });
          return; // Si funcionó, terminamos aquí
        } catch (error) {
          console.log('El usuario canceló compartir o falló. Descargando en su lugar...', error);
        }
      }

      // Fallback: Descargar directo si no soporta compartir nativo
      const link = document.createElement('a');
      link.download = `Recuerdo-${guestName || 'Invitado'}.jpg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      
    }, 'image/jpeg', 0.9);

  } catch (e) {
    console.error(e);
    alert('Hubo un error generando la tarjeta.');
  }
}
