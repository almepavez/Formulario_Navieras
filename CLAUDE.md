# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SGA Broom Group** — Sistema de Gestión de Agencias. A web application for managing maritime shipping manifests and Bills of Lading (BL) used by Broom Group's agency operations. Production URL: `https://sga.broomgroup.com`.

The system handles three operation types (`tipo_operacion`): `S` (Salida/Export), `I` (Importación), `TR`/`TRB` (Tránsito), and three service types (`tipo_servicio_codigo`): `FF` (FCL/FCL containers), `MM` (EMPTY containers), `BB` (Carga Suelta / Break Bulk).

---

## Repository Structure

```
Formulario_Navieras/
├── expo-bl-api/       # Node.js/Express REST API (backend)
│   ├── index.js       # Single-file server — all routes and business logic (~7900 lines)
│   └── xmlBuilder.js  # Shared XML construction module
└── expo-bl-frontend/  # React + Vite frontend
    └── src/
        ├── App.jsx            # Route definitions
        ├── pages/             # Full-page components
        └── components/        # Shared UI components
```

---

## Dev Commands

### Backend (`expo-bl-api/`)
```bash
cd expo-bl-api
npm run dev      # nodemon index.js — auto-restarts on changes
```
Requires a `.env` file (see Environment Variables below). Server starts on port `4000` by default.

### Frontend (`expo-bl-frontend/`)
```bash
cd expo-bl-frontend
npm run dev      # Vite dev server
npm run build    # Production build
```
Requires a `.env` file with `VITE_API_URL=http://localhost:4000`.

### Seed users (local dev)
```bash
cd expo-bl-api
node crear-usuarios.js   # Creates test users in DB
```

---

## Environment Variables

### Backend (`expo-bl-api/.env`)
```
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
JWT_SECRET
SESSION_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
PORT   # defaults to 4000
```

### Frontend (`expo-bl-frontend/.env`)
```
VITE_API_URL=https://sga.broomgroup.com   # or http://localhost:4000 for dev
```

---

## Architecture

### Backend (`index.js`)

One large Express file — all routes, middleware, and business logic live here. The file is organized in labeled sections (`// ===...===`). Key sections:

- **Auth** (lines ~67–606): JWT middleware (`verificarToken`), role check (`soloAdmin`), Google OAuth via Passport.js, email/password login, password reset via email code.
- **Manifiestos** (lines ~607–990): CRUD for shipping manifests. Creating a manifest requires valid FK codes for `servicio`, `nave`, and `puertoCentral`.
- **BLs** (lines ~4788–7850): Bills of Lading CRUD. A BL belongs to a manifiesto. Endpoints handle items, contenedores, transbordos, and carga suelta separately.
- **PMS Processing** (lines ~2556–3695): Parses PMS text files uploaded per manifest. `parsePmsByFile()` (line ~3680) is **not** a multi-format dispatcher: it routes by extension — `.txt`/`.pms`/`.dat` (or no extension) all go to the single parser `parsePmsTxt()`, and any other extension (e.g. `.csv`) throws `Formato no soportado`. The PMS `.txt` is line-typed (`00`/`11`/`12`/…/`51`/…/`99`); `parsePmsTxt()` splits it into per-BL blocks and dispatches each line type to its extractor. "PMS51" / line 51 is **not** a file format — it is the **container line** (type `51`) inside that same `.txt`. `loadPms51Tokens()` loads bulk-type tokens from the `pms51_tokens` table into memory at startup, and `parseLine51()` uses them to locate weight/volume/seals within a line-51 string.
- **XML Generation** (lines ~5573–5815): Calls `buildXML()` from `xmlBuilder.js`. Can generate a single BL XML or a `.zip` of all BLs in a manifest.
- **Validation** (lines ~5856–6551): `revalidarBLCompleto(conn, blId)` wipes and rewrites `bl_validaciones` for a BL. Errors and observations are classified at four levels: `BL`, `ITEM`, `CONTENEDOR`, `TRANSBORDO`, with severities `ERROR` or `OBS`.
- **Mantenedores** (lines ~992–2500): CRUD for reference tables — puertos, naves, servicios, almacenistas, tipos-bulto, empaque-contenedores, participantes, and the `traductor_pil_bms` mapping table.

`xmlBuilder.js` exports include `buildXML`, `getBLQuery`, `getContenedoresQuery`, `getTransbordosQuery`, `detectarTipo`, `generarReferencias`, and `generarObservaciones` (among other helpers). The `detectarTipo(bl)` helper returns booleans `{ esCargaSuelta, esEmpty, esImpo, esExpo, esTránsito, sinVolumen }` and drives XML branching logic.

### SOC/COC container classification

A container is classified as **SOC** (Shipper Owned Container) or **COC** (Carrier Owned Container), stored per row in `bl_contenedores.es_soc` (`1`/`0`) — it is **per-container**, not a per-BL flag.

