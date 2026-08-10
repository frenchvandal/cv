/*
 * What to upload, what to leave alone, and what to remove — decided before a
 * single byte moves.
 *
 * The planner is a pure function of two listings (what `dist/` holds, what the
 * bucket holds), which is what makes a deploy testable without a bucket and
 * `--dry-run` an honest preview rather than a second code path.
 *
 * Two rules carry it:
 *
 *   - **A hashed asset never changes under its own key.** `assets/` files are
 *     content-hashed by the bundler, so the same key means the same bytes:
 *     uploading one that is already there is pure waste. Everything else —
 *     109 HTML pages, seven feeds, the sitemap — is small and rewritten on
 *     every build, so it goes up unconditionally rather than through an ETag
 *     comparison this project would then have to trust OSS to compute the way
 *     S3 does.
 *   - **Order is load-bearing.** Assets first, then the pages that reference
 *     them, then deletions. A reader can therefore never be served a page
 *     pointing at an asset that has not landed, and a stale page is only ever
 *     removed once its replacement is in place.
 */

/** The cache lifetime each kind of file gets, from the design’s §8.1. */
export function cacheControl(key: string): string {
  // Content-hashed: a new build gives a new key, so this one can be kept for
  // as long as the CDN is willing to.
  if (key.startsWith("assets/")) return "public, max-age=31536000, immutable";
  // The document itself is the entry point to everything else: it must be
  // revalidated, or a reader keeps a page pointing at assets that are gone.
  if (key.endsWith(".html")) return "public, max-age=0, must-revalidate";
  // Machine-read, and cheap to refetch: five minutes is enough to absorb a
  // burst without making a new article wait.
  if (/^(feed[\w.-]*\.json|sitemap\.(xml|css)|robots\.txt)$/.test(key)) {
    return "public, max-age=300";
  }
  // The link preview: scrapers cache it by URL, and the name never changes.
  return "public, max-age=86400";
}

export interface Upload {
  /** Path under `dist/`, which is also the object key once prefixed. */
  key: string;
  cacheControl: string;
}

export interface Plan {
  uploads: Upload[];
  /** Remote keys with no local file, in the order they should be removed. */
  deletes: string[];
  /** Hashed assets already in the bucket, counted rather than listed. */
  kept: number;
}

/**
 * Whether the deletions in a plan look like a sync or like a mistake.
 *
 * Removing what a build no longer emits is the job. Removing more objects than
 * the whole site contains is not: it means the bucket holds something this
 * deploy does not know about — the wrong bucket, or the right bucket at the
 * wrong prefix. That is not a hypothetical. `normcore-dev` held 358 objects of
 * an earlier site when this deploy was first pointed at it, and a plan built
 * at the bucket root would have removed every one of them to make room for 144.
 *
 * So the plan stops and says so, and `--prune` is how someone who has read the
 * list says they meant it.
 */
export function deletesLookLikeAMistake(plan: Plan): boolean {
  return plan.deletes.length > plan.uploads.length;
}

/**
 * `local` is every file under `dist/`; `remote` is every key already in the
 * bucket, both without the deployment prefix. Keys are compared verbatim: the
 * caller applies the prefix on both sides, or on neither.
 */
export function planUpload(
  local: readonly string[],
  remote: readonly string[],
): Plan {
  const there = new Set(remote);
  const here = new Set(local);

  const assets = local.filter((key) => key.startsWith("assets/"));
  const rest = local.filter((key) => !key.startsWith("assets/"));
  const fresh = assets.filter((key) => !there.has(key));

  return {
    uploads: [...fresh, ...rest]
      .map((key) => ({ key, cacheControl: cacheControl(key) })),
    deletes: remote.filter((key) => !here.has(key)).sort(),
    kept: assets.length - fresh.length,
  };
}
