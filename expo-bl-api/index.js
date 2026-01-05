const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");


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

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
