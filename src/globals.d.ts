declare module '*.css' {
  // Side-effect import only.
}

declare module '*.woff2' {
  // Bun's `file` loader returns the emitted asset URL (hashed, public-path aware).
  const url: string;
  export default url;
}
