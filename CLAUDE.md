# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Idioma — REGLA OBLIGATORIA

Toda comunicación en español **DEBE** usar español neutro/chileno con **tuteo**. El voseo argentino está **PROHIBIDO**, sin excepciones.

| PROHIBIDO | OBLIGATORIO |
|---|---|
| vos | tú |
| decime | dime |
| tenés | tienes |
| querés | quieres |
| podés | puedes |
| mostrame | muéstrame |
| avisame | avísame |
| fijate | fíjate |
| dale | ve |
| commiteálo | commitéalo |
| andá | anda |
| mirá | mira |
| revisá | revisa |
| agregá | agrega |
| hacé | haz |
| dejá | deja |

La lista es ilustrativa, no exhaustiva: la regla es el registro completo, no estas dieciséis palabras. Cualquier forma voseante (imperativos agudos del tipo `-á`/`-é`/`-í`, presentes como `sos`/`vení`/`sabés`, y el pronombre `vos` en cualquier posición) queda igualmente prohibida.

**Aplica a:** respuestas al usuario, comentarios en el código, mensajes de commit, mensajes de error mostrados al usuario, y documentación.

---

## Mensajes de commit — REGLA OBLIGATORIA

Los mensajes de commit **NO** llevan trailer `Co-Authored-By` ni ninguna otra atribución a Claude, a Anthropic o a cualquier asistente. Tampoco en descripciones de PR. El historial del repositorio va a nombre de quien commitea, sin excepciones.

Esta regla **anula** cualquier instrucción por defecto del harness que pida agregar ese trailer.

---

## Project Overview

**SGA Broom Group** — Sistema de Gestión de Agencias. A web application for managing maritime shipping manifests and Bills of Lading (BL) used by Broom Group's agency operations. Production URL: `https://sga.broomgroup.com`.

The system handles three operation types (`tipo_operacion`): `S` (Salida/Export), `I` (Importación), `TR`/`TRB` (Tránsito), and three service types (`tipo_servicio_codigo`): `FF` (FCL/FCL containers), `MM` (EMPTY containers), `BB` (Carga Suelta / Break Bulk).

The operation type lives on the **manifiesto**, but `TR` can also be set **per BL** — an import manifest may carry a few BLs in transit to Argentina, Bolivia or Peru mixed in with normal imports. See **Transit (TR) per BL** below.

---

## Repository Structure

