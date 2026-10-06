import { createFileRoute } from "@tanstack/react-router";
import { Download, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { composePng, PIN_WIDTH, SPEECH_PATH, THOUGHT_PATH, suggestPin, type BubbleKind } from "@/lib/compose";
import { SIGNATURES, SIGNATURE_TEXT, type SignatureStyle } from "@/lib/signatures";

export const Route = createFileRoute("/")({ component: Home });

const NOTE_LIMIT = 80;

const BUBBLES: Array<{ id: BubbleKind; label: string }> = [
  { id: "speech", label: "בועת דיבור" },
  { id: "thought", label: "בועת מחשבה" },
  { id: "text", label: "בועת טקסט" },
];

const BUBBLE_SPOT: Record<BubbleKind, { x: number; y: number }> = {
  speech: { x: 0.28, y: 0.2 },
  thought: { x: 0.74, y: 0.22 },
  text: { x: 0.5, y: 0.8 },
};

type PlacedBubble = { id: string; kind: BubbleKind; x: number; y: number; text: string };

function BubbleFace({ kind, tailUp }: { kind: BubbleKind; tailUp: boolean }) {
  const flip = tailUp ? "-scale-y-100" : "";
  if (kind === "speech") {
    return (
      <svg viewBox="0 0 220 150" className={`absolute inset-0 h-full w-full ${flip}`} aria-hidden>
        <path d={SPEECH_PATH} className="fill-card stroke-ink" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "thought") {
    return (
      <svg viewBox="0 0 220 168" className={`absolute inset-0 h-full w-full ${flip}`} aria-hidden>
        <path d={THOUGHT_PATH} className="fill-card stroke-ink" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="100" cy="140" r="7" className="fill-card stroke-ink" strokeWidth="3" />
        <circle cx="90" cy="156" r="4" className="fill-card stroke-ink" strokeWidth="3" />
      </svg>
    );
  }
  return null;
}

const STICKERS = [
  { id: "teddy", src: "/character.png?v=5", label: "סוודר" },
  { id: "stretch", src: "/pumi-stretch.png", label: "מתיחה" },
] as const;

function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stickerRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLImageElement>(null);
  const signatureRef = useRef<HTMLParagraphElement>(null);
  const bubbleEls = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const sigDrag = useRef<{
    id: number;
    px: number;
    py: number;
    x: number;
    y: number;
    fromPalette: boolean;
  } | null>(null);

  const bubbleDrag = useRef<{
    kind: BubbleKind;
    id: string | null;
    px: number;
    py: number;
    x: number;
    y: number;
  } | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("רק רציתי שתראו.");
  const [placed, setPlaced] = useState<PlacedBubble[]>([]);
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const [bubbleGhost, setBubbleGhost] = useState<{ kind: BubbleKind; x: number; y: number } | null>(
    null,
  );
  const [scale, setScale] = useState(1);
  const [stickerId, setStickerId] = useState<(typeof STICKERS)[number]["id"]>("teddy");
  const [pos, setPos] = useState({ x: 0.68, y: 0.42 });
  const [signature, setSignature] = useState<SignatureStyle | null>(null);
  const [sigPos, setSigPos] = useState({ x: 0.55, y: 0.62 });
  const [ghost, setGhost] = useState<{ x: number; y: number; style: SignatureStyle } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  function replaceFile(next: string | null) {
    setFileUrl((prev) => {
      if (prev && prev !== next) URL.revokeObjectURL(prev);
      return next;
    });
  }

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("צריך קובץ תמונה.");
      return;
    }
    setError("");
    replaceFile(null);
    const url = URL.createObjectURL(file);
    const stage = stageRef.current;
    const probe = new Image();
    probe.onload = () => {
      if (!stage || !stage.clientWidth) return;
      setPos(suggestPin(probe, stage.clientWidth, stage.clientHeight));
    };
    probe.src = url;
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, x: pos.x, y: pos.y };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    const start = drag.current;
    if (!stage || !start) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.min(0.92, Math.max(0.08, start.x + (event.clientX - start.px) / rect.width));
    const y = Math.min(0.72, Math.max(0.16, start.y + (event.clientY - start.py) / rect.height));
    setPos({ x, y });
    replaceFile(null);
  }

  function onPointerUp() {
    drag.current = null;
  }

  function placeSignature(id: number, clientX: number, clientY: number) {
    const sticker = stickerRef.current;
    const shot = shotRef.current;
    const stage = stageRef.current;
    const style = SIGNATURES.find((item) => item.id === id);
    if (!sticker || !shot || !stage || !style) return;
    const stageRect = stage.getBoundingClientRect();
    const onStage =
      clientX >= stageRect.left &&
      clientX <= stageRect.right &&
      clientY >= stageRect.top &&
      clientY <= stageRect.bottom;
    const wrap = sticker.getBoundingClientRect();
    const image = shot.getBoundingClientRect();
    const imageBottom = (image.bottom - wrap.top) / wrap.height;
    if (!onStage) {
      setSignature(style);
      setSigPos({ x: 0.55, y: Math.min(0.62, imageBottom - 0.08) });
      return;
    }
    const x = Math.min(0.92, Math.max(0.08, (clientX - wrap.left) / wrap.width));
    const y = Math.min(imageBottom - 0.06, Math.max(0.08, (clientY - wrap.top) / wrap.height));
    setSignature(style);
    setSigPos({ x, y });
  }

  function onPalettePointerDown(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    event.currentTarget.setPointerCapture(event.pointerId);
    sigDrag.current = { id, px: event.clientX, py: event.clientY, x: 0.55, y: 0.62, fromPalette: true };
  }

  function onPalettePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const start = sigDrag.current;
    if (!start?.fromPalette) return;
    if (Math.hypot(event.clientX - start.px, event.clientY - start.py) < 4) return;
    const style = SIGNATURES.find((item) => item.id === start.id);
    if (!style) return;
    setGhost({ x: event.clientX, y: event.clientY, style });
  }

  function onPalettePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = sigDrag.current;
    sigDrag.current = null;
    setGhost(null);
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.px, event.clientY - start.py) > 6;
    if (!moved) {
      const shot = shotRef.current;
      const sticker = stickerRef.current;
      const style = SIGNATURES.find((item) => item.id === start.id) ?? null;
      if (shot && sticker && style) {
        const wrap = sticker.getBoundingClientRect();
        const image = shot.getBoundingClientRect();
        const imageBottom = (image.bottom - wrap.top) / wrap.height;
        setSigPos({ x: 0.55, y: Math.min(0.62, imageBottom - 0.08) });
      }
      setSignature(style);
      replaceFile(null);
      return;
    }
    placeSignature(start.id, event.clientX, event.clientY);
    replaceFile(null);
  }

  function onSignaturePointerDown(event: React.PointerEvent<HTMLParagraphElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sigDrag.current = {
      id: signature?.id ?? 0,
      px: event.clientX,
      py: event.clientY,
      x: sigPos.x,
      y: sigPos.y,
      fromPalette: false,
    };
  }

  function onSignaturePointerMove(event: React.PointerEvent<HTMLParagraphElement>) {
    event.stopPropagation();
    const sticker = stickerRef.current;
    const shot = shotRef.current;
    const start = sigDrag.current;
    if (!sticker || !shot || !start || start.fromPalette) return;
    const wrap = sticker.getBoundingClientRect();
    const image = shot.getBoundingClientRect();
    const imageBottom = (image.bottom - wrap.top) / wrap.height;
    const x = Math.min(0.92, Math.max(0.08, start.x + (event.clientX - start.px) / wrap.width));
    const y = Math.min(
      imageBottom - 0.06,
      Math.max(0.08, start.y + (event.clientY - start.py) / wrap.height),
    );
    setSigPos({ x, y });
    replaceFile(null);
  }

  function onSignaturePointerUp(event: React.PointerEvent<HTMLParagraphElement>) {
    event.stopPropagation();
    sigDrag.current = null;
  }

  function placeBubble(kind: BubbleKind, clientX: number, clientY: number, moved: boolean) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const onStage =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    const spot = BUBBLE_SPOT[kind];
    const x =
      moved && onStage ? Math.min(0.72, Math.max(0.28, (clientX - rect.left) / rect.width)) : spot.x;
    const y =
      moved && onStage ? Math.min(0.78, Math.max(0.18, (clientY - rect.top) / rect.height)) : spot.y;
    const existing = placed.find((item) => item.kind === kind);
    if (existing) {
      setActiveBubble(existing.id);
      setPlaced((prev) => prev.map((item) => (item.kind === kind ? { ...item, x, y } : item)));
    } else {
      const id = `${kind}-${placed.length + 1}`;
      setActiveBubble(id);
      setPlaced((prev) => [...prev, { id, kind, x, y, text: note.trim() || "רק רציתי שתראו." }]);
    }
    replaceFile(null);
  }

  function onBubblePaletteDown(event: React.PointerEvent<HTMLButtonElement>, kind: BubbleKind) {
    event.currentTarget.setPointerCapture(event.pointerId);
    bubbleDrag.current = { kind, id: null, px: event.clientX, py: event.clientY, x: 0, y: 0 };
  }

  function onBubblePaletteMove(event: React.PointerEvent<HTMLButtonElement>) {
    const start = bubbleDrag.current;
    if (!start || start.id) return;
    if (Math.hypot(event.clientX - start.px, event.clientY - start.py) < 4) return;
    setBubbleGhost({ kind: start.kind, x: event.clientX, y: event.clientY });
  }

  function onBubblePaletteUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = bubbleDrag.current;
    bubbleDrag.current = null;
    setBubbleGhost(null);
    if (!start || start.id) return;
    const moved = Math.hypot(event.clientX - start.px, event.clientY - start.py) > 6;
    placeBubble(start.kind, event.clientX, event.clientY, moved);
  }

  function onPlacedPointerDown(event: React.PointerEvent<HTMLDivElement>, item: PlacedBubble) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveBubble(item.id);
    bubbleDrag.current = {
      kind: item.kind,
      id: item.id,
      px: event.clientX,
      py: event.clientY,
      x: item.x,
      y: item.y,
    };
  }

  function onPlacedPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const stage = stageRef.current;
    const start = bubbleDrag.current;
    if (!stage || !start?.id) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.min(0.72, Math.max(0.28, start.x + (event.clientX - start.px) / rect.width));
    const y = Math.min(0.78, Math.max(0.18, start.y + (event.clientY - start.py) / rect.height));
    setPlaced((prev) => prev.map((item) => (item.id === start.id ? { ...item, x, y } : item)));
    replaceFile(null);
  }

  function onPlacedPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    bubbleDrag.current = null;
  }

  async function download() {
    const stage = stageRef.current;
    const shot = shotRef.current;
    if (!stage || !shot) return;
    setBusy(true);
    setError("");
    try {
      const blob = await composePng({
        stage,
        shot,
        photo,
        signatureEl: signature ? signatureRef.current : null,
        signature,
        notes: placed
          .map((item) => {
            const el = bubbleEls.current.get(item.id);
            return el ? { el, kind: item.kind, text: item.text } : null;
          })
          .filter((item): item is { el: HTMLDivElement; kind: BubbleKind; text: string } => item !== null),
      });
      const url = URL.createObjectURL(blob);
      replaceFile(url);
    } catch {
      setError("לא הצלחנו לייצא. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 md:px-8 md:py-12">
      <header className="max-w-xl">
        <p className="text-sm font-medium tracking-wide text-muted">פתקית</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight font-medium md:text-5xl">
          הצמידו אותה לתמונה, עם הערה.
        </h1>
        <p className="mt-3 text-base text-muted">
          מעלים תמונה, מזיזים את הדיוקן, כותבים משפט קצר, ומורידים. הכל נשאר במכשיר.
        </p>
      </header>

      <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          ref={stageRef}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            takeFile(event.dataTransfer.files[0]);
          }}
          className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-stage md:aspect-[5/4]"
        >
          {photo ? (
            <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <p className="pointer-events-none absolute inset-x-6 top-6 text-center text-sm text-muted">
              גררו לכאן תמונה, או בחרו קובץ
            </p>
          )}

          <div
            ref={stickerRef}
            className="absolute touch-none"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: `${PIN_WIDTH * scale * 100}%`,
              transform: "translate(-50%, -18%)",
              containerType: "inline-size",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="button"
            tabIndex={0}
            aria-label="גררו כדי להזיז את הדיוקן"
          >
            <img
              ref={shotRef}
              src={STICKERS.find((item) => item.id === stickerId)?.src ?? STICKERS[0].src}
              alt="הדיוקן שמצמידים"
              draggable={false}
              className="cutout pointer-events-none w-full"
            />
            {signature ? (
              <p
                ref={signatureRef}
                dir="ltr"
                className="absolute z-10 cursor-grab touch-none whitespace-nowrap leading-none select-none"
                style={{
                  left: `${sigPos.x * 100}%`,
                  top: `${sigPos.y * 100}%`,
                  fontFamily: `"${signature.font}", cursive`,
                  fontSize: `${signature.size * 7}cqi`,
                  color: signature.ink,
                  transform: `translate(-50%, -50%) rotate(${signature.slant}deg)`,
                  borderBottom: signature.line ? `1px solid ${signature.ink}` : undefined,
                }}
                onPointerDown={onSignaturePointerDown}
                onPointerMove={onSignaturePointerMove}
                onPointerUp={onSignaturePointerUp}
                onPointerCancel={onSignaturePointerUp}
              >
                {SIGNATURE_TEXT}
              </p>
            ) : null}
          </div>
          {placed.map((item) => {
            const tailUp = item.y > pos.y;
            return (
              <div
                key={item.id}
                className="absolute z-20 w-[42%] touch-none"
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={(event) => onPlacedPointerDown(event, item)}
                onPointerMove={onPlacedPointerMove}
                onPointerUp={onPlacedPointerUp}
                onPointerCancel={onPlacedPointerUp}
              >
                <div
                  ref={(node) => {
                    if (node) bubbleEls.current.set(item.id, node);
                    else bubbleEls.current.delete(item.id);
                  }}
                  data-bubble={item.kind}
                  className={
                    item.kind === "text"
                      ? "rounded-2xl border-2 border-ink bg-card px-3 py-2"
                      : item.kind === "speech"
                        ? "relative aspect-[220/150]"
                        : "relative aspect-[220/168]"
                  }
                >
                  {item.kind === "text" ? null : <BubbleFace kind={item.kind} tailUp={tailUp} />}
                  <p
                    className={`text-center font-serif text-base leading-snug ${
                      item.kind === "text"
                        ? ""
                        : `absolute inset-x-[16%] flex items-center justify-center ${
                            tailUp ? "top-[30%] bottom-[14%]" : "top-[14%] bottom-[32%]"
                          }`
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
                {activeBubble === item.id ? (
                  <button
                    type="button"
                    aria-label="הסרת הבועה"
                    className="absolute -top-4 -end-2 z-30 flex size-11 items-center justify-center rounded-full bg-ink text-paper"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPlaced((prev) => prev.filter((bubble) => bubble.id !== item.id));
                      setActiveBubble((current) => (current === item.id ? null : current));
                      replaceFile(null);
                    }}
                  >
                    <X size={16} aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm">מדבקה</span>
            <div className="grid grid-cols-2 gap-2">
              {STICKERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={stickerId === item.id}
                  onClick={() => {
                    setStickerId(item.id);
                    replaceFile(null);
                  }}
                  className={`overflow-hidden rounded-2xl border bg-stage p-1 ${
                    stickerId === item.id ? "border-ink" : "border-line"
                  }`}
                >
                  <img src={item.src} alt="" className="mx-auto h-24 w-auto object-contain" />
                  <span className="block pb-1 text-center text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-medium">
            <ImagePlus size={18} aria-hidden />
            בחירת תמונה
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                takeFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between text-sm">
              הערה
              <span className="tabular-nums text-muted">
                {(placed.find((item) => item.id === activeBubble)?.text ?? note).length}/{NOTE_LIMIT}
              </span>
            </span>
            <textarea
              value={placed.find((item) => item.id === activeBubble)?.text ?? note}
              maxLength={NOTE_LIMIT}
              rows={3}
              onChange={(event) => {
                const value = event.target.value;
                if (activeBubble) {
                  setPlaced((prev) =>
                    prev.map((item) => (item.id === activeBubble ? { ...item, text: value } : item)),
                  );
                } else {
                  setNote(value);
                }
                replaceFile(null);
              }}
              placeholder="משפט קצר שיושב בבועה"
              className="w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 font-serif text-lg leading-snug outline-none"
            />
          </label>

          <div className="grid grid-cols-3 gap-1.5">
            {BUBBLES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={placed.some((bubble) => bubble.kind === item.id)}
                onPointerDown={(event) => onBubblePaletteDown(event, item.id)}
                onPointerMove={onBubblePaletteMove}
                onPointerUp={onBubblePaletteUp}
                onPointerCancel={onBubblePaletteUp}
                className={`min-h-16 touch-none rounded-2xl border px-1 py-2 text-xs font-medium ${
                  placed.some((bubble) => bubble.kind === item.id)
                    ? "border-ink bg-paper"
                    : "border-line bg-paper"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm">גודל</span>
            <input
              type="range"
              min={0.7}
              max={1.45}
              step={0.01}
              value={scale}
              aria-label="גודל הדיוקן"
              onChange={(event) => {
                setScale(Number(event.target.value));
                replaceFile(null);
              }}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm">חתימה</span>
            <ul className="grid max-h-56 gap-1.5 overflow-y-auto pe-1">
              {SIGNATURES.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={signature?.id === item.id}
                    aria-label={`חתימה ${item.id}`}
                    onPointerDown={(event) => onPalettePointerDown(event, item.id)}
                    onPointerMove={onPalettePointerMove}
                    onPointerUp={onPalettePointerUp}
                    onPointerCancel={onPalettePointerUp}
                    className={`w-full touch-none rounded-xl border bg-paper px-2 py-2 leading-none ${
                      signature?.id === item.id ? "border-ink" : "border-line"
                    }`}
                  >
                    <span
                      dir="ltr"
                      className="inline-block"
                      style={{
                        fontFamily: `"${item.font}", cursive`,
                        fontSize: `${item.size}rem`,
                        color: item.ink,
                        transform: `rotate(${item.slant}deg)`,
                        borderBottom: item.line ? `1px solid ${item.ink}` : undefined,
                      }}
                    >
                      {SIGNATURE_TEXT}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-paper transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
          >
            <Download size={18} aria-hidden />
            {busy ? "מכינים…" : "הכנת התמונה"}
          </button>

          {fileUrl ? (
            <a
              href={fileUrl}
              download="patakit.png"
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ink bg-paper px-4 py-3 text-sm font-medium text-ink"
            >
              <Download size={18} aria-hidden />
              שמירת הקובץ
            </a>
          ) : null}

          <p className="text-sm text-muted" role="status">
            {error ||
              (fileUrl
                ? "הקובץ מוכן. לחצו על שמירת הקובץ."
                : "גררו בועה אל המסך, או את הדיוקן על גבי התמונה. שום דבר לא נשלח לשרת.")}
          </p>
        </aside>
      </section>
      {ghost ? (
        <p
          dir="ltr"
          className="pointer-events-none fixed z-50 leading-none whitespace-nowrap"
          style={{
            left: ghost.x,
            top: ghost.y,
            fontFamily: `"${ghost.style.font}", cursive`,
            fontSize: `${ghost.style.size}rem`,
            color: ghost.style.ink,
            transform: `translate(-50%, -50%) rotate(${ghost.style.slant}deg)`,
          }}
        >
          {SIGNATURE_TEXT}
        </p>
      ) : null}
      {bubbleGhost ? (
        <div
          className="pointer-events-none fixed z-50 w-40"
          style={{ left: bubbleGhost.x, top: bubbleGhost.y, transform: "translate(-50%, -50%)" }}
        >
          <div
            className={`relative ${
              bubbleGhost.kind === "speech"
                ? "aspect-[220/150]"
                : bubbleGhost.kind === "thought"
                  ? "aspect-[220/168]"
                  : "rounded-2xl border-2 border-ink bg-card px-3 py-2"
            }`}
          >
            {bubbleGhost.kind === "text" ? null : <BubbleFace kind={bubbleGhost.kind} tailUp={false} />}
            <p className="relative z-10 px-3 py-4 text-center font-serif text-sm">{note}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
