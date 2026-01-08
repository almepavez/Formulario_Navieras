const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");
const { parse: csvParse } = require("csv-parse/sync");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambialo';
const JWT_EXPIRES = '7d';

// ============================================
// MIDDLEWARE: Verificar JWT
// ============================================
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

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
// ============================================
// AUTH: LOGIN
// ============================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const [usuarios] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = true',
      [email.toLowerCase()]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = usuarios[0];

    if (!usuario.password) {
      return res.status(401).json({
        error: 'Esta cuenta fue creada con Google. Usa login de Google.'
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
      [usuario.id]
    );

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombre: usuario.nombre
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        foto_perfil: usuario.foto_perfil
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ============================================
// AUTH: VERIFICAR TOKEN
// ============================================
app.get("/api/auth/verificar", verificarToken, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, rol, foto_perfil FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true, usuario: usuarios[0] });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({ error: 'Error al verificar sesión' });
  }
});

// ============================================
// AUTH: LOGOUT
// ============================================
app.post("/api/auth/logout", verificarToken, async (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});


app.get("/manifiestos", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          m.id,
          s.codigo AS servicio,
          n.nombre AS nave,
          m.viaje,
          pc.nombre AS puertoCentral,
          m.tipo_operacion AS tipoOperacion,
          m.operador_nave AS operadorNave,
          m.status,
          m.remark,
          m.emisor_documento AS emisorDocumento,
          m.representante,
          m.fecha_manifiesto_aduana AS fechaManifiestoAduana,
          m.numero_manifiesto_aduana AS numeroManifiestoAduana,
          m.created_at AS createdAt,
          m.updated_at AS updatedAt
       FROM manifiestos m
       JOIN servicios s ON s.id = m.servicio_id
       JOIN naves n ON n.id = m.nave_id
       JOIN puertos pc ON pc.id = m.puerto_central_id
       ORDER BY m.created_at DESC
       LIMIT 20`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error listando manifiestos" });
  }
});



app.post("/manifiestos", async (req, res) => {
  const {
    servicio,        // EJ: "WSACL" (codigo)
    nave,            // EJ: "EVLOY" (codigo)
    puertoCentral,   // EJ: "CLVAP" (codigo)
    viaje,
    tipoOperacion,   // EX | IM | CROSS
    operadorNave,
    status,
    remark,
    emisorDocumento,
    representante,
    fechaManifiestoAduana,     // "YYYY-MM-DD"
    numeroManifiestoAduana,
    itinerario = [],           // [{ port:"CNHKG", portType:"LOAD", eta:"YYYY-MM-DDTHH:mm", ets:"..." }]
  } = req.body || {};

  // Validación mínima
  if (
    !servicio || !nave || !puertoCentral || !viaje || !tipoOperacion ||
    !operadorNave || !emisorDocumento || !representante ||
    !fechaManifiestoAduana || !numeroManifiestoAduana
  ) {
    return res.status(400).json({ error: "Faltan campos obligatorios del manifiesto." });
  }

  const allowedOps = new Set(["EX", "IM", "CROSS"]);
  if (!allowedOps.has(String(tipoOperacion).toUpperCase())) {
    return res.status(400).json({ error: "tipoOperacion inválido." });
  }

  const toMysqlDT = (v) => (v ? String(v).replace("T", " ") + ":00" : null);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Resolver IDs por código
    const [[servRow]] = await conn.query(
      "SELECT id FROM servicios WHERE codigo = ? LIMIT 1",
      [String(servicio).trim()]
    );
    if (!servRow) throw new Error(`Servicio no existe: ${servicio}`);

    const [[naveRow]] = await conn.query(
      "SELECT id FROM naves WHERE codigo = ? LIMIT 1",
      [String(nave).trim()]
    );
    if (!naveRow) throw new Error(`Nave no existe: ${nave}`);

    const [[pcRow]] = await conn.query(
      "SELECT id FROM puertos WHERE codigo = ? LIMIT 1",
      [String(puertoCentral).trim()]
    );
    if (!pcRow) throw new Error(`Puerto central no existe: ${puertoCentral}`);

    // 2) Insert manifiesto (con FKs)
    const [result] = await conn.query(
      `INSERT INTO manifiestos
        (servicio_id, nave_id, puerto_central_id,
         viaje, tipo_operacion, operador_nave,
         status, remark, emisor_documento, representante,
         fecha_manifiesto_aduana, numero_manifiesto_aduana)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        servRow.id,
        naveRow.id,
        pcRow.id,
        String(viaje).trim(),
        String(tipoOperacion).toUpperCase(),
        String(operadorNave).trim(),
        status || "En edición",
        remark || null,
        String(emisorDocumento).trim(),
        String(representante).trim(),
        fechaManifiestoAduana,
        String(numeroManifiestoAduana).trim(),
      ]
    );

    const manifiestoId = result.insertId;

    // 3) Insert itinerario (resuelve puerto_id por codigo)
    if (Array.isArray(itinerario) && itinerario.length > 0) {
      const toMysqlDT = (v) => (v ? String(v).replace("T", " ") + ":00" : null);

      for (let i = 0; i < itinerario.length; i++) {
        const row = itinerario[i];
        if (!row?.port || !row?.portType) continue;

        const pt = String(row.portType).toUpperCase();
        if (pt !== "LOAD" && pt !== "DISCHARGE") {
          throw new Error(`portType inválido en fila ${i + 1}`);
        }

        const portCode = String(row.port).trim();

        const [[pRow]] = await conn.query(
          "SELECT id FROM puertos WHERE codigo = ? LIMIT 1",
          [portCode]
        );
        if (!pRow) throw new Error(`Puerto no existe en fila ${i + 1}: ${portCode}`);

        await conn.query(
          `INSERT INTO itinerarios
            (manifiesto_id, puerto_id, port_type, eta, ets, orden)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            manifiestoId,
            pRow.id,
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
    res.status(500).json({ error: err?.message || "Error creando manifiesto." });
  } finally {
    conn.release();
  }
});



app.get("/manifiestos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [mRows] = await pool.query(
      `SELECT
          m.id,
          s.codigo AS servicio,
          n.nombre AS nave,
          m.viaje,
          pc.nombre AS puertoCentral,
          m.tipo_operacion AS tipoOperacion,
          m.operador_nave AS operadorNave,
          m.status,
          m.remark,
          m.emisor_documento AS emisorDocumento,
          m.representante,
          m.fecha_manifiesto_aduana AS fechaManifiestoAduana,
          m.numero_manifiesto_aduana AS numeroManifiestoAduana,
          m.created_at AS createdAt,
          m.updated_at AS updatedAt
       FROM manifiestos m
       JOIN servicios s ON s.id = m.servicio_id
       JOIN naves n ON n.id = m.nave_id
       JOIN puertos pc ON pc.id = m.puerto_central_id
       WHERE m.id = ?`,
      [id]
    );

    if (mRows.length === 0) return res.status(404).json({ error: "No existe" });

    const manifiesto = mRows[0];

    const [iRows] = await pool.query(
      `SELECT
          i.id,
          p.codigo AS port,
          p.nombre AS portNombre,
          i.port_type AS portType,
          i.eta,
          i.ets,
          i.orden,
          i.created_at AS createdAt
       FROM itinerarios i
       JOIN puertos p ON p.id = i.puerto_id
       WHERE i.manifiesto_id = ?
       ORDER BY i.orden ASC, i.id ASC`,
      [id]
    );

    res.json({ manifiesto, itinerario: iRows });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error cargando manifiesto" });
  }
});



// ============================================
// CRUD PUERTOS (codigo, nombre)
// ============================================

app.get("/api/mantenedores/puertos", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, created_at, updated_at FROM puertos ORDER BY codigo"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener puertos:", error);
    res.status(500).json({ error: "Error al obtener puertos" });
  }
});

app.get("/api/mantenedores/puertos/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, created_at, updated_at FROM puertos WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Puerto no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener puerto:", error);
    res.status(500).json({ error: "Error al obtener puerto" });
  }
});

app.post("/api/mantenedores/puertos", async (req, res) => {
  try {
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "INSERT INTO puertos (codigo, nombre) VALUES (?, ?)",
      [codigo.trim(), nombre.trim()]
    );

    res.status(201).json({ id: result.insertId, codigo: codigo.trim(), nombre: nombre.trim() });
  } catch (error) {
    console.error("Error al crear puerto:", error);
    res.status(500).json({ error: "Error al crear puerto" });
  }
});

app.put("/api/mantenedores/puertos/:id", async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    const { id } = req.params;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "UPDATE puertos SET codigo = ?, nombre = ? WHERE id = ?",
      [codigo.trim(), nombre.trim(), id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Puerto no encontrado" });

    res.json({ id: Number(id), codigo: codigo.trim(), nombre: nombre.trim() });
  } catch (error) {
    console.error("Error al actualizar puerto:", error);
    res.status(500).json({ error: "Error al actualizar puerto" });
  }
});

app.delete("/api/mantenedores/puertos/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM puertos WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Puerto no encontrado" });
    res.json({ message: "Puerto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar puerto:", error);
    res.status(500).json({ error: "Error al eliminar puerto" });
  }
});


// ============================================
// CRUD SERVICIOS (codigo, nombre, descripcion)
// ============================================

app.get("/api/mantenedores/servicios", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, descripcion, created_at, updated_at FROM servicios ORDER BY codigo"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    res.status(500).json({ error: "Error al obtener servicios" });
  }
});

app.get("/api/mantenedores/servicios/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, descripcion, created_at, updated_at FROM servicios WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener servicio:", error);
    res.status(500).json({ error: "Error al obtener servicio" });
  }
});

app.post("/api/mantenedores/servicios", async (req, res) => {
  try {
    const { codigo, nombre, descripcion } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "INSERT INTO servicios (codigo, nombre, descripcion) VALUES (?, ?, ?)",
      [codigo.trim(), nombre.trim(), descripcion ?? null]
    );

    res.status(201).json({
      id: result.insertId,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion ?? null,
    });
  } catch (error) {
    console.error("Error al crear servicio:", error);
    res.status(500).json({ error: "Error al crear servicio" });
  }
});

app.put("/api/mantenedores/servicios/:id", async (req, res) => {
  try {
    const { codigo, nombre, descripcion } = req.body;
    const { id } = req.params;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "UPDATE servicios SET codigo = ?, nombre = ?, descripcion = ? WHERE id = ?",
      [codigo.trim(), nombre.trim(), descripcion ?? null, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Servicio no encontrado" });

    res.json({
      id: Number(id),
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion ?? null,
    });
  } catch (error) {
    console.error("Error al actualizar servicio:", error);
    res.status(500).json({ error: "Error al actualizar servicio" });
  }
});

app.delete("/api/mantenedores/servicios/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM servicios WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json({ message: "Servicio eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar servicio:", error);
    res.status(500).json({ error: "Error al eliminar servicio" });
  }
});


// ============================================
// CRUD NAVES (codigo, nombre)
// ============================================

app.get("/api/mantenedores/naves", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, created_at, updated_at FROM naves ORDER BY nombre"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener naves:", error);
    res.status(500).json({ error: "Error al obtener naves" });
  }
});

app.get("/api/mantenedores/naves/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, created_at, updated_at FROM naves WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Nave no encontrada" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener nave:", error);
    res.status(500).json({ error: "Error al obtener nave" });
  }
});

app.post("/api/mantenedores/naves", async (req, res) => {
  try {
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "INSERT INTO naves (codigo, nombre) VALUES (?, ?)",
      [codigo.trim(), nombre.trim()]
    );

    res.status(201).json({
      id: result.insertId,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
    });
  } catch (error) {
    console.error("Error al crear nave:", error);
    res.status(500).json({ error: "Error al crear nave" });
  }
});

app.put("/api/mantenedores/naves/:id", async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    const { id } = req.params;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      "UPDATE naves SET codigo = ?, nombre = ? WHERE id = ?",
      [codigo.trim(), nombre.trim(), id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Nave no encontrada" });

    res.json({
      id: Number(id),
      codigo: codigo.trim(),
      nombre: nombre.trim(),
    });
  } catch (error) {
    console.error("Error al actualizar nave:", error);
    res.status(500).json({ error: "Error al actualizar nave" });
  }
});

app.delete("/api/mantenedores/naves/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM naves WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Nave no encontrada" });
    res.json({ message: "Nave eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar nave:", error);
    res.status(500).json({ error: "Error al eliminar nave" });
  }
});


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "uploads", "pms");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `manifiesto_${req.params.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

app.post("/manifiestos/:id/pms", upload.single("pms"), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: "Archivo no recibido (campo: pms)" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validar que el manifiesto exista
    const [mRows] = await conn.query("SELECT id FROM manifiestos WHERE id = ?", [id]);
    if (mRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Manifiesto no existe" });
    }

    // Guardar registro del archivo
    await conn.query(
      `INSERT INTO pms_archivos (manifiesto_id, nombre_original, path_archivo)
       VALUES (?, ?, ?)`,
      [id, req.file.originalname, req.file.path]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err?.message || "Error guardando PMS" });
  } finally {
    conn.release();
  }
});

app.get("/manifiestos/:id/pms", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, nombre_original AS nombreOriginal, path_archivo AS pathArchivo, created_at AS createdAt
       FROM pms_archivos
       WHERE manifiesto_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error cargando PMS" });
  }
});