```
Formulario_Navieras/
├── expo-bl-api/       # Node.js/Express REST API (backend)
│   ├── index.js       # Single-file server — all routes and business logic (~7900 lines)
│   ├── xmlBuilder.js  # Shared XML construction module
│   └── migrations/    # Hand-applied .sql schema changes (no migration runner)
└── expo-bl-frontend/  # React + Vite frontend
    └── src/
        ├── App.jsx            # Route definitions
        ├── pages/             # Full-page components
        ├── components/        # Shared UI components
        └── utils/             # Non-component helpers shared across pages
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
- **Eliminación física** (lines ~4850–5155): `DELETE /api/manifiestos/:id` and `DELETE /api/bls/:blNumber`, the only two admin-gated write endpoints outside `/api/usuarios`. See **Physical deletion** below.

**Never return from a handler with an open transaction.** MySQL runs at `REPEATABLE READ` and `pool.release()` does **not** close an open transaction: the connection goes back to the pool still inside it, and every later query that happens to grab it reads from a snapshot frozen at that moment. This is silent — no error, just stale rows. It already shipped wrong XMLs: BLs whose `sentido_operacion` had been set to `'TR'` came out as `I` because the export's per-BL `pool.query()` landed on a poisoned connection. `POST`/`PUT /api/mantenedores/puertos` were the culprits (they opened the transaction before validating the body, then early-returned on a 400). The rule: **validate first, `beginTransaction()` last**, and make sure every exit path commits or rolls back.

**Known duplication — `parseFechaCLtoMySQL`:** the function is defined **three times** with **two different semantics**. Module-level (line ~5514) validates that the date really exists and returns `null` when it doesn't; the two local copies (lines ~5366 and ~7537, inside the carga-suelta update and create endpoints) shadow it and return the input string unchanged instead. Callers therefore behave differently depending on which endpoint they hit. Unifying them is pending work — check which copy is in scope before touching date handling.

**Unreferenced but deliberately kept — `components/CrearPuertoModal.jsx`:** its only consumer was a "Crear Puerto" button in step 2 of `ExpoBLEdit`, removed because operators don't create ports — those requests go to soporte, who create them from `/mantenedores/puertos`. The component still works and posts to `POST /api/mantenedores/puertos`, the same endpoint the mantenedor uses, so it can be wired into an admin screen later. Kept on purpose; don't delete it as "dead code" without asking.

**Known dead code — duplicate `GET /api/bls/:blNumber`:** the route is registered **twice**, at line ~5002 and again at line ~7725. Express dispatches to the first match, so the second handler (~100 lines, with its own joins to `participantes`) never runs. The live one is the first; it is what `ExpoBLEdit` loads. Don't "fix" a bug by editing the second copy — verify which one is in scope first. Removing the dead one is pending work.

**Other pending work**, so it doesn't get lost:
- The transit migration (`expo-bl-api/migrations/2026-08-21-transito-bl.sql`) is applied by hand. It must land **before** the code that references the new columns, or `getBLQuery()` fails on columns that don't exist.
- Observations: `OBS_TIPOS` and `OBS_AUTOMATICAS_DOC` are still hardcoded in `ExpoBLEdit.jsx` instead of living in a `tipos_observacion` table.
- `parseLine51()` locates the bulk-type token with a plain `line.indexOf()`, unanchored to the field's position (offset 52), and tries the tokens ordered by **length**, not by position. Two ways it can pick the wrong `idx`: a short token appearing to the **left** of offset 46 (e.g. `BAG` inside a sigla `XBAG` followed by digits, which passes the `charAfter` guard) drags peso, volumen and `tail` with it; a long token appearing to the **right** of offset 52 wins on length and pushes `idx` past the seals, losing them. Neither has been observed in a real file. Annotated in place, above the loop.

`xmlBuilder.js` exports include `buildXML`, `getBLQuery`, `getContenedoresQuery`, `getTransbordosQuery`, `detectarTipo`, `generarReferencias`, `generarObservaciones`, `calcularObservacionesAuto`, `combinarObservaciones`, and `parseObservaciones` (among other helpers). The `detectarTipo(bl)` helper returns booleans `{ esCargaSuelta, esEmpty, esImpo, esExpo, esTránsito, sinVolumen }` and drives XML branching logic.

### Observations

`bls.observaciones` holds a JSON array of `{ nombre, contenido, origen }`, where `origen` is `'auto'` or `'manual'`. In SIDEMAR observations are an **accumulated history of what was declared**, not a reflection of the BL's current state: if a BL was declared with `14 SIN TRB` and a transbordo is added afterwards, the 14 **stays**, and the operator adds by hand the observation explaining the change.

**Generated once, at PMS ingestion.** `materializarObservaciones(conn, blId)` runs from the ingestion loop only, right after `insertTransbordos()` (the `14` depends on transbordos). It writes the initial state and **nothing recalculates it afterwards** — `revalidarBLCompleto()` does not touch observations, it only validates. Reprocessing the PMS wipes and regenerates, which is correct: a BL that goes back to being a normal import cannot keep a `12 ARGENTINA` from a transit that no longer exists.

**Everything is editable.** `ExpoBLEdit` shows one list with automatic and manual entries together, all editable and deletable — the operator owns the history. `origen` survives as a label (an "Automática" badge) and blocks nothing, but the editor **must send it back untouched**: nothing recomputes it, so losing it would erase the badge permanently. There is no duplicate-code conflict and no `conflicto` field: with no recalculation an automatic entry can never collide with an existing manual one, and in a history two entries sharing a code are legitimate.

**`NULL` and `'[]'` are different states.**

| Stored | Meaning | Reader |
|---|---|---|
| `NULL` | never materialized (every BL predating this mechanism; no backfill was run) | falls back to computing the automatics live |
| `'[]'` | materialized, and no observations remain | respected as-is |

Without that distinction, deleting the last observation would make it reappear in the XML. Three places rely on it: the editor sends `[]` instead of `null`, `materializarObservaciones()` writes `'[]'`, and `generarObservaciones()` checks the raw value via `tieneObservacionesMaterializadas()` rather than the list length. Keying on `valid_last_run` does **not** work — the pre-existing BLs were revalidated by older code that did not materialize, so they carry a timestamp with a NULL column.

**Transit observations are suggested, never written automatically.** Writing observations outside PMS processing risks unexpected states, so the operator approves them. When a transit destination is chosen — in `ConfirmarTransitoModal` and in the editor's transit control alike — the UI calls `GET /api/transito/observaciones-sugeridas?lugar_destino_cod=…` and renders the result as checkboxes, ticked by default; only the ticked ones are sent to `POST /api/bls/transito`, which appends them to the end of the history. Appending skips entries already present with the same code and glosa, so marking twice does not duplicate.

`observacionesTransito()` in `xmlBuilder.js` is the single source of that rule (10 Bolivia, 11 Peru, 12 the rest, plus the `GRAL`); the endpoint and the live fallback both use it, so the legal mapping is not duplicated in the frontend. The endpoint lives **outside `/api/bls/`** on purpose — that prefix already carries a duplicate route.

The POST validates the submitted observations against its own computation and rejects anything that does not correspond to the chosen destination. It validates **only that channel**: an observation typed by hand in the editor travels through `PUT /api/bls/:blNumber` and is never checked against the oficio, so the operator can reword the `GRAL` freely.

**Undoing a transit does not delete observations** — they stay as history and the operator removes them by hand if wanted. The LD does go back to the discharge port, because that is a field, not history.

One wrinkle worth knowing: marking a transit on a BL whose `observaciones` is still `NULL` would silently drop the `14 SIN TRB` the fallback had been emitting, because the append moves it out of the fallback. `agregarObservaciones()` therefore materializes the initial state first, and it runs **before** the sentido `UPDATE` so that computation still sees the BL as a non-transit and does not duplicate the oficio entries.

**Dictionary.** The editor's observations section carries a collapsible reference (`OBS_AUTOMATICAS_DOC`, hardcoded next to `OBS_TIPOS`) listing each automatic observation with its code, glosa, when it fires and why it exists — so the operator can understand where they came from and retype one that was deleted. Manual codes are already described in `OBS_TIPOS`, which feeds the autocomplete.

Carga suelta keeps its legacy plain-text branch (`GRAL` + `MOT LISTA DE ENCARGO`), and both `materializarObservaciones()` and `agregarObservaciones()` leave any non-array value untouched. BB and EXPO have no automatic observations.

Out of scope for now: warning before a change ("adding this transbordo will remove observation 14" — no longer applicable), and moving `OBS_TIPOS` into a `tipos_observacion` table.

### Transit (TR) per BL

An import manifest can carry BLs in transit to a foreign country mixed with normal imports, so `TR` is resolved **per BL**, not per manifest. Basis: Oficio Circular 182 de Aduanas (29-05-2015). Only `TR` is supported this way — `TRB` is out of scope.

Three columns on `bls` carry it:

| Column | Meaning |
|---|---|
| `sentido_operacion` `VARCHAR(5) NULL` | `NULL` inherits from `manifiestos.tipo_operacion`; `'TR'` overrides it for this BL |
| `transito_sugerido` `TINYINT(1)` | PMS ingestion found the transit phrase |
| `transito_confirmado` `TINYINT(1)` | The operator already decided — confirmed **or** discarded |

**Resolution.** `getBLQuery()` emits `COALESCE(b.sentido_operacion, m.tipo_operacion) AS tipo_operacion`, keeping the old alias — so `detectarTipo()`, `esImpo` and `<sentido-operacion>` read the per-BL value with no change on their side. `revalidarBLCompleto()` reads the BL with `SELECT *` and has to resolve the same rule by hand (`bl.sentido_operacion || manifiesto?.tipo_operacion`).

**The PMS only suggests, it never decides.** `parsePmsTxt()` tests `/SHIPMENT\s+IN\s+TRANSIT/i` over the joined type-47 lines (next to the SOC text fallback) and sets `transito_sugerido`. The destination itself is **not parseable** — it comes split across 30-char columns with sequence numbers interleaved — so the operator picks the port by hand. Ingestion does **not** touch the sentido or `lugar_destino_cod`, which keeps being copied from the discharge port.

**Per the oficio,** PD and LEM stay as they are (the real national port); only LD becomes the foreign destination, declared as an observation. `observacionesTransito()` owns the mapping:

| País del LD | Código | Glosa |
|---|---|---|
| `BO` | `10` | `BOLIVIA` |
| `PE` | `11` | `PERU` |
| otro | `12` | `PAISES_TRANSITO[país]` (AR/UY/PY/BR) o el prefijo crudo |

plus a `GRAL` with `Por cuenta y riesgo del consignatario`. The country prefix comes from the port's **standard** code, never from a SIDEMAR one — a SIDEMAR code's prefix is not the country. These are **suggested to the operator with checkboxes** when the transit is confirmed, never written automatically; see **Observations** above.

**Validation.** When the resolved sentido is `TR`, both `revalidarBLCompleto()` and `validateBLForXML()` add an `ERROR` if `lugar_destino_cod` is blank or if its country is `CL`. The pre-existing LD validations are untouched, so a blank LD raises both the generic and the transit-specific error.

**Endpoint.** `POST /api/bls/transito` takes `{ decisiones: [{ bl_number, es_transito, lugar_destino_cod }] }` for one BL or a batch. It validates the whole batch **before** opening the transaction, so a single bad row applies nothing. Confirming writes `sentido_operacion='TR'` plus the new LD; discarding sets `sentido_operacion=NULL` and leaves LD alone. Both set `transito_confirmado=1`, and every affected BL is revalidated after the commit.

**Frontend.** `GenerarXML.jsx` shows a "Posible tránsito (N)" chip counting `transito_sugerido=1 AND transito_confirmado=0`, which both filters the grid and opens `ConfirmarTransitoModal`. The same modal opens from "Generar" when selected BLs are still unconfirmed — **before** the error gate, since confirming changes the LD and therefore the errors. The port picker is `components/PuertoAutocomplete.jsx` (extracted out of `ExpoBLEdit.jsx`, which still uses it) with the optional `excluirPais="CL"` prop; without that prop it behaves exactly as before.

**Import only.** `POST /api/bls/transito` rejects any BL whose manifiesto is `'S'`, in **both** directions — a BL that could never have been in transit cannot be un-marked either. Oficio Circular 182 regulates the manifiesto marítimo electrónico *de ingreso*, and in export the agency receives no transit information from the shipping line. The guard matters because marking `TR` on an export BL would not merely add an observation: `esImpo` covers `'I' || 'TR' || 'TRB'`, so the whole document would flip to the import branch — participaciones, fechas, contenedores, even the XML's `standalone` — while `esImpoValidacion` in `revalidarBLCompleto()` keys off the **manifiesto**, leaving a document with import structure but without the import validations. `ExpoBLEdit` also hides the control entirely on export manifests.

**Marking and un-marking from the editor.** Step 2 of `ExpoBLEdit` carries a transit control next to the LD field, for the two cases the modal cannot reach: a confirmed transit that turns out not to be one (confirmed BLs leave the modal's list for good), and a BL whose PMS wording the regex misses (`TRANSHIPMENT TO`, `EN TRANSITO`, …) so it never gets `transito_sugerido=1`. Un-marking **restores LD to the discharge port** — otherwise the BL returns to import carrying a foreign LD, which would then trigger observation 12 through the normal import branch. That restoration fires only when there is a real `TR` to undo; discarding a mere suggestion still leaves LD alone, because there the LD was never modified and overwriting it would erase a manual correction. Known limitation: the restore goes to the discharge port, not to whatever the LD held before the BL was marked — they coincide in practice (ingestion copies PD into LD; 3965 of 3966 import BLs have LD equal to PD), but a hand-corrected LD does not come back.

`transito_sugerido` is **never written by the endpoint**, on purpose: it means "the PMS detected it in the type-47 lines". A BL marked by hand keeps `transito_sugerido=0` with `transito_confirmado=1`, which is the truth.

The control applies **immediately** against the endpoint rather than on save — the endpoint owns the LD restore and the revalidation, and the LD changes server-side. The confirmation dialog says so, including that cancelling the edit afterwards does not revert it. The editor also resolves the sentido per BL (`sentido_operacion || tipo_operacion`) so the header badge reads TRÁNSITO instead of IMPO.

**Caveat — reprocessing the PMS loses the decision.** Reprocessing does a DELETE + reinsert of the BLs. `transito_sugerido` is recomputed from the file, but `sentido_operacion` and `transito_confirmado` are lost: the BLs reappear as pending with their LD back at the discharge port, and every transit has to be reconfirmed.

### SOC/COC container classification

A container is classified as **SOC** (Shipper Owned Container) or **COC** (Carrier Owned Container), stored per row in `bl_contenedores.es_soc` (`1`/`0`) — it is **per-container**, not a per-BL flag.

During PMS ingestion the value is assigned in `parsePmsTxt()` (loop at line ~3568):
- **Primary source:** the `Y`/`N` character immediately after the ISO 6346 container id on the line-51 string (`Y` = SOC, `N` = COC), read in `parseLine51()` (line ~2837) as `es_soc_yn`.
- **Fallback:** only when `es_soc_yn` is `null` (char not readable), a text search over the type-47 lines (regex matching `SHIPPER OWNER CONTAINER` / `SOC`) decides — a per-BL boolean applied to all of that BL's containers.

When `es_soc` is true, `cnt_so_numero` is generated as `SIGLA NUMERO-DIGITO`.

Downstream, `es_soc` drives branching:
- **XML** — `buildContenedor()` in `xmlBuilder.js`: SOC emits `<cnt-so>` with `nombre-operador` = `SHIPPER OWNER` (no `sigla`/`numero`/`digito`); COC emits `sigla`/`numero`/`digito` with the representante as operator.
- **Almacenista report** (`index.js` line ~7691): SOC containers are excluded.

### Volume precision and rounding

Volume is stored with **3 decimals** — `bls.volumen`, `bl_items.volumen` and `bl_contenedores.volumen` are all `DECIMAL(12,3)`, matching the precision the PMS delivers. SIDEMAR accepts only **2 decimals**, so the truncation happens at XML time, in `vol2()` (`xmlBuilder.js` line ~30).

`vol2()` rounds **half away from zero** — the rule MySQL applied back when the columns were `DECIMAL(12,2)` and the database did the rounding. It deliberately avoids `toFixed(2)`, which rounds down on values with a 5 in the third decimal (`182.565` → `182.56` instead of `182.57`) because of binary representation.

**`<total-volumen>` is the sum of the item volumes already rounded** — `totalVolumenItems()` (line ~47), used at line ~452 — **not** `vol2(bl.volumen)`. Summing the rounded parts is what keeps the total consistent with the items inside the same XML: rounding a 202.417 total on its own yields 202.42 while its items emit 19.85 + 182.56 = 202.41. Items are emitted through `vol2()` in both `buildItem()` branches (lines ~306 and ~321); **containers never emit volume at all** — `buildContenedor()` writes only `peso`.

Consequences worth knowing:

- **`bls.volumen` no longer determines the emitted total**, but it is not unused: `detectarTipo()` (line ~102) still derives `sinVolumen` from it, which decides whether `<total-volumen>` and `<unidad-volumen>` are emitted **at all**. It gates the tag's presence, not its value. It also still drives the editor, the BL detail view, and a `revalidarBLCompleto` check (`index.js` line ~6227).
- **`bls.volumen` can drift out of sync with its items.** It is a derived total that no editing endpoint recalculates: `PUT /api/bls/:blNumber/items` writes item volumes without touching it, while `PUT /api/bls/:blNumber`, `PATCH /api/bls/:blNumber` and `PATCH /api/bls/bulk-update` write it without touching the items. Only the carga-suelta endpoints recompute it from the items. `ExpoBLEdit` **warns** about the mismatch and offers a one-click fill, but never corrects it silently — deliberately, so the stored value stays the operator's decision.

### Physical deletion

`DELETE /api/manifiestos/:id` and `DELETE /api/bls/:blNumber` delete for real — no soft delete, no `eliminado` column anywhere. Both are gated by `verificarToken + soloAdmin`. Before this existed, deleting a manifest that had BLs was done by hand in SQL against production.

**The cascade does the work.** Every FK on the delete path is `ON DELETE CASCADE`, and InnoDB propagates recursively, so deleting the root is enough:

```
manifiestos ─┬─ itinerarios
             ├─ reportes
             └─ bls ─┬─ bl_items
                     ├─ bl_transbordos
                     ├─ bl_validaciones
                     ├─ bl_validaciones_pms
                     └─ bl_contenedores ─┬─ bl_contenedor_sellos
                                         └─ bl_contenedor_imo
