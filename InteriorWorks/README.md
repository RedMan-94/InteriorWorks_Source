# InteriorWorks source export

This is the complete tracked application source at Git commit `e7cdc5b5859b2b77d3202625793b4d822701e2be`. The code and calculation rules are preserved as published. `README-ORIGINAL.md` is the original repository README; this guide has been added only to the ZIP. No live site or repository was changed to prepare this export.

## Structure

- `app/`: React/Vinext frontend, unit editor, catalogue, room planning, material selection, results, and API routes.
- `app/lib/engine.ts`: core material calculation, quantities, validation, hardware, glass, laminate, and sheet cutting logic.
- `app/lib/`: supporting model, resizing, geometry, finishes, shelves, procurement, drawings, and PDF generation (`pdf.ts`, `construction-views.ts`, `master.ts`, `layout-dimensions.ts`, etc.).
- `app/api/workspace/route.ts`: authenticated D1 project storage; `app/api/calculate/route.ts`: calculation endpoint; `app/api/catalogue-image/route.ts`: authenticated R2 image upload/retrieval.
- `db/`: Drizzle D1 schema and connection; `drizzle/`: the SQL migration and metadata.
- `worker/`: Cloudflare Worker entry point. `lib/`, `components/`, `hooks/`, `public/`, `vendor/`, `examples/`, `scripts/`: shared components, connector support, static assets, styling, examples, and tooling.
- `tests/`: Node test suite for calculations, geometry, placement, PDF/material output, and saved design behavior.
- `package.json` and `pnpm-lock.yaml`: dependencies and exact dependency graph. `vite.config.ts`, `.openai/hosting.json`, and `cloudflare-env.d.ts`: local/hosted bindings and app configuration.

## Local development

1. Install Node.js **22.13.0 or newer** and pnpm **11.25.0** (the version in `package.json`).
2. In the extracted `InteriorWorks` directory, run `pnpm install --frozen-lockfile`.
3. Run `pnpm dev`, then open the URL printed by Vinext (normally `http://localhost:5173`). In the portable local dev profile, `/signin-with-chatgpt?return_to=/` signs in as a local mock user. This development-only mock does not authenticate real ChatGPT users.
4. Apply the existing local D1 migration before saving projects (see below). The local Vite configuration provides simulated `DB` and `BUCKET` bindings, with state under the generated `.wrangler/` directory.
5. Run `node --test tests/*.test.mjs` to check the calculation suite. `pnpm build` builds the Worker; `pnpm start` previews the built Worker using local Wrangler state. The built preview does not include the development mock sign-in.

The repository's scripts select a portable execution profile when `.sites-runtime/execution-profile.json` is absent, as it will be in this ZIP. Use the original README for additional build and diagnostic details.

### Local database migration

Build first to generate `dist/server/wrangler.json`, then apply the included migration to the **local** D1 instance from the extracted project root:

```sh
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lazy_shard.sql
```

Apply each migration only once per local database. `pnpm db:generate` is for future schema changes; it is not needed for this export. These commands do not connect to or modify the published site's database.

## Independent hosting and runtime requirements

- **Environment variables:** No user-provided secret environment variable is required for the default portable local development flow. The project does not contain production credentials. Optional tooling variables are described in `README-ORIGINAL.md` (for example `CLOUDFLARE_CF_FETCH_ENABLED` and `WRANGLER_SEND_METRICS`). Do not copy any live credentials into the source tree.
- **Database:** Persistent workspaces use Cloudflare **D1**, bound as `DB`. The SQL schema is in `drizzle/0000_lazy_shard.sql` and `db/schema.ts`. Local Vite/Miniflare can simulate D1; to host elsewhere, provision a compatible SQLite/D1 store, apply migrations, and configure/replace the binding. The database ID in `vite.config.ts` is only a local placeholder. Production database configuration and saved workspace records are not included.
- **Image storage:** Uploaded catalogue photos use Cloudflare **R2**, bound as `BUCKET`; `app/api/catalogue-image/route.ts` reads/writes objects under each user ID. Local Vite simulates the binding. Independent production hosting needs an R2 bucket or an equivalent storage implementation. Previously uploaded user images are runtime data and are not part of this source ZIP.
- **Authentication:** The hosted site receives identity headers and sign-in/sign-out routes from the ChatGPT Sites platform. The API routes require `oai-authenticated-user-id` and `oai-authenticated-user-email`. The portable dev server offers a mock login, but an independent production deployment needs an authentication provider and must replace the platform sign-in flow and supply a stable, trusted user identity to the API. Do not trust arbitrary client-supplied identity headers.
- **Connector integration:** `worker/index.ts` supports a request-scoped `CONNECTORS` capability and the local preview includes a connector mock. Any independent production usage of those integrations needs a compatible service or an application-specific replacement.
- **Hosting metadata:** `.openai/hosting.json` names the original Sites project and declares `DB`/`BUCKET` bindings; it does not grant access to the live project, its database, or images. Replace the hosting configuration when deploying under your own infrastructure.

## Export boundaries

The ZIP includes all 179 files tracked by the source repository, plus this guide; the original README is preserved as `README-ORIGINAL.md`. It excludes generated `dist/` and framework caches, the 931 MB `node_modules/` installation, `.git/` metadata, local Wrangler state, and any live data or credentials. Install the declared dependencies from the lockfile to reproduce the environment. No build, reset, migration, or deployment was performed to make this ZIP.