During PMS ingestion the value is assigned in `parsePmsTxt()` (loop at line ~3568):
- **Primary source:** the `Y`/`N` character immediately after the ISO 6346 container id on the line-51 string (`Y` = SOC, `N` = COC), read in `parseLine51()` (line ~2837) as `es_soc_yn`.
- **Fallback:** only when `es_soc_yn` is `null` (char not readable), a text search over the type-47 lines (regex matching `SHIPPER OWNER CONTAINER` / `SOC`) decides — a per-BL boolean applied to all of that BL's containers.

When `es_soc` is true, `cnt_so_numero` is generated as `SIGLA NUMERO-DIGITO`.

Downstream, `es_soc` drives branching:
- **XML** — `buildContenedor()` in `xmlBuilder.js`: SOC emits `<cnt-so>` with `nombre-operador` = `SHIPPER OWNER` (no `sigla`/`numero`/`digito`); COC emits `sigla`/`numero`/`digito` with the representante as operator.
- **Almacenista report** (`index.js` line ~7691): SOC containers are excluded.

### Database (MySQL)

Key tables and relationships:
- `manifiestos` → has many `bls` (via `manifiesto_id`)
- `bls` → has many `bl_items`, `bl_contenedores`, `bl_transbordos`, `bl_validaciones`
- `bls` stores port FKs (`puerto_embarque_id`, `puerto_descarga_id`, `lugar_destino_id`, `lugar_entrega_id`, `lugar_recepcion_id`, `lugar_emision_id`) and also their codes (`*_cod`). During re-validation, FKs are re-resolved from codes via `getPuertoIdByCodigo()`.
- `traductor_pil_bms` — maps PIL shipping line codes to internal BMS codes and optionally links to a `participantes` record. Used during PMS ingestion to auto-resolve participantes.
- `usuarios` — supports both Google OAuth (`google_id`) and email/password (`password` bcrypt hash).

### Auth

Access is controlled by a hardcoded whitelist `EMAILS_PERMITIDOS` in `index.js` (lines ~111–122). Only emails in that map can log in via Google OAuth. Roles are `admin` or `usuario`. Most endpoints have no auth middleware; `verificarToken` is only applied where explicitly added. Admin-only routes also apply `soloAdmin`.

### Frontend (`expo-bl-frontend/`)

React 19 + React Router v7 + Tailwind CSS + SweetAlert2 for modals. All API calls use `import.meta.env.VITE_API_URL` as the base.

Route structure (from `App.jsx`):
- `/manifiestos` — list, create, detail
- `/manifiestos/:id/generar-xml` — XML generation UI
- `/expo-bl` — BL list
- `/expo/:blNumber` — BL detail (view)
- `/expo/detail/:blNumber` — Alternate BL detail view (`ExpoBLDetail` component, distinct from `/expo/:blNumber` which renders `Expo`)
- `/expo/:blNumber/edit` — BL edit (multi-step wizard with 7 steps)
- `/expo/:blNumber/carga-suelta/edit` — Carga Suelta edit
- `/expo/bulk-edit` — Mass edit BLs sharing the same voyage
- `/mantenedores/:tipo` — Generic CRUD via `CRUDMantenedor` component
- `/reportes` — Reports page

Route ordering matters in `App.jsx`: more specific paths (e.g. `/expo/bulk-edit`) must appear before parameterized paths (e.g. `/expo/:blNumber`).

The `ExpoBLEdit` page is a 7-step wizard: General → Rutas → Participantes → Mercancía → Items → Contenedores → Revisión.

Date handling: the DB stores dates as `YYYY-MM-DD` strings (with `dateStrings: true` in the pool config). The frontend avoids passing dates through `new Date()` to prevent timezone shifts; string slicing (`substring(0, 10)`) is used instead.

---

## Maintaining this file

Keep CLAUDE.md **accurate over exhaustive** — it's a map, not a mirror of the code.

- **When to update:** update it when you change something it describes — a parser, an endpoint's behavior/middleware, a frontend route, the schema, or a non-obvious business rule (e.g. SOC/COC detection). Skip it for routine work it doesn't mention (bug fixes, styling, refactors with no behavior change).
- **Precision over exhaustiveness:** document what isn't obvious from the code; don't add whole subsystems "for completeness" and don't restate the obvious. Verify each claim against the code before writing it — if you can't confirm it, don't state it as fact. Line numbers are approximate (`~`) and drift as files grow; treat them as hints, not contracts.
- **Other project docs have other owners:** CLAUDE.md is for code assistants. The other documents in the repo (User Manual, Deploy Guide, DB import/export guides) are written for people and owned elsewhere — don't rewrite them on your own. If a code change leaves one stale, flag it, but don't edit it unless asked.
- **Targeted edits:** when correcting a section, change only what the fix needs — don't rewrite or expand beyond it.
- **Commit docs separately:** land CLAUDE.md changes in their own `docs:` commit, apart from code changes, so history stays reviewable.

Also: no credentials or PII in this file — describe the system, not individuals.
