// Canvas-drawn placeholder covers, spines and pages, one style per theme.
import type { Book } from "../data/books";
import type { Theme } from "../themes/types";
import { shade } from "../themes/art";

type Ctx = CanvasRenderingContext2D;

export const COVER_W = 512;
export const COVER_H = 732;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function wrap(ctx: Ctx, text: string, maxW: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx: Ctx, text: string, font: (size: number) => string, maxW: number, start: number, maxLines: number) {
  let size = start;
  let lines: string[] = [];
  for (; size > 18; size -= 2) {
    ctx.font = font(size);
    lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  return { size, lines };
}

function noise(ctx: Ctx, w: number, h: number, alpha: number, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

function centered(ctx: Ctx, lines: string[], cx: number, y: number, lh: number) {
  ctx.textAlign = "center";
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

function seedOf(book: Book) {
  return [...book.id].reduce((a, c) => a + c.charCodeAt(0), 7);
}

export function drawCover(ctx: Ctx, book: Book, theme: Theme, W = COVER_W, H = COVER_H) {
  const disp = theme.fonts.display;
  const body = theme.fonts.body;
  const base = book.color;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  switch (theme.book3d.coverStyle) {
    case "japanese": {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      noise(ctx, W, H, 0.05, seedOf(book));
      // stitched binding on the spine side
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, 34, H);
      ctx.strokeStyle = "#efe2c4";
      ctx.lineWidth = 3;
      [0.12, 0.37, 0.63, 0.88].forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(0, H * p);
        ctx.lineTo(22, H * p);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(22, H * p, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#efe2c4";
        ctx.fill();
      });
      // sun disc
      ctx.fillStyle = "rgba(196,81,58,.9)";
      ctx.beginPath();
      ctx.arc(W * 0.6, H * 0.64, 92, 0, Math.PI * 2);
      ctx.fill();
      // paper title slip
      ctx.fillStyle = "#f4ead6";
      ctx.fillRect(W * 0.2, 60, W * 0.68, 230);
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.strokeRect(W * 0.2 + 8, 68, W * 0.68 - 16, 214);
      ctx.fillStyle = "#2a1d15";
      const t = fitText(ctx, book.title, (s) => `700 ${s}px ${disp}`, W * 0.6, 48, 3);
      centered(ctx, t.lines, W * 0.54, 60 + 115 - ((t.lines.length - 1) * t.size * 1.1) / 2, t.size * 1.1);
      ctx.font = `500 22px ${body}`;
      ctx.fillStyle = "#5a3d27";
      ctx.fillText(book.author, W * 0.54, 268);
      ctx.fillStyle = "#f4ead6";
      ctx.font = `700 34px ${disp}`;
      ctx.fillText("文庫", W * 0.6, H * 0.64 + 12);
      break;
    }
    case "chinese": {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      noise(ctx, W, H, 0.06, seedOf(book));
      // thread binding
      ctx.strokeStyle = "#e9dcc0";
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const y = 70 + i * ((H - 140) / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(30, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(30, 60);
      ctx.lineTo(30, H - 60);
      ctx.stroke();
      // label slip
      ctx.fillStyle = "#efe6d2";
      ctx.fillRect(W - 170, 50, 120, 420);
      ctx.strokeStyle = "#9e2a2b";
      ctx.lineWidth = 2;
      ctx.strokeRect(W - 162, 58, 104, 404);
      ctx.save();
      ctx.translate(W - 110, 260);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#2b2a28";
      const t = fitText(ctx, book.title, (s) => `600 ${s}px ${disp}`, 380, 46, 2);
      centered(ctx, t.lines, 0, -((t.lines.length - 1) * t.size) / 2 + t.size * 0.35, t.size);
      ctx.restore();
      ctx.fillStyle = "#efe6d2";
      ctx.font = `400 26px ${body}`;
      ctx.textAlign = "left";
      ctx.fillText(book.author, 70, H - 70);
      // seal
      ctx.fillStyle = "#b5302e";
      ctx.fillRect(70, H - 200, 90, 90);
      ctx.fillStyle = "#f4e7d0";
      ctx.font = `700 54px ${disp}`;
      ctx.textAlign = "center";
      ctx.fillText("書", 115, H - 136);
      break;
    }
    case "vedic": {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, shade(base, 0.15));
      g.addColorStop(1, shade(base, -0.3));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      noise(ctx, W, H, 0.05, seedOf(book));
      ctx.strokeStyle = "#d9a944";
      ctx.lineWidth = 6;
      ctx.strokeRect(22, 22, W - 44, H - 44);
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 36, W - 72, H - 72);
      // dotted border
      ctx.fillStyle = "#d9a944";
      for (let x = 50; x < W - 40; x += 18) {
        ctx.beginPath(); ctx.arc(x, 50, 3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x, H - 50, 3, 0, 7); ctx.fill();
      }
      // lotus mandala
      ctx.save();
      ctx.translate(W / 2, H * 0.6);
      for (let ring = 0; ring < 3; ring++) {
        const n = 8 + ring * 4;
        const r = 40 + ring * 34;
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * Math.PI * 2 + ring * 0.2);
          ctx.beginPath();
          ctx.ellipse(0, -r, 12 + ring * 2, 26 + ring * 4, 0, 0, Math.PI * 2);
          ctx.strokeStyle = ring === 1 ? "#f2d27a" : "#d9a944";
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.fillStyle = "#f2d27a";
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#f7e6c0";
      const t = fitText(ctx, book.title, (s) => `${s}px ${disp}`, W - 120, 52, 3);
      centered(ctx, t.lines, W / 2, 140, t.size * 1.15);
      ctx.font = `400 24px ${body}`;
      ctx.fillStyle = "#f2d27a";
      ctx.fillText(book.author, W / 2, 140 + t.lines.length * t.size * 1.15 + 6);
      ctx.font = `30px ${body}`;
      ctx.fillText("ग्रन्थ", W / 2, H - 76);
      break;
    }
    case "space": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, shade(base, -0.75));
      g.addColorStop(1, "#05040d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      let st = seedOf(book);
      const r = () => ((st = (st * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.6 + 0.3, 0, 7); ctx.fill();
      }
      // black hole: glow, tilted accretion disk, shadow, photon ring
      ctx.save();
      ctx.translate(W / 2, H * 0.6);
      const halo = ctx.createRadialGradient(0, 0, 40, 0, 0, 220);
      halo.addColorStop(0, "rgba(255,160,80,.55)");
      halo.addColorStop(1, "rgba(255,120,60,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 220, 0, 7); ctx.fill();
      const disk = ctx.createLinearGradient(-200, 0, 200, 0);
      disk.addColorStop(0, "rgba(255,90,40,0)");
      disk.addColorStop(0.3, "#ff8a3a");
      disk.addColorStop(0.5, "#fff2c8");
      disk.addColorStop(0.7, "#ff8a3a");
      disk.addColorStop(1, "rgba(255,90,40,0)");
      ctx.strokeStyle = disk;
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.ellipse(0, 0, 200, 34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, 56, 0, 7); ctx.fill();
      ctx.strokeStyle = "#ffe2a8";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.stroke();
      ctx.strokeStyle = disk;
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.ellipse(0, 0, 200, 34, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#e8ecff";
      const t = fitText(ctx, book.title.toUpperCase(), (s) => `700 ${s}px ${disp}`, W - 100, 40, 3);
      centered(ctx, t.lines, W / 2, 110, t.size * 1.2);
      ctx.fillStyle = "#5fd0ff";
      ctx.fillRect(W / 2 - 40, 130 + t.lines.length * t.size * 1.2 - t.size, 80, 3);
      ctx.font = `500 22px ${body}`;
      ctx.fillStyle = "#9aa3c7";
      ctx.fillText(book.author.toUpperCase(), W / 2, H - 60);
      break;
    }
    case "fantasy": {
      const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7);
      g.addColorStop(0, shade(base, 0.1));
      g.addColorStop(1, shade(base, -0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      noise(ctx, W, H, 0.06, seedOf(book));
      ctx.strokeStyle = "#e3b75a";
      ctx.lineWidth = 5;
      ctx.strokeRect(26, 26, W - 52, H - 52);
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, W - 80, H - 80);
      [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fillStyle = "#e3b75a"; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fillStyle = "#7fe3ff"; ctx.fill();
      });
      // rune circle
      ctx.save();
      ctx.translate(W / 2, H * 0.62);
      ctx.strokeStyle = "#e3b75a";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 110, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 86, 0, 7); ctx.stroke();
      ctx.font = `20px ${disp}`;
      ctx.fillStyle = "#e3b75a";
      ctx.textAlign = "center";
      const runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ";
      for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((i / 12) * Math.PI * 2);
        ctx.fillText(runes[i], 0, -92);
        ctx.restore();
      }
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -86); ctx.lineTo(0, 86); ctx.stroke();
      }
      const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
      gg.addColorStop(0, "#e9fbff");
      gg.addColorStop(0.4, "#7fe3ff");
      gg.addColorStop(1, "rgba(127,227,255,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#f1d48a";
      const t = fitText(ctx, book.title, (s) => `700 ${s}px ${disp}`, W - 120, 48, 3);
      centered(ctx, t.lines, W / 2, 130, t.size * 1.15);
      ctx.font = `italic 400 26px ${body}`;
      ctx.fillText(book.author, W / 2, 130 + t.lines.length * t.size * 1.15 + 4);
      break;
    }
  }
  ctx.restore();
}

