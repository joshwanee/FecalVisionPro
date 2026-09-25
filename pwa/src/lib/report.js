/**
 * Builds one image summarising a result (the photo, the verdict, all four
 * scores, the date and the "not a diagnosis" line) so a farmer can send it to
 * a vet from the phone's share sheet. It is drawn on a canvas on this phone;
 * this app uploads nothing. Sharing simply hands the image to whichever app
 * the user picks.
 */

const W = 1080;
const H = 1560;
const PAD = 56;

/** Read a colour from the design tokens so the image matches the app. */
function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Split text into lines no wider than maxWidth (canvas has no auto-wrap). */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * record   : { verdict, uncertain, confidence, ranked:[{label, probability}],
 *              threshold, timestamp }
 * photoBlob : the photo that was analysed
 */
export async function renderReportCard(record, photoBlob) {
  // Make sure the app fonts are ready before drawing text with them.
  await Promise.all([
    document.fonts.load("700 40px 'Inter Variable'"),
    document.fonts.load("400 32px 'Inter Variable'"),
  ]);
  const display = "'Inter Variable', system-ui, sans-serif";
  const body = display;
  const bitmap = await createImageBitmap(photoBlob);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, W, H);

  // ---- header band -------------------------------------------------------
  ctx.fillStyle = token('--brand');
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = token('--ink-on-brand');
  ctx.textBaseline = 'middle';
  ctx.font = `700 46px ${display}`;
  ctx.fillText('FecalVision', PAD, 55);
  ctx.font = `700 28px ${body}`;
  ctx.textAlign = 'right';
  ctx.fillText(new Date(record.timestamp).toLocaleString(), W - PAD, 55);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ---- the photo that was analysed ---------------------------------------
  let y = 110 + PAD;
  const size = 480;
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  const dx = PAD + (size - dw) / 2;
  const dy = y + (size - dh) / 2;
  ctx.fillStyle = token('--camera');
  ctx.fillRect(PAD, y, size, size);
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  if (record.inputMode === 'square') {
    // Dim everything the model did not use, and outline the centre square.
    const side = Math.min(dw, dh);
    const sx = dx + (dw - side) / 2;
    const sy = dy + (dh - side) / 2;
    ctx.fillStyle = token('--dim');
    ctx.fillRect(dx, dy, sx - dx, dh);
    ctx.fillRect(sx + side, dy, dx + dw - sx - side, dh);
    ctx.fillRect(sx, dy, side, sy - dy);
    ctx.fillRect(sx, sy + side, side, dy + dh - sy - side);
    ctx.strokeStyle = token('--surface');
    ctx.lineWidth = 4;
    ctx.strokeRect(sx, sy, side, side);
  }
  ctx.strokeStyle = token('--line-strong');
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD, y, size, size);
  ctx.fillStyle = token('--ink-2');
  ctx.font = `700 24px ${body}`;
  ctx.fillText(
    record.inputMode === 'square' ? 'Photo analysed (outlined centre square used)' : 'Photo analysed (whole photo used)',
    PAD,
    y + size + 38,
  );

  // ---- verdict, to the right of the image --------------------------------
  const tx = PAD + size + 48;
  const tw = W - tx - PAD;
  ctx.fillStyle = token('--ink-2');
  ctx.font = `700 24px ${body}`;
  ctx.fillText(record.uncertain ? 'SCREENING RESULT' : 'SIGNS ASSOCIATED WITH', tx, y + 30);
  ctx.fillStyle = token('--ink');
  ctx.font = `700 52px ${display}`;
  const lines = wrapText(ctx, record.verdict, tw);
  lines.forEach((l, i) => ctx.fillText(l, tx, y + 100 + i * 60));
  let vy = y + 100 + lines.length * 60 + 20;
  ctx.font = `700 26px ${body}`;
  ctx.fillStyle = token('--ink-2');
  if (record.uncertain) {
    wrapText(ctx, `The app will not guess: the best match was under the ${(record.threshold * 100).toFixed(0)}% it requires.`, tw)
      .forEach((l, i) => ctx.fillText(l, tx, vy + 20 + i * 34));
  } else {
    ctx.fillStyle = token('--ink');
    ctx.font = `700 84px ${display}`;
    ctx.fillText(`${(record.confidence * 100).toFixed(0)}%`, tx, vy + 70);
    ctx.fillStyle = token('--ink-2');
    ctx.font = `700 26px ${body}`;
    ctx.fillText('confidence', tx, vy + 110);
  }

  // ---- all four scores ----------------------------------------------------
  y += size + 110;
  ctx.fillStyle = token('--ink');
  ctx.font = `700 34px ${display}`;
  ctx.fillText('All four scores', PAD, y);
  const barX = PAD + 360;
  const barW = W - barX - PAD - 130;
  const rowH = 70;
  const firstRow = y + rowH;
  record.ranked.forEach((r, i) => {
    const ry = firstRow + i * rowH;
    ctx.fillStyle = token('--ink');
    ctx.font = `700 30px ${body}`;
    ctx.fillText(r.label, PAD, ry);
    ctx.strokeStyle = token('--line-strong');
    ctx.lineWidth = 3;
    ctx.strokeRect(barX, ry - 28, barW, 34);
    ctx.fillRect(barX, ry - 28, Math.max(barW * r.probability, 3), 34);
    ctx.textAlign = 'right';
    ctx.fillText(`${(r.probability * 100).toFixed(1)}%`, W - PAD, ry);
    ctx.textAlign = 'left';
  });
  // Tick showing the confidence the app needs before it will report a result.
  ctx.fillStyle = token('--alert');
  ctx.fillRect(barX + barW * record.threshold - 2, firstRow - 36, 4, rowH * 3 + 48);
  ctx.fillStyle = token('--ink-2');
  ctx.font = `700 24px ${body}`;
  ctx.fillText(
    `Red line: ${(record.threshold * 100).toFixed(0)}% confidence needed to report a result.`,
    PAD,
    firstRow + rowH * 3 + 70,
  );

  // ---- not-a-diagnosis band ----------------------------------------------
  const bandY = H - 200;
  ctx.fillStyle = token('--alert');
  ctx.fillRect(0, bandY, W, 200);
  ctx.fillStyle = '#fff';
  ctx.font = `700 36px ${display}`;
  ctx.fillText('Screening aid, not a diagnosis.', PAD, bandY + 70);
  ctx.font = `700 28px ${body}`;
  wrapText(
    ctx,
    'Have a veterinarian confirm before treating birds. Analysed on the phone; the photo was not uploaded.',
    W - 2 * PAD,
  ).forEach((l, i) => ctx.fillText(l, PAD, bandY + 118 + i * 38));

  return canvas;
}

/**
 * Hand an image to the phone's share sheet (WhatsApp, email, Files...).
 * Where sharing files is unsupported (most desktops), save it instead.
 * Returns 'shared', 'saved' or 'cancelled'.
 */
export async function shareImage(blob, { filename, title, text }) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'; // user closed the sheet
      // Any other failure: fall through and save the file instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}