// ===============================
// PMS TXT (00/11/12/13/.../99)
// ===============================
function parseYYYYMMDD(s) {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseYYYYMMDDHHMM(s) {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:00`;
}

// FPRES desde línea 00 (12 dígitos: YYYYMMDDHHMM)
function extractFPRESFrom00(line00) {
  const m = String(line00 || "").match(/\b(\d{12})\b/);
  return m ? parseYYYYMMDDHHMM(m[1]) : null;
}

// FEM desde línea 11 (toma el 2do YYYYMMDD del bloque 16 dígitos)
function extractFEMFrom11(line11) {
  const m = String(line11 || "").match(/(\d{8})(\d{8})/); // sin \b para evitar casos pegados a letras
  if (!m) return null;
  return parseYYYYMMDD(m[2]);
}

// Busca la 14 "buena" que tenga dos fechas-hora de 12 dígitos
function pickBest14(bLines) {
  return (
    bLines.find((l) => lineCode(l) === "14" && /\d{12}\d{12}/.test(l)) ||
    bLines.find((l) => lineCode(l) === "14") ||
    ""
  );
}

function extractFEMBFrom14(line14) {
  const m = String(line14 || "").match(/(\d{12})\s*(\d{12})/);
  return m ? parseYYYYMMDDHHMM(m[1]) : null;
}

function extractFZARPEFrom14(line14) {
  const m = String(line14 || "").match(/(\d{12})\s*(\d{12})/);
  return m ? parseYYYYMMDDHHMM(m[1]) : null;
}

function extractUnitsFrom41(line41) {
  // En tus ejemplos termina con "...KGMMTQY"
  const s = String(line41 || "");
  const m = s.match(/([A-Z]{3})([A-Z]{3})Y\s*$/);
  if (!m) return { unidadPeso: null, unidadVolumen: null };
  return { unidadPeso: m[1], unidadVolumen: m[2] };
}

function extractWeightVolumeFrom41(line41) {
  // Ejemplo:
  // 41 001 Y000001000100011646000 00000179200000017920....KGMMTQY
  const s = String(line41 || "");

  // 1) bloque que viene después de la Y (termina antes del siguiente espacio)
  const y = s.match(/Y(\d{10,})/);
  let peso = null;
  if (y && y[1]) {
    const digits = y[1];
    const last9 = digits.slice(-9); // peso * 1000 con padding
    const n = Number(last9);
    if (Number.isFinite(n)) peso = n / 1000;
  }

  // 2) siguiente bloque numérico grande (volumen * 1000 con padding)
  // buscamos el primer "token" de dígitos grande después del bloque Y...
  // y tomamos sus últimos 8 dígitos (ej: 00017920 => 17.920)
  let volumen = null;
  const afterY = y ? s.slice(s.indexOf(y[0]) + y[0].length) : s;
  const v = afterY.match(/\s(\d{8,})/);
  if (v && v[1]) {
    const digits = v[1];
    const last8 = digits.slice(-8);
    const n = Number(last8);
    if (Number.isFinite(n)) volumen = n / 1000;
  }

  return { peso, volumen };
}

function normalizeStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function safeNumberFromText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitLines(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

function lineCode(line) {
  return String(line || "").slice(0, 2);
}

function pickFirst(lines, code) {
  return lines.find((l) => lineCode(l) === code) || "";
}

function pickAll(lines, code) {
  return lines.filter((l) => lineCode(l) === code);
}

// --------- Extractores PMS ---------

function extractServiceCodeFrom12(line12) {
  // Ej: "... TWKHHCLVAPFF  YY ..." -> FF
  const m = String(line12).match(/([A-Z]{5})([A-Z]{5})([A-Z]{2})\s+[A-Z]{2}/);
  return m ? normalizeStr(m[3]) : "";
}

function extractBLNumber(line12) {
  const m = String(line12).match(/^12\s*([A-Z0-9]+)/);
  return normalizeStr(m?.[1] || "");
}

function extractPOLPOD(line13) {
  const m = String(line13).match(/13\s+([A-Z]{5})([A-Z]{5})/);
  if (!m) return { pol: "", pod: "" };
  return { pol: normalizeStr(m[1]), pod: normalizeStr(m[2]) };
}

function extractWeightFrom12(line12) {
  const m = String(line12).match(/KGS\s*([0-9.,]+)/i);
  return safeNumberFromText(m?.[1] || null);
}

function extractPartyName(line) {
  if (!line) return "";
  const body = line.slice(2);
  const m = body.match(/[A-Z0-9]{2,}\s+([A-Z0-9][A-Z0-9\s\.,&'\-\/]{5,})/i);
  return normalizeStr(m?.[1] || "");
}

function extractDescripcionFrom41(line41) {
  return normalizeStr(String(line41 || "").slice(2));
}

function extractItemNoFrom41(line41) {
  const m = String(line41).match(/^41\s+(\d{3})\b/);
  return m ? m[1] : "";
}

function countItemsFrom41(lines41) {
  const set = new Set();
  for (const l of lines41) {
    const it = extractItemNoFrom41(l);
    if (it) set.add(it);
  }
  return set.size || null;
}

/**
 * ✅ BULTOS = TOTAL CONTENEDORES
 * Lo más fiable en PMS es leer líneas 51.
 * Cada 51 corresponde a un contenedor (trae sigla+numero+digito).
 * Contamos contenedores únicos por código: ABCD1234567 (o ABCD1234560 etc)
 */
function extractContainerCodeFrom51(line51) {
  // Ej: "51   002003BSIU8004381N45G1F..."
  // Buscamos: 4 letras + 7 dígitos (formato estándar contenedor)
  const m = String(line51).match(/\b([A-Z]{4}\d{7})\b/);
  return m ? m[1] : "";
}

function countContainersFrom51(lines51) {
  const set = new Set();
  for (const l of lines51) {
    const code = extractContainerCodeFrom51(l);
    if (code) set.add(code);
  }
  // Si por algún motivo no matchea el patrón, fallback a "cantidad de líneas 51"
  if (set.size > 0) return set.size;
  return lines51.length || null;
}

// ---- UNIDADES (desde línea 51) ----
// En PMS PIL suele venir "...KGMMTQ" (unidad peso KGM, unidad volumen MTQ)
function extractUnitsFrom51(lines51) {
  const text = normalizeStr(lines51.join(" "));
  const m = text.match(/\b([A-Z]{3})([A-Z]{3})\b/); // KGM MTQ
  if (!m) return { unidadPeso: null, unidadVolumen: null };
  return { unidadPeso: m[1], unidadVolumen: m[2] };
}

// ---- VOLUMEN por contenedor (desde línea 51) ----
// En ejemplos: ...000000000017920 CS  => 17.920
//             ...000000000050000 CT  => 50.000
function extractVolumeFrom51(line51) {
  if (!line51) return null;

  // buscamos el ÚLTIMO grupo de 6 dígitos antes del "CT/CS/.."
  const matches = Array.from(String(line51).matchAll(/(\d{6})\s+[A-Z]{2}\b/g));
  if (!matches.length) return null;

  const last = matches[matches.length - 1][1]; // ej "017920"
  const n = Number(last);
  if (!Number.isFinite(n)) return null;

  return n / 1000; // 017920 => 17.920
}

function sumVolumeFrom51(lines51) {
  let sum = 0;
  let found = false;

  for (const l of lines51) {
    const v = extractVolumeFrom51(l);
    if (typeof v === "number") {
      sum += v;
      found = true;
    }
  }

  // redondeo a 3 decimales para decimal(12,3)
  return found ? Math.round(sum * 1000) / 1000 : null;
}

// Agrupa en bloques BL, pero “arrastra” el último 00 y 11 hacia cada bloque
function splitIntoBLBlocks(lines) {
  const blocks = [];
  let current = null;

  let last00 = "";
  let last11 = "";

  for (const line of lines) {
    const code = lineCode(line);

    if (code === "00") {
      last00 = line;
      continue;
    }

    if (code === "11") {
      last11 = line;
      continue;
    }

    if (code === "12") {
      if (current && current.length) blocks.push(current);

      current = [];
      if (last00) current.push(last00);
      if (last11) current.push(last11);
      current.push(line);
      continue;
    }

    if (code === "99") {
      if (current && current.length) blocks.push(current);
      current = null;
      continue;
    }

    if (current) current.push(line);
  }

  if (current && current.length) blocks.push(current);
  return blocks;
}

function cleanMysqlDate(v) {
  if (!v) return null;
  const s = String(v)
    .replace(/\u00A0/g, " ")     // NBSP -> space
    .replace(/\s+/g, " ")       // colapsa espacios raros
    .trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function cleanMysqlDateTime(v) {
  if (!v) return null;
  const s = String(v)
    .replace(/\u00A0/g, " ")     // NBSP -> space
    .replace(/\s+/g, " ")       // colapsa espacios raros
    .trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? s : null;
}

function parsePmsTxt(content) {
  const lines = splitLines(content);
  const blocks = splitIntoBLBlocks(lines);

  // ✅ Header global (viene una sola vez en el archivo)
  const header00 = pickFirst(lines, "00");
  const header11 = pickFirst(lines, "11");

  const fechaPresentacionGlobal = extractFPRESFrom00(header00); // FPRES
  const fechaEmisionGlobal = extractFEMFrom11(header11);        // FEM (DATE)

  return blocks
    .map((bLines) => {
      const l12 = pickFirst(bLines, "12");
      const blNumber = extractBLNumber(l12);
      if (!blNumber) return null;

      const tipoServicioCod = extractServiceCodeFrom12(l12);

      const l13 = pickFirst(bLines, "13");
      const { pol, pod } = extractPOLPOD(l13);

      const shipper = extractPartyName(pickFirst(bLines, "16"));
      const consignee = extractPartyName(pickFirst(bLines, "21"));
      const notify = extractPartyName(pickFirst(bLines, "26"));

      const lines41 = pickAll(bLines, "41");
      const totalItems = countItemsFrom41(lines41);

      const descripcion = lines41.length
        ? lines41.map(extractDescripcionFrom41).filter(Boolean).join(" | ")
        : null;

      // ✅ unidades + sumas desde 41
      let unidadPeso = null;
      let unidadVolumen = null;
      let totalVolumen = 0;
      let foundVol = false;

      for (const l41 of lines41) {
        const u = extractUnitsFrom41(l41);
        if (!unidadPeso && u.unidadPeso) unidadPeso = u.unidadPeso;
        if (!unidadVolumen && u.unidadVolumen) unidadVolumen = u.unidadVolumen;

        const { volumen } = extractWeightVolumeFrom41(l41);
        if (typeof volumen === "number") {
          foundVol = true;
          totalVolumen += volumen;
        }
      }

      // redondeo a 3 decimales (decimal(12,3))
      totalVolumen = Math.round(totalVolumen * 1000) / 1000;

      // ✅ Fechas: FPRES/FEM globales + FEMB/FZARPE desde 14
      const lines14 = pickAll(bLines, "14");
      // nos quedamos con el 14 que tenga 2 timestamps (YYYYMMDDHHMMYYYYMMDDHHMM)
      const l14 = lines14.find((l) => /(\d{12})\s*(\d{12})/.test(l)) || pickBest14(bLines) || "";

      const fechaPresentacion = fechaPresentacionGlobal; // FPRES
      const fechaEmision = fechaEmisionGlobal;           // FEM (DATE)
      const fechaEmbarque = l14 ? extractFEMBFrom14(l14) : null; // FEMB
      const fechaZarpe = l14 ? extractFZARPEFrom14(l14) : null;  // FZARPE (provisional)

      const lines51 = pickAll(bLines, "51");
      const totalContainers = countContainersFrom51(lines51);

      const weightKgs = extractWeightFrom12(l12);

      return {
        blNumber,
        tipoServicioCod,
        pol,
        pod,
        shipper,
        consignee,
        notify,
        descripcion_carga: descripcion,
        peso_bruto: weightKgs,
        unidad_peso: unidadPeso,                 // ✅
        volumen: foundVol ? totalVolumen : 0,    // ✅ (si no encontró, queda 0 como acordamos)
        unidad_volumen: unidadVolumen,           // ✅
        bultos: totalContainers,
        total_items: totalItems,
        fecha_presentacion: fechaPresentacion,
        fecha_emision: fechaEmision,
        fecha_embarque: fechaEmbarque,
        fecha_zarpe: fechaZarpe,
      };
    })
    .filter(Boolean);
}


function parsePmsByFile(filename, content) {
  const ext = (path.extname(filename || "") || "").toLowerCase();
  if (!ext || ext === ".txt" || ext === ".pms" || ext === ".dat") return parsePmsTxt(content);
  throw new Error(`Formato no soportado: ${ext}. Usa .txt (PMS por líneas)`);
}

async function getPuertoIdByCodigo(conn, codigo) {
  const c = normalizeStr(codigo).toUpperCase();
  if (!c) return null;
  const [rows] = await conn.query("SELECT id FROM puertos WHERE codigo = ? LIMIT 1", [c]);
  return rows.length ? rows[0].id : null;
}

async function getTipoServicioIdByCodigo(conn, codigo2) {
  const c = normalizeStr(codigo2).toUpperCase();
  if (!c) return null;
  const [rows] = await conn.query("SELECT id FROM tipos_servicio WHERE codigo = ? LIMIT 1", [c]);
  return rows.length ? rows[0].id : null;
}

// ✅ POST para procesar el PMS TXT y crear BLs
app.post("/manifiestos/:id/pms/procesar", async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [mRows] = await conn.query("SELECT id FROM manifiestos WHERE id = ?", [id]);
    if (mRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Manifiesto no existe" });
    }

    const [pRows] = await conn.query(
      `SELECT id, nombre_original AS nombreOriginal, path_archivo AS pathArchivo
       FROM pms_archivos
       WHERE manifiesto_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );
    if (pRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Este manifiesto no tiene PMS cargado" });
    }

    const pms = pRows[0];

    const absPath = path.isAbsolute(pms.pathArchivo)
      ? pms.pathArchivo
      : path.join(__dirname, pms.pathArchivo);

    if (!fs.existsSync(absPath)) {
      await conn.rollback();
      return res.status(400).json({ error: "Archivo PMS no encontrado en disco" });
    }

    const content = fs.readFileSync(absPath, "utf-8");

    const bls = parsePmsByFile(pms.nombreOriginal, content);
    if (!Array.isArray(bls) || bls.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "No se encontraron BLs en el PMS" });
    }

    await conn.query("DELETE FROM bls WHERE manifiesto_id = ?", [id]);

    const insertSql = `
      INSERT INTO bls
        (manifiesto_id, bl_number, tipo_servicio_id,
        shipper, consignee, notify_party,
        puerto_origen_id, puerto_destino_id,
        descripcion_carga,
        peso_bruto, unidad_peso,
        volumen, unidad_volumen,
        bultos, total_items,
        fecha_emision, fecha_presentacion, fecha_embarque, fecha_zarpe,
        status)
      VALUES
        (?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        'CREADO')
    `;

    for (const b of bls) {
      const puertoOrigenId = await getPuertoIdByCodigo(conn, b.pol);
      const puertoDestinoId = await getPuertoIdByCodigo(conn, b.pod);
      const tipoServicioId = await getTipoServicioIdByCodigo(conn, b.tipoServicioCod);

      await conn.query(insertSql, [
        id,
        b.blNumber,
        tipoServicioId,

        b.shipper || null,
        b.consignee || null,
        b.notify || null,

        puertoOrigenId,
        puertoDestinoId,

        b.descripcion_carga || null,

        b.peso_bruto ?? null,
        b.unidad_peso || null,

        b.volumen ?? null,
        b.unidad_volumen || null,

        b.bultos ?? null,
        b.total_items ?? null,

        cleanMysqlDate(b.fecha_emision),
        cleanMysqlDateTime(b.fecha_presentacion),
        cleanMysqlDateTime(b.fecha_embarque),
        cleanMysqlDateTime(b.fecha_zarpe),
      ]);
    }

    await conn.commit();
    res.json({ ok: true, pmsId: pms.id, inserted: bls.length, sample: bls.slice(0, 2) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err?.message || "Error procesando PMS" });
  } finally {
    conn.release();
  }
});

