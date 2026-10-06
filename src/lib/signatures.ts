export type SignatureStyle = {
  id: number;
  font: string;
  ink: string;
  slant: number;
  size: number;
  line: boolean;
};

const FONTS = [
  "Great Vibes",
  "Allura",
  "Sacramento",
  "Dancing Script",
  "Caveat",
  "Satisfy",
  "Marck Script",
  "Pacifico",
  "Yellowtail",
  "Italianno",
] as const;

const LOOKS = [
  { ink: "#2c211b", slant: -6, size: 1.35, line: false },
  { ink: "#1c2a4a", slant: -2, size: 1.5, line: false },
  { ink: "#6e2433", slant: 4, size: 1.25, line: false },
  { ink: "#3a2a22", slant: -8, size: 1.4, line: true },
] as const;

export const SIGNATURES: SignatureStyle[] = FONTS.flatMap((font, fontIndex) =>
  LOOKS.map((look, lookIndex) => ({
    id: fontIndex * LOOKS.length + lookIndex + 1,
    font,
    ...look,
  })),
);

export const SIGNATURE_TEXT = "pumi naka";