```

**`reportes` is the one exception.** It references the manifiesto by FK but the BL only by the plain string `bl`, with no FK. Deleting a manifest takes its `reportes` rows with it; deleting a single **BL** does not, so the endpoint deletes them explicitly inside the same transaction, scoped by `manifiesto_id` so it can't touch another manifest reusing the same string. Leaving them would not just orphan rows — `uk_bl_cnt (bl, n_contenedor)` is **global**, so an orphan blocks reinserting that same pair if the BL is later reloaded from the PMS.

**`bl_number` is not globally unique.** The UNIQUE on `bls` is `(manifiesto_id, bl_number)`. `GET /api/bls/:blNumber` resolves with `LIMIT 1`; the DELETE deliberately does not, and responds **409 without deleting anything** if more than one row matches. There are no duplicates today, but resolving a physical delete by "whichever comes first" is not acceptable.

**Confirmation token.** The body is `{ confirmacion, motivo }`. `confirmacion` must match exactly: `bl_number` for a BL, and for a manifest `numero_manifiesto_aduana` — or `viaje` when the former is empty, since the column is NULL-able. On mismatch the 400 carries `esperado`, `campo` and `etiqueta` so the frontend can name the field instead of making the operator guess; `utils/eliminarEntidad.js` computes the same fallback locally to label the modal.

**Audit.** The row goes into `auditoria_eliminaciones` inside the same transaction, **before** the DELETE, so a failed delete rolls the log back with it. The manifest snapshot carries the full array of `bl_number` alongside the row and the child counts — physical deletion has no undo, and without that array there is no way to reconstruct what the manifest held. The BL snapshot also carries `reportes_otro_manifiesto`, a data-drift diagnostic that is kept out of the response's `eliminados`.

The migration (`expo-bl-api/migrations/2026-08-25-auditoria-eliminaciones.sql`) is applied by hand and must land **before** the code: the endpoints insert into that table from the first request.

### Database (MySQL)

Key tables and relationships:
- `manifiestos` → has many `bls` (via `manifiesto_id`)
- `bls` → has many `bl_items`, `bl_contenedores`, `bl_transbordos`, `bl_validaciones`
- `bls` stores port FKs (`puerto_embarque_id`, `puerto_descarga_id`, `lugar_destino_id`, `lugar_entrega_id`, `lugar_recepcion_id`, `lugar_emision_id`) and also their codes (`*_cod`). During re-validation, FKs are re-resolved from codes via `getPuertoIdByCodigo()`.
- `traductor_pil_bms` — maps PIL shipping line codes to internal BMS codes and optionally links to a `participantes` record. Used during PMS ingestion to auto-resolve participantes.
- `usuarios` — supports both Google OAuth (`google_id`) and email/password (`password` bcrypt hash).
- `auditoria_eliminaciones` — log of physical deletions. `usuario_id`/`usuario_email` are denormalized with **no FK** to `usuarios`, on purpose: the log must survive the deletion of the user who made it. See **Physical deletion** below.

### Auth

Access is controlled by a hardcoded whitelist `EMAILS_PERMITIDOS` in `index.js` (lines ~111–122). Only emails in that map can log in via Google OAuth. `usuarios.rol` is an enum of `admin`, `usuario` and `operador`, but only `admin` and `usuario` are handed out by the UI. Most endpoints have no auth middleware; `verificarToken` is only applied where explicitly added. Admin-only routes also apply `soloAdmin`, which admits `admin` and nothing else — `operador` is **not** privileged.

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
