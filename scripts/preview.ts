/*
 * Static server over dist/—the preview faithful to production.
 *
 * `bun run dev` stays the fast loop (HMR, single shell); this one serves the
 * real tree with the real multilingual URLs, and it is the only place to check
 * hydration and the relative asset paths of the deeper pages.
 *
 * Port: 4173 by default, `PORT=8080 bun run preview` to change it.
 */

const PORT = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error(
    `PORT must be an unprivileged TCP port (1024–65535), got ${
      JSON.stringify(process.env.PORT)
    }`,
  );
}

async function file(path: string): Promise<Response | null> {
  const candidate = Bun.file(`dist${path}`);
  return (await candidate.exists()) ? new Response(candidate) : null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    // Object storage does not resolve directory indexes; imitate the minimum
    // useful for local proofreading, nothing more.
    const tries = pathname.endsWith("/")
      ? [`${pathname}index.html`]
      : [pathname, `${pathname}.html`, `${pathname}/index.html`];

    for (const path of tries) {
      const hit = await file(path);
      if (hit) return hit;
    }

    const notFound = await file("/404.html");
    return notFound
      ? new Response(notFound.body, { status: 404, headers: notFound.headers })
      : new Response("404", { status: 404 });
  },
});

console.log(`  dist/ served on http://localhost:${server.port}`);
