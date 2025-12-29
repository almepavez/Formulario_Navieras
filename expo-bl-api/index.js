const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});

app.get("/health", async (_req, res) => {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  res.json({ ok: true });
});

app.get("/manifiestos", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT
        id,
        servicio,
        nave,
        viaje,
        puerto_central AS puertoCentral,
        tipo_operacion AS tipoOperacion,
        operador_nave AS operadorNave,
        status,
        remark,
        emisor_documento AS emisorDocumento,
        representante,
        fecha_manifiesto_aduana AS fechaManifiestoAduana,
        numero_manifiesto_aduana AS numeroManifiestoAduana,
        created_at AS createdAt,
        updated_at AS updatedAt
     FROM manifiestos
     ORDER BY created_at DESC
     LIMIT 20`
  );

  res.json(rows);
});

app.post("/manifiestos", async (req, res) => {
  const {
    servicio,
    nave,
    viaje,
    puertoCentral,
    tipoOperacion,
    operadorNave,
    status,
    remark,
    emisorDocumento,
    representante,
    fechaManifiestoAduana,
    numeroManifiestoAduana,
    itinerario = [],
  } = req.body || {};

  // Validación mínima
  if (
    !servicio ||
    !nave ||
    !viaje ||
    !puertoCentral ||
    !tipoOperacion ||
    !operadorNave ||
    !emisorDocumento ||
    !representante ||
    !fechaManifiestoAduana ||
    !numeroManifiestoAduana
  ) {
    return res.status(400).json({
      error: "Faltan campos obligatorios del manifiesto.",
    });
  }

  const allowedOps = new Set(["EX", "IM", "CROSS"]);
  if (!allowedOps.has(tipoOperacion)) {
    return res.status(400).json({ error: "tipoOperacion inválido." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Insert manifiesto
    const [result] = await conn.query(
      `INSERT INTO manifiestos
        (servicio, nave, viaje, puerto_central, tipo_operacion,
         operador_nave, status, remark,
         emisor_documento, representante,
         fecha_manifiesto_aduana, numero_manifiesto_aduana)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        servicio,
        nave,
        viaje,
        puertoCentral,
        tipoOperacion,
        operadorNave,
        status || "En edición",
        remark || null,
        emisorDocumento,
        representante,
        fechaManifiestoAduana, // YYYY-MM-DD
        numeroManifiestoAduana,
      ]
    );

    const manifiestoId = result.insertId;

    // 2) Insert itinerario (si viene)
    if (Array.isArray(itinerario) && itinerario.length > 0) {
      for (let i = 0; i < itinerario.length; i++) {
        const row = itinerario[i];
        if (!row?.port || !row?.portType) continue;

        // portType debe ser LOAD o DISCHARGE
        const pt = String(row.portType).toUpperCase();
        if (pt !== "LOAD" && pt !== "DISCHARGE") {
          throw new Error(`portType inválido en fila ${i + 1}`);
        }

        // eta/ets vienen como "YYYY-MM-DDTHH:mm" desde <input datetime-local>
        // MySQL acepta "YYYY-MM-DD HH:mm:ss"
        const toMysqlDT = (v) =>
          v ? String(v).replace("T", " ") + ":00" : null;

        await conn.query(
          `INSERT INTO itinerarios
            (manifiesto_id, port, port_type, eta, ets, orden)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            manifiestoId,
            row.port,
            pt,
            toMysqlDT(row.eta),
            toMysqlDT(row.ets),
            row.orden || i + 1,
          ]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: manifiestoId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({
      error: err?.message || "Error creando manifiesto.",
    });
  } finally {
    conn.release();
  }
});


app.get("/manifiestos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1) Manifiesto
    const [mRows] = await pool.query(
      `SELECT
          id,
          servicio,
          nave,
          viaje,
          puerto_central AS puertoCentral,
          tipo_operacion AS tipoOperacion,
          operador_nave AS operadorNave,
          status,
          remark,
          emisor_documento AS emisorDocumento,
          representante,
          fecha_manifiesto_aduana AS fechaManifiestoAduana,
          numero_manifiesto_aduana AS numeroManifiestoAduana,
          created_at AS createdAt,
          updated_at AS updatedAt
       FROM manifiestos
       WHERE id = ?`,
      [id]
    );

    if (mRows.length === 0) return res.status(404).json({ error: "No existe" });
    const manifiesto = mRows[0];

    // 2) Itinerario
    const [iRows] = await pool.query(
      `SELECT
          id,
          port,
          port_type AS portType,
          eta,
          ets,
          orden,
          created_at AS createdAt
       FROM itinerarios
       WHERE manifiesto_id = ?
       ORDER BY orden ASC, id ASC`,
      [id]
    );

    res.json({ manifiesto, itinerario: iRows });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error cargando manifiesto" });
  }
});



const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
