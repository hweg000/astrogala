export async function downloadPolaroid(imageUrl: string, guestName: string, caption: string) {
  // Only for images (video not easily supported in static canvas)
  if (imageUrl.match(/\.(mp4|webm|mov)$/i)) {
    alert("Todavía no podemos armar historias de videos, pero puedes descargarlo dejando presionado el video.");
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Instagram Story format (1080x1920)
  canvas.width = 1080;
  canvas.height = 1920;

  try {
    // Load image
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // 1. BLURRED BACKGROUND
    // Draw scaled up image
    const bgScale = Math.max(canvas.width / img.width, canvas.height / img.height);
    const bgW = img.width * bgScale;
    const bgH = img.height * bgScale;
    const bgX = (canvas.width - bgW) / 2;
    const bgY = (canvas.height - bgH) / 2;
    ctx.drawImage(img, bgX, bgY, bgW, bgH);

    // Overlay to darken and blur (vibrant aesthetic)
    ctx.fillStyle = 'rgba(15, 5, 30, 0.7)'; // Dark tint
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple canvas blur effect (if browser supports it)
    ctx.filter = 'blur(60px)';
    ctx.drawImage(img, bgX, bgY, bgW, bgH);
    ctx.filter = 'none';

    // 2. MAIN FLOATING CARD
    const cardW = 900;
    const cardH = 1200;
    const cardX = (canvas.width - cardW) / 2;
    const cardY = 300;

    // Glass effect for card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. THE IMAGE
    const imgSizeX = 800;
    const imgSizeY = 800;
    const imgX = (canvas.width - imgSizeX) / 2;
    const imgY = cardY + 50;

    // Draw main image with object-fit: cover feel
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgSizeX, imgSizeY, 24);
    ctx.clip();
    
    const scale = Math.max(imgSizeX / img.width, imgSizeY / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = imgX + (imgSizeX - w) / 2;
    const y = imgY + (imgSizeY - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    // 4. TEXTS
    ctx.textAlign = 'center';
    
    // Guest Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px serif'; // High-end look
    ctx.fillText(guestName || 'Invitado', canvas.width / 2, imgY + imgSizeY + 120);

    // Caption
    if (caption) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'italic 42px Georgia, serif';
      
      const words = caption.split(' ');
      let line = '';
      let textY = imgY + imgSizeY + 200;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 750 && n > 0) {
          ctx.fillText('"' + line.trim() + '"', canvas.width / 2, textY);
          line = words[n] + ' ';
          textY += 60;
        } else {
          line = testLine;
        }
      }
      ctx.fillText('"' + line.trim() + '"', canvas.width / 2, textY);
    }

    // Branding (Footer)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '32px sans-serif';
    ctx.fillText('AstroGala 2026', canvas.width / 2, 1800);

    // SHARE LOGIC
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `AstroGala-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Recuerdo de la Boda',
            text: 'Miren esta foto de la AstroGala ✨'
          });
          return;
        } catch (e) {}
      }

      // Fallback download
      const link = document.createElement('a');
      link.download = `Recuerdo-AstroGala.jpg`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }, 'image/jpeg', 0.95);

  } catch (e) {
    console.error(e);
    alert('Error al generar la tarjeta de historia.');
  }
}
