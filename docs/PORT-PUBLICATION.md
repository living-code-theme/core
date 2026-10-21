# Port publication and capacity

Port repositories own their README, metadata, application code and real screenshots. Core reads them; it never
runs port scripts or writes back into a port. Landing builds from committed publication inputs, without core,
GitHub, an object-store credential or build-time image downloads.

## One authored document, a versioned publication contract

A port's README remains its only authored installation/configuration documentation. The README template and its
GitHub comparison table/dropdowns are an **authoring contract**, not the website's document layout.

Discovery validates the README, then extracts a guide with `schemaVersion: 1`, Markdown `installation`,
`configuration` and `compatibility` strings, plus a `links` map of reference definitions. Fenced headings remain
code; definitions in omitted sections still resolve. Only gallery images and images used by the guide are cached.
No generated guide is edited independently. A later README presentation can emit the same guide version without
requiring a website adapter for each application.

The schema-2 publication is:

```text
landing/data/ports.json                       # metadata index and immutable capture size/hash inventory
landing/data/ports/<slug>.<sha256>.json        # document v1: full port record, guide v1, file links, guide images
landing/public/port-images/<sha256>.webp       # default local asset mode; optional with external storage
```

The small index contains each port's display/search/screenshot metadata and its `content` reference. It contains
no README, guide or included-file list. Global UI imports only this index. A port page lazily loads its own local
content document, verifies its fingerprint and checks its metadata against the index. Documents remain build
inputs, not publicly downloadable documentation catalogs. Visitors receive static HTML.

Only changed ports replace their immutable document. Unchanged documents and the index are not rewritten. Removed
ports leave no tombstone list. Both core and landing read the prior schema-1 catalog during rollout; this is format
compatibility, **not** a fallback registry or permission to resurrect retired ports.

## Discovery requests

1. Fetch the complete public repository inventory in pages of 100.
2. With `GH_TOKEN`, query up to 100 repository heads per read-only GraphQL request, with at most two batches in flight.
3. Reuse unchanged accepted revisions. Fetch changed descriptors, READMEs, listed files and raster inputs from
   `raw.githubusercontent.com` at the exact commit, with four repositories in flight by default.

A 400-repository unchanged poll needs **four inventory requests plus four head batches**, not 400 head requests.
Only GitHub API requests receive the token. Immutable public blob downloads use the fixed GitHub CDN origin,
receive **no authorization header**, and do not spend the Actions token's REST allowance on thousands of cold
file/image reads. Redirects, response sizes and timeouts remain bounded. No repository-provided URL can select a
request host or receive either GitHub or R2 credentials.

Large discovery requires authentication: anonymous runs over 20 active repositories fail before a request storm.
Partial inventory/batch results, auth failures and rate limits abort without publication. An individual invalid or
transient update keeps the last accepted port. Deliberate descriptor removal and complete-inventory removals opt out.

Work is bounded and ordered. A failed queue drains in-flight operations before returning. Catalog validation is
linear over the finished candidate set, not repeated serialization of every growing prefix.

## Asset storage and history

The default remains checked-in `public/port-images`. Live captures are content-addressed and pruned after the index
commits, but **Git still retains deleted image blobs**. A growing, frequently changing capture catalog should use
external storage instead of accumulating every screenshot generation in website history.

Optional Cloudflare R2 publication:

```sh
# Export these in the maintainer environment; do not commit keys.
export R2_ACCOUNT_ID='your-cloudflare-account-id'
export R2_BUCKET='your-existing-public-capture-bucket'
export R2_PUBLIC_URL='https://your-public-bucket.example/port-images/'
export R2_ACCESS_KEY_ID='your-bucket-scoped-access-key'
export R2_SECRET_ACCESS_KEY='your-bucket-scoped-secret'
GH_TOKEN="$(gh auth token)" pnpm sync:ports --landing ../landing --r2
```

Configure a working public bucket URL first. Its path is also the object-key prefix. The adapter signs requests
only to that account's `r2.cloudflarestorage.com` endpoint. It does not create buckets, configure domains or change
DNS. Use object read/write credentials scoped to this bucket, not a general deployment/admin token.

R2 publishes the verified immutable captures **before** committing the index pointer. Failed uploads preserve the
old index and local captures. Existing local captures can be transferred without rereading GitHub. Successful
migration removes only obsolete generated local capture files. A saved index records verified lengths and hashes;
unchanged immutable objects need no HEAD/GET/PUT on each poll. `--refresh` revalidates unchanged source captures.
Old objects without checksum metadata are downloaded within bounds and fingerprint-checked, never trusted on ETag.

