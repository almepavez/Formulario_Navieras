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

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
