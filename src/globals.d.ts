declare module '*.css' {
  // Side-effect import only.
}

declare module '*.woff2' {
  // Bun's `file` loader returns the emitted asset URL (hashed, public-path aware).
  const url: string;
  export default url;
}

// `hyphen` ships no types; it inserts U+00AD (soft hyphen) at syllable boundaries.
declare module 'hyphen/en' {
  export function hyphenateSync(text: string): string;
}
declare module 'hyphen/fr' {
  export function hyphenateSync(text: string): string;
}
