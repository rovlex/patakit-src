import { SIGNATURE_TEXT, type SignatureStyle } from "@/lib/signatures";

export const PIN_WIDTH = 0.3;

export type Box = { x: number; y: number; w: number; h: number };
export type BubbleKind = "speech" | "thought" | "text";

export const SPEECH_PATH =
  "M110 14C166 14 204 36 204 62C204 86 174 106 132 110C124 110 116 108 110 104L86 132L96 100C58 96 16 82 16 62C16 36 54 14 110 14Z";
export const THOUGHT_PATH =
  "M 110 26 Q 143.5 11.4 156.3 34.9 Q 194.9 36 180.9 57.4 Q 206.5 73.7 172.4 83 Q 173 106.9 134.6 99.7 Q 110 120 85.4 99.7 Q 47 106.9 47.6 83 Q 13.5 73.7 39.1 57.4 Q 25.1 36 63.7 34.9 Q 76.5 11.4 110 26 Z";

function paintBubble(
  ctx: CanvasRenderingContext2D,
  kind: BubbleKind,
  x: number,
  y: number,
  w: number,
  h: number,
  tailUp: boolean,
) {
  ctx.fillStyle = "#fffdf9";
  ctx.strokeStyle = "#3a2a22";
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.018);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (kind === "text") {
    roundRect(ctx, x, y, w, h, Math.min(22, h * 0.28));
    ctx.fill();
    ctx.stroke();
    return { textX: x + w * 0.08, textY: y, textW: w * 0.84, textH: h };
  }

  ctx.save();
  if (tailUp) {
    ctx.translate(x, y + h);
    ctx.scale(1, -1);
  } else {
    ctx.translate(x, y);
  }
  if (kind === "speech") {
    ctx.scale(w / 220, h / 150);
    const path = new Path2D(SPEECH_PATH);
    ctx.fill(path);
    ctx.stroke(path);
  } else {
    ctx.scale(w / 220, h / 168);
    const path = new Path2D(THOUGHT_PATH);
    ctx.fill(path);
    ctx.stroke(path);
    ctx.beginPath();
    ctx.arc(100, 140, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(90, 156, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  if (kind === "speech") {
    const bodyTop = tailUp ? y + h * 0.22 : y + h * 0.08;
    return { textX: x + w * 0.16, textY: bodyTop, textW: w * 0.68, textH: h * 0.5 };
  }
  const bodyTop = tailUp ? y + h * 0.22 : y + h * 0.08;
  return { textX: x + w * 0.2, textY: bodyTop, textW: w * 0.6, textH: h * 0.46 };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function boxOf(el: HTMLElement, stage: DOMRect, width: number, height: number): Box {
  const r = el.getBoundingClientRect();
  return {
    x: ((r.left - stage.left) / stage.width) * width,
    y: ((r.top - stage.top) / stage.height) * height,
    w: (r.width / stage.width) * width,
    h: (r.height / stage.height) * height,
  };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lumOf(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Place the sticker on the busiest part of the visible photo, not the empty middle. */
export function suggestPin(img: HTMLImageElement, stageW: number, stageH: number) {
  const fallback = { x: 0.62, y: 0.58 };
  if (!stageW || !stageH || !img.naturalWidth) return fallback;
  const scale = Math.max(stageW / img.naturalWidth, stageH / img.naturalHeight);
  const srcW = stageW / scale;
  const srcH = stageH / scale;
  const sx = (img.naturalWidth - srcW) / 2;
  const sy = (img.naturalHeight - srcH) / 2;
  const gw = 72;
  const gh = Math.max(1, Math.round((gw * stageH) / stageW));
  const canvas = document.createElement("canvas");
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, gw, gh);
  const data = ctx.getImageData(0, 0, gw, gh).data;
  let best = -1;
  let bx = gw * 0.62;
  let by = gh * 0.58;
  for (let y = 3; y < gh - 3; y++) {
    for (let x = 3; x < gw - 3; x++) {
      const i = (y * gw + x) * 4;
      const right = (y * gw + x + 1) * 4;
      const down = ((y + 1) * gw + x) * 4;
      const energy =
        Math.abs(data[i] - data[right]) +
        Math.abs(data[i + 1] - data[right + 1]) +
        Math.abs(data[i + 2] - data[right + 2]) +
        Math.abs(data[i] - data[down]) +
        Math.abs(data[i + 1] - data[down + 1]) +
        Math.abs(data[i + 2] - data[down + 2]);
      if (energy > best) {
        best = energy;
        bx = x;
        by = y;
      }
    }
  }
  if (best < 18) return fallback;
  return {
    x: clamp(bx / gw, 0.22, 0.78),
    y: clamp(by / gh, 0.28, 0.62),
  };
}

function toneUnder(ctx: CanvasRenderingContext2D, box: Box, width: number, height: number) {
  const x = clamp(Math.floor(box.x), 0, width - 1);
  const y = clamp(Math.floor(box.y + box.h * 0.62), 0, height - 1);
  const w = clamp(Math.ceil(box.w), 1, width - x);
  const h = clamp(Math.ceil(box.h * 0.38), 1, height - y);
  const data = ctx.getImageData(x, y, w, h).data;
  const count = w * h;
  let sum = 0;
  const lums = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const lum = lumOf(data[p], data[p + 1], data[p + 2]);
    lums[i] = lum;
    sum += lum;
  }
  const mean = sum / count;
  const sorted = Array.from(lums).sort((a, b) => a - b);
  const cut = sorted[Math.max(0, Math.floor(count * 0.22))] ?? mean;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let i = 0; i < count; i++) {
    if (lums[i] > cut + 0.02) continue;
    const p = i * 4;
    sr += data[p];
    sg += data[p + 1];
    sb += data[p + 2];
    n++;
  }
  if (!n) return { lum: mean, shadow: [40, 32, 28] as [number, number, number] };
  let r = sr / n;
  let g = sg / n;
  let b = sb / n;
  const shadowLum = lumOf(r, g, b);
  if (shadowLum > 0.45) {
    const keep = 0.55;
    r *= keep;
    g *= keep;
    b *= keep;
  }
  return {
    lum: mean,
    shadow: [Math.round(r), Math.round(g), Math.round(b)] as [number, number, number],
  };
}

function exposureFor(lum: number) {
  if (lum < 0.45) return 0.82 + (lum / 0.45) * 0.18;
  if (lum > 0.7) return 1 + ((lum - 0.7) / 0.3) * 0.1;
  return 1;
}

function prepareSticker(
  source: CanvasImageSource,
  width: number,
  height: number,
  exposure: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  const w = canvas.width;
  const h = canvas.height;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];

  const nearClear = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || alpha[ny * w + nx] < 24) return true;
      }
    }
    return false;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const a = alpha[i];
      if (a === 0) {
        d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0;
        continue;
      }
      if (a < 255) {
        const af = a / 255;
        d[p] = clamp((d[p] - 255 * (1 - af)) / af, 0, 255);
        d[p + 1] = clamp((d[p + 1] - 255 * (1 - af)) / af, 0, 255);
        d[p + 2] = clamp((d[p + 2] - 255 * (1 - af)) / af, 0, 255);
      }
      const minc = Math.min(d[p], d[p + 1], d[p + 2]);
      const maxc = Math.max(d[p], d[p + 1], d[p + 2]);
      if (minc > 214 && maxc - minc < 42 && (a < 250 || nearClear(x, y))) {
        const kill = Math.min(1, (minc - 214) / 41);
        d[p + 3] = Math.round(a * (1 - kill));
      }
      if (exposure !== 1 && d[p + 3] > 0) {
        d[p] = clamp(d[p] * exposure, 0, 255);
        d[p + 1] = clamp(d[p + 1] * exposure, 0, 255);
        d[p + 2] = clamp(d[p + 2] * exposure, 0, 255);
      }
    }
  }

  const srcA = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) srcA[i] = d[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let sum = srcA[i] * 2;
      let n = 2;
      if (x > 0) {
        sum += srcA[i - 1];
        n++;
      }
      if (x + 1 < w) {
        sum += srcA[i + 1];
        n++;
      }
      if (y > 0) {
        sum += srcA[i - w];
        n++;
      }
      if (y + 1 < h) {
        sum += srcA[i + w];
        n++;
      }
      d[i * 4 + 3] = Math.round(srcA[i] * 0.5 + (sum / n) * 0.5);
      if (d[i * 4 + 3] === 0) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function composePng(args: {
  stage: HTMLElement;
  shot: HTMLImageElement;
  photo: string | null;
  signatureEl: HTMLElement | null;
  signature: SignatureStyle | null;
  notes: Array<{ el: HTMLElement; kind: BubbleKind; text: string }>;
}): Promise<Blob> {
  await document.fonts.ready;
  if (args.signature) {
    await document.fonts.load(`48px "${args.signature.font}"`);
  }
  const stageRect = args.stage.getBoundingClientRect();
  const width = 1400;
  const height = Math.max(1, Math.round(width * (stageRect.height / stageRect.width)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#efe6da";
  ctx.fillRect(0, 0, width, height);

  if (args.photo) {
    const photo = await loadImage(args.photo);
    drawCover(ctx, photo, width, height);
  }

  const shot = boxOf(args.shot, stageRect, width, height);
  const portrait =
    args.shot.complete && args.shot.naturalWidth > 0
      ? args.shot
      : await loadImage(args.shot.currentSrc || "/character.png");

  const tone = toneUnder(ctx, shot, width, height);
  const sticker = prepareSticker(
    portrait,
    Math.round(shot.w),
    Math.round(shot.h),
    exposureFor(tone.lum),
  );
  const [sr, sg, sb] = tone.shadow;
  ctx.save();
  ctx.shadowColor = `rgba(${sr}, ${sg}, ${sb}, 0.28)`;
  ctx.shadowBlur = Math.max(3, shot.w * 0.035);
  ctx.shadowOffsetY = Math.max(2, shot.h * 0.012);
  ctx.shadowOffsetX = 0;
  ctx.drawImage(sticker, shot.x, shot.y, shot.w, shot.h);
  ctx.restore();

  if (args.signature && args.signatureEl) {
    const mark = boxOf(args.signatureEl, stageRect, width, height);
    const css = getComputedStyle(args.signatureEl);
    const fontSize = (parseFloat(css.fontSize) / stageRect.width) * width;
    ctx.save();
    ctx.translate(mark.x + mark.w / 2, mark.y + mark.h / 2);
    ctx.rotate((args.signature.slant * Math.PI) / 180);
    ctx.font = `400 ${fontSize}px "${args.signature.font}", cursive`;
    ctx.fillStyle = args.signature.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(SIGNATURE_TEXT, 0, 0);
    if (args.signature.line) {
      const textWidth = ctx.measureText(SIGNATURE_TEXT).width;
      ctx.strokeStyle = args.signature.ink;
      ctx.lineWidth = Math.max(1, fontSize * 0.045);
      ctx.beginPath();
      ctx.moveTo(-textWidth / 2, fontSize * 0.42);
      ctx.lineTo(textWidth / 2, fontSize * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const item of args.notes) {
    const text = item.text.trim();
    if (!text) continue;
    const note = boxOf(item.el, stageRect, width, height);
    const css = getComputedStyle(item.el);
    const fontSize = (parseFloat(css.fontSize) / stageRect.width) * width;
    const tailUp = note.y + note.h / 2 > shot.y + shot.h / 2;
    const area = paintBubble(ctx, item.kind, note.x, note.y, note.w, note.h, tailUp);

    ctx.save();
    ctx.font = `500 ${fontSize}px "Frank Ruhl Libre", Heebo, serif`;
    ctx.fillStyle = "#3a2a22";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapLines(ctx, text, Math.max(8, area.textW));
    const lineHeight = fontSize * 1.35;
    const block = lines.length * lineHeight;
    let lineY = area.textY + area.textH / 2 - block / 2 + lineHeight / 2;
    const lineX = area.textX + area.textW / 2;
    for (const line of lines) {
      ctx.fillText(line, lineX, lineY);
      lineY += lineHeight;
    }
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("blob");
  return blob;
}
