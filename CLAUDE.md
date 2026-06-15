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
- **PMS Processing** (lines ~2556–3667): Parses PMS `.txt` or `.csv` files uploaded per manifest. `parsePmsByFile()` dispatches to format-specific parsers. PMS51 requires tokens loaded at startup via `loadPms51Tokens()`.
- **XML Generation** (lines ~5617–5795): Calls `buildXML()` from `xmlBuilder.js`. Can generate a single BL XML or a `.zip` of all BLs in a manifest.
- **Validation** (lines ~5856–6551): `revalidarBLCompleto(conn, blId)` wipes and rewrites `bl_validaciones` for a BL. Errors and observations are classified at four levels: `BL`, `ITEM`, `CONTENEDOR`, `TRANSBORDO`, with severities `ERROR` or `OBS`.
- **Mantenedores** (lines ~992–2500): CRUD for reference tables — puertos, naves, servicios, almacenistas, tipos-bulto, empaque-contenedores, participantes, and the `traductor_pil_bms` mapping table.

`xmlBuilder.js` exports: `buildXML`, `getBLQuery`, `getContenedoresQuery`, `getTransbordosQuery`, `detectarTipo`, `generarObservaciones`. The `detectarTipo(bl)` helper returns booleans `{ esCargaSuelta, esEmpty, esImpo, esExpo, esTránsito, sinVolumen }` and drives XML branching logic.

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
- `/expo/:blNumber/edit` — BL edit (multi-step wizard with 7 steps)
- `/expo/:blNumber/carga-suelta/edit` — Carga Suelta edit
- `/expo/bulk-edit` — Mass edit BLs sharing the same voyage
- `/mantenedores/:tipo` — Generic CRUD via `CRUDMantenedor` component
- `/reportes` — Reports page

Route ordering matters in `App.jsx`: more specific paths (e.g. `/expo/bulk-edit`) must appear before parameterized paths (e.g. `/expo/:blNumber`).

The `ExpoBLEdit` page is a 7-step wizard: General → Rutas → Participantes → Mercancía → Items → Contenedores → Revisión.

Date handling: the DB stores dates as `YYYY-MM-DD` strings (with `dateStrings: true` in the pool config). The frontend avoids passing dates through `new Date()` to prevent timezone shifts; string slicing (`substring(0, 10)`) is used instead.