export function coverDataUrl(book: Book, theme: Theme) {
  const [c, ctx] = canvas(256, 366);
  ctx.scale(0.5, 0.5);
  drawCover(ctx, book, theme);
  return c.toDataURL("image/png");
}

export function coverCanvas(book: Book, theme: Theme) {
  const [c, ctx] = canvas(COVER_W, COVER_H);
  drawCover(ctx, book, theme);
  return c;
}

export function spineCanvas(book: Book, theme: Theme) {
  const [c, ctx] = canvas(128, COVER_H);
  ctx.fillStyle = shade(book.color, -0.1);
  ctx.fillRect(0, 0, 128, COVER_H);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(0, 0, 128, 40);
  ctx.fillRect(0, COVER_H - 40, 128, 40);
  ctx.save();
  ctx.translate(64, COVER_H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#f4e7cf";
  const t = fitText(ctx, book.spineTitle, (s) => `600 ${s}px ${theme.fonts.display}`, COVER_H - 120, 44, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.lines[0] ?? "", 0, 0);
  ctx.restore();
  return c;
}

export function pageCanvas(book: Book, theme: Theme) {
  const [c, ctx] = canvas(COVER_W, COVER_H);
  ctx.fillStyle = theme.book3d.paper;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  const g = ctx.createLinearGradient(0, 0, 60, 0);
  g.addColorStop(0, "rgba(0,0,0,.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 60, COVER_H);
  ctx.fillStyle = "#3a2e26";
  ctx.textAlign = "center";
  ctx.font = `500 22px ${theme.fonts.body}`;
  ctx.fillText("CHAPTER I", COVER_W / 2, 110);
  const t = fitText(ctx, book.title, (s) => `700 ${s}px ${theme.fonts.display}`, COVER_W - 140, 38, 2);
  centered(ctx, t.lines, COVER_W / 2, 170, t.size * 1.1);
  ctx.fillStyle = "#3a2e2655";
  ctx.fillRect(COVER_W / 2 - 40, 200 + t.lines.length * t.size, 80, 2);
  // placeholder text lines
  let s = seedOf(book);
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 17; i++) {
    const y = 270 + i * 24;
    const end = i % 6 === 5 ? 0.45 + r() * 0.3 : 1;
    ctx.fillStyle = "rgba(58,46,38,.35)";
    ctx.fillRect(70, y, (COVER_W - 140) * end, 7);
  }
  ctx.fillStyle = "#3a2e2699";
  ctx.font = `400 18px ${theme.fonts.body}`;
  ctx.fillText("1", COVER_W / 2, COVER_H - 40);
  return c;
}

export function endpaperCanvas(theme: Theme) {
  const [c, ctx] = canvas(256, 366);
  const W = 256, H = 366;
  const ink = theme.book3d.endpaper;
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 2;
  switch (theme.book3d.coverStyle) {
    case "japanese": // seigaiha waves
      for (let y = -10; y < H + 30; y += 20)
        for (let x = (y / 20) % 2 ? 20 : 0; x < W + 40; x += 40)
          for (let k = 3; k > 0; k--) {
            ctx.beginPath();
            ctx.arc(x, y, k * 6.5, Math.PI, 0);
            ctx.stroke();
          }
      break;
    case "chinese": // key fret
      for (let y = 10; y < H; y += 36)
        for (let x = 10; x < W; x += 36) {
          ctx.strokeRect(x, y, 24, 24);
          ctx.strokeRect(x + 6, y + 6, 12, 12);
        }
      break;
    case "vedic":
      for (let y = 14; y < H; y += 28)
        for (let x = (y / 28) % 2 ? 28 : 14; x < W; x += 28) {
          ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
        }
      break;
    case "space": {
      let s = 21;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 140; i++) {
        ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.4 + 0.2, 0, 7); ctx.fill();
      }
      break;
    }
    case "fantasy": {
      let s = 9;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.8 + 0.3, 0, 7); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, 7); ctx.stroke();
      break;
    }
  }
  return c;
}

/** Make sure theme fonts are ready before drawing text onto canvases. */
export function loadThemeFonts(theme: Theme) {
  const fams = [theme.fonts.display, theme.fonts.body].map((f) => f.split(",")[0].trim());
  return Promise.all(fams.flatMap((f) => [document.fonts.load(`400 40px "${f}"`), document.fonts.load(`700 40px "${f}"`)])).catch(() => {});
}