// ============================================
// 🆕 PUT /manifiestos/:id - Actualizar manifiesto
// ============================================
app.put("/manifiestos/:id", async (req, res) => {
  const { id } = req.params;
  const {
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
  if (!operadorNave || !emisorDocumento || !representante || !fechaManifiestoAduana || !numeroManifiestoAduana) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verificar que el manifiesto existe
    const [mRows] = await conn.query("SELECT id FROM manifiestos WHERE id = ?", [id]);
    if (mRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Manifiesto no encontrado" });
    }

    // Actualizar manifiesto
    await conn.query(
      `UPDATE manifiestos 
       SET operador_nave = ?,
           status = ?,
           remark = ?,
           emisor_documento = ?,
           representante = ?,
           fecha_manifiesto_aduana = ?,
           numero_manifiesto_aduana = ?
       WHERE id = ?`,
      [
        String(operadorNave).trim(),
        status || "En edición",
        remark || null,
        String(emisorDocumento).trim(),
        String(representante).trim(),
        fechaManifiestoAduana,
        String(numeroManifiestoAduana).trim(),
        id,
      ]
    );

    // Actualizar itinerario (solo fechas ETA y ETS)
    if (Array.isArray(itinerario) && itinerario.length > 0) {
      for (const it of itinerario) {
        if (!it.id) continue;

        // Convertir fechas ISO del frontend a MySQL DATETIME
        const etaMysql = it.eta ? String(it.eta).replace("T", " ") + ":00" : null;
        const etsMysql = it.ets ? String(it.ets).replace("T", " ") + ":00" : null;

        await conn.query(
          `UPDATE itinerarios 
           SET eta = ?, ets = ?
           WHERE id = ? AND manifiesto_id = ?`,
          [etaMysql, etsMysql, it.id, id]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Manifiesto actualizado correctamente" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err?.message || "Error actualizando manifiesto" });
  } finally {
    conn.release();
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