Remote objects are **not automatically deleted**: cached HTML and retained deployments can still use their URLs.
Monitor bucket usage and use a separately reviewed retention/garbage-collection operation that preserves hashes
referenced by current and retained deployments. Do not apply age-only expiry to all objects: an old object may
still be the current capture. The live-byte budget below is not a lifetime archive budget. Moving future captures
out of Git does not rewrite existing website history.

Local port previews do not upload to R2 or download existing remote captures. They preserve published remote
references and freeze only the edited port's new captures in the isolated preview copy. The browser may load the
already-published captures from their public URLs; the website build itself stays offline.

## Persistence and safeguards

Under the exclusive `.port-discovery.lock`, persistence validates all retained references, sizes, fingerprints and
write targets. It writes missing/repaired assets, then immutable documents, then atomically replaces the small
index. Finally it removes only unreferenced generated document/WebP regular files. Manual files and symlinks are
not pruned; referenced symlink targets and symlinked data/cache directories are rejected. Failed preflight leaves
the saved publication untouched. Check the recorded PID before removing a lock left by a killed process.
Production serializes discovery, build, tests and deployment; do not run a writer concurrently with a site build.
`--dry-run` does not write, upload or prune.

| Safety budget | Limit |
|---|---:|
| Accepted ports | 1,000 |
| Complete repository inventory | 2,000 |
| Formatted metadata index | 2 MiB |
| Source README | 64 KiB |
| Serialized guide | 128 KiB |
| One immutable port document | 512 KiB |
| All current port documents | 128 MiB |
| One optimized capture | 2 MiB |
| Unique captures per port | 8 MiB |
| All current unique captures | 512 MiB |

Separate input limits remain: 32 KiB descriptor, 1 MiB listed file, 10 MiB image, 20 million pixels, 16,384px maximum
dimension, and 24 distinct gallery/guide images per port. An individual oversized update retains the previous port;
aggregate failures abort. Ports are not silently evicted and instructions are never truncated. These limits are
circuit breakers, not a claim that every combination of individual maxima fits the aggregate budgets.

## Reproduce the 400-port acceptance check

```sh
pnpm test
pnpm test:scale --landing ../landing --keep --report /tmp/living-code-scale.json
```

The normal test suite exercises 400 synthetic repositories through the real discovery and R2 adapters with small
rasters. The explicit scale command uses 1,121 unique 1280×720 calibration captures, varied documentation,
reference-style images/links, limited-flavor and missing-image ports. The fixtures are marked unpublished and are
never saved into the source website. They are not application screenshots.

It verifies cold import, unchanged polls, three changed documents, invalid-update fallback, removal/opt-out,
partial listings, rate-limit failures, object integrity, and zero content/object-store requests on unchanged polls.
Then it frozen-installs a real isolated landing, disables Astro telemetry, forbids build/test HTTP requests, builds
all 400 port routes and runs the website suite. The source website catalog must remain byte-identical.

One local Node 22 run produced an approximately **826 KiB index**, **3.1 MiB of documents**, and **100 MiB of
captures**, with about **571 MiB peak discovery RSS**. The offline site build took approximately **2.7 seconds**;
132 website tests passed. Unchanged discovery plus persistence took about **0.15 seconds** and eight API requests.
These are local synthetic acceptance measurements: GitHub/R2 transports are simulated, not production network
latency, service throughput, credentials or account-setup benchmarks. The tested scale is 400, not an assertion
of unlimited capacity.

## Production rollout

Publish/review the new core code, then advance landing's exact core SHA pin. Landing's current catalog remains
readable until that first updated sync writes schema 2. Keep website schema-2 support and document staging in the
same rollout. No normal build imports an unpublished sibling core checkout.

For R2 in landing's existing workflow, configure `PORT_ASSET_STORAGE=r2`, `R2_BUCKET` and `R2_PUBLIC_URL` as Actions
variables, and `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` as secrets. It reuses `CLOUDFLARE_ACCOUNT_ID` for the account.
The default `PORT_ASSET_STORAGE=git` needs none of these optional credentials. Enabling R2 before advancing the core
pin fails rather than deploying dangling captures. No remote publication or deployment is part of the local scale
check.
