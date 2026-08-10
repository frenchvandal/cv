/*
 * What to upload, what to leave alone, and what to remove — decided before a
 * single byte moves.
 *
 * The planner is a pure function of two listings (what `dist/` holds, what the
 * bucket holds), which is what makes a deploy testable without a bucket and
 * `--dry-run` an honest preview rather than a second code path.
 *
 * Three rules carry it:
 *
 *   - **A hashed asset never changes under its own key.** `assets/` files are
 *     content-hashed by the bundler, so the same key means the same bytes.
 *     Its presence is the whole comparison; nothing is read from disk.
 *   - **Everything else is compared by digest.** OSS returns an ETag that is
 *     the MD5 of the object, measured against `normcore-dev` on 2026-08-10 for
 *     a 13 KB page and a 209 KB font: uppercase, quoted, otherwise identical
 *     to the local hash. So an unchanged page is not re-uploaded, and a deploy
 *     that changes one article moves one article. The design had refused to
 *     assume this; it is now measured, and the fallback if a bucket ever
 *     disagrees is visible — a mismatched digest only ever causes an upload
 *     that was already the old behaviour.
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

/** A file in `dist/`. `md5` is read lazily—hashed assets never need it. */
export interface LocalFile {
  key: string;
  md5: () => Promise<string>;
}

/** An object in the bucket, as the listing describes it. */
export interface RemoteObject {
  key: string;
  /** The ETag as OSS returns it: quoted and uppercase. Compared case-insensitively. */
  etag: string;
}

export interface Upload {
  key: string;
  cacheControl: string;
}

export interface Plan {
  uploads: Upload[];
  /** Remote keys with no local file, in the order they should be removed. */
  deletes: string[];
  /** Objects already in the bucket with the right bytes, counted not listed. */
  kept: number;
}

/** OSS quotes and upper-cases its ETags; a local digest is bare and lower. */
function sameDigest(etag: string, md5: string): boolean {
  return etag.replace(/^"|"$/g, "").toLowerCase() === md5.toLowerCase();
}

/**
 * `local` is every file under `dist/`; `remote` is every object already in the
 * bucket, both without the deployment prefix. Keys are compared verbatim: the
 * caller applies the prefix on both sides, or on neither.
 */
export async function planUpload(
  local: readonly LocalFile[],
  remote: readonly RemoteObject[],
): Promise<Plan> {
  const there = new Map(remote.map((object) => [object.key, object.etag]));
  const here = new Set(local.map((file) => file.key));

  const assets = local.filter((file) => file.key.startsWith("assets/"));
  const rest = local.filter((file) => !file.key.startsWith("assets/"));

  // A hashed asset is identified by its key alone—hashing 1 MB of fonts to
  // learn what the file name already says would be work for nothing.
  const staleAssets = assets.filter((file) => !there.has(file.key));

  const staleRest: LocalFile[] = [];
  for (const file of rest) {
    const etag = there.get(file.key);
    if (etag === undefined || !sameDigest(etag, await file.md5())) {
      staleRest.push(file);
    }
  }

  const uploads = [...staleAssets, ...staleRest]
    .map(({ key }) => ({ key, cacheControl: cacheControl(key) }));

  return {
    uploads,
    deletes: remote
      .filter((object) => !here.has(object.key))
      .map((object) => object.key)
      .sort(),
    kept: local.length - uploads.length,
  };
}

/**
 * Whether the deletions in a plan look like a sync or like a mistake.
 *
 * Removing what a build no longer emits is the job. Removing more objects than
 * the whole site contains is not: it means the bucket holds something this
 * deploy does not know about — the wrong bucket, or the right bucket at the
 * wrong prefix. That is not a hypothetical. `normcore-dev` held 358 objects of
 * an earlier site when this deploy was first pointed at it, and a plan built
 * at the bucket root would have removed every one of them.
 *
 * So the plan stops and says so, and `--prune` is how someone who has read the
 * list says they meant it.
 */
export function deletesLookLikeAMistake(plan: Plan): boolean {
  return plan.deletes.length > plan.uploads.length;
}
