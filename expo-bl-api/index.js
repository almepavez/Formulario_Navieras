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
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

dotenv.config();

const app = express();

// ============================================
// CONFIGURACIÓN DE MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || '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',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================================
// CONFIGURAR EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ============================================
// JWT CONFIG
// ============================================
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

// ============================================
// DATABASE POOL
// ============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});

// ============================================
// LISTA BLANCA DE EMAILS
// ============================================
const EMAILS_PERMITIDOS = {
  'inunez@broomgroup.com': 'admin',
  'apavez@broomgroup.com': 'admin',
  'iriffo@broomgroup.com': 'admin',
  'iriffo@broomgroup.cl': 'operador',
};

// 🔒 FUNCIÓN AUXILIAR: Verificar email autorizado
function esEmailAutorizado(email) {
  const emailLower = String(email || '').toLowerCase().trim();
  return EMAILS_PERMITIDOS.hasOwnProperty(emailLower);
}
// ============================================
// GOOGLE STRATEGY
// ============================================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:4000/api/auth/google/callback"
},
  async function (accessToken, refreshToken, profile, cb) {
    try {
      const email = profile.emails[0].value.toLowerCase();
      const nombre = profile.displayName;
      const foto = profile.photos[0]?.value || null;
      const googleId = profile.id;

      if (!EMAILS_PERMITIDOS[email]) {
        console.log(`❌ Acceso denegado: ${email}`);
        return cb(null, false, {
          message: 'No tienes autorización para acceder a este sistema'
        });
      }

      const rolAsignado = EMAILS_PERMITIDOS[email];
      console.log(`✅ Acceso permitido: ${email} (${rolAsignado})`);

      const [usuarios] = await pool.query(
        'SELECT * FROM usuarios WHERE email = ?',
        [email]
      );

      let usuario;

      if (usuarios.length > 0) {
        usuario = usuarios[0];

        if (!usuario.activo) {
          console.log(`⚠️ Usuario desactivado: ${email}`);
          return cb(null, false, {
            message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
          });
        }

        await pool.query(
          `UPDATE usuarios 
           SET google_id = ?, 
               foto_perfil = ?,
               rol = ?,
               ultimo_acceso = NOW()
           WHERE id = ?`,
          [googleId, foto, rolAsignado, usuario.id]
        );

        usuario.foto_perfil = foto;
        usuario.rol = rolAsignado;
      } else {
        console.log(`🆕 Creando nuevo usuario: ${email}`);

        const [result] = await pool.query(
          `INSERT INTO usuarios 
           (nombre, email, google_id, foto_perfil, rol, activo, ultimo_acceso)
           VALUES (?, ?, ?, ?, ?, true, NOW())`,
          [nombre, email, googleId, foto, rolAsignado]
        );

        usuario = {
          id: result.insertId,
          nombre,
          email,
          google_id: googleId,
          foto_perfil: foto,
          rol: rolAsignado,
          activo: true
        };
      }

      return cb(null, usuario);
    } catch (error) {
      console.error('Error en Google Strategy:', error);
      return cb(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, rol, foto_perfil FROM usuarios WHERE id = ?',
      [id]
    );
    done(null, usuarios[0]);
  } catch (error) {
    done(error);
  }
});

// ============================================
// HELPER: Enviar Email
// ============================================
async function enviarEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"SGA Broom Group" <noreply@broomgroup.cl>',
      to,
      subject,
      html,
    });
    console.log('✅ Email enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
}

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

app.get("/health", async (_req, res) => {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  res.json({ ok: true });
});

// Login tradicional
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

// Google OAuth
app.get('/api/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'  // 🆕 Fuerza a elegir cuenta
  })
);

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login?error=auth_failed' }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        {
          id: req.user.id,
          email: req.user.email,
          rol: req.user.rol,
          nombre: req.user.nombre
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Error en callback de Google:', error);
      res.redirect('http://localhost:5173/login?error=auth_failed');
    }
  }
);

// Verificar token
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

// Logout
app.post("/api/auth/logout", verificarToken, async (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

// ============================================
// 🆕 RUTAS DE RECUPERACIÓN DE CONTRASEÑA
// ============================================

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    const emailLower = email.toLowerCase().trim();

    // 🔒 SEGURIDAD: Verificar que el email esté en la lista blanca
    if (!esEmailAutorizado(emailLower)) {
      // Retornar el mismo mensaje para no revelar si el email existe o no
      return res.json({
        success: true,
        message: 'Si el correo existe, recibirás un código de recuperación'
      });
    }

    // Verificar que el usuario existe y está activo
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, activo FROM usuarios WHERE email = ?',
      [emailLower]
    );

    if (usuarios.length === 0 || !usuarios[0].activo) {
      return res.json({
        success: true,
        message: 'Si el correo existe, recibirás un código de recuperación'
      });
    }

    const usuario = usuarios[0];
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date();
    expiracion.setMinutes(expiracion.getMinutes() + 15);

    await pool.query(
      `UPDATE usuarios 
       SET reset_code = ?,
           reset_code_expires = ?
       WHERE id = ?`,
      [codigo, expiracion, usuario.id]
    );

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0F2A44; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; }
          .code-box { 
            background-color: white; 
            border: 2px dashed #0F2A44; 
            padding: 20px; 
            text-align: center; 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 5px;
            color: #0F2A44;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${usuario.nombre}</strong>,</p>
            <p>Tu código de verificación es:</p>
            <div class="code-box">${codigo}</div>
            <p>Este código es válido por <strong>15 minutos</strong>.</p>
            <p>Si no solicitaste este código, ignora este mensaje.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Broom Group</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await enviarEmail(
      usuario.email,
      'Código de recuperación - SGA Broom Group',
      emailHtml
    );

    res.json({
      success: true,
      message: 'Si el correo existe, recibirás un código de recuperación'
    });

  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});


// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        error: 'Email, código y nueva contraseña son requeridos'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const emailLower = email.toLowerCase().trim();

    // 🔒 SEGURIDAD: Verificar que el email esté en la lista blanca
    if (!esEmailAutorizado(emailLower)) {
      return res.status(400).json({
        error: 'Código inválido o expirado'
      });
    }

    const [usuarios] = await pool.query(
      `SELECT id, nombre, email 
       FROM usuarios 
       WHERE email = ? 
       AND reset_code = ? 
       AND reset_code_expires > NOW()
       AND activo = true`,
      [emailLower, code]
    );

    if (usuarios.length === 0) {
      return res.status(400).json({
        error: 'Código inválido o expirado'
      });
    }

    const usuario = usuarios[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE usuarios 
       SET password = ?,
           reset_code = NULL,
           reset_code_expires = NULL
       WHERE id = ?`,
      [hashedPassword, usuario.id]
    );

    console.log(`✅ Contraseña restablecida para: ${emailLower}`);

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });

  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// POST /api/auth/verify-code
app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son requeridos' });
    }

    const emailLower = email.toLowerCase().trim();

    // 🔒 SEGURIDAD: Verificar que el email esté en la lista blanca
    if (!esEmailAutorizado(emailLower)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido o expirado'
      });
    }

    const [usuarios] = await pool.query(
      `SELECT id FROM usuarios 
       WHERE email = ? 
       AND reset_code = ? 
       AND reset_code_expires > NOW()
       AND activo = true`,
      [emailLower, code]
    );

    if (usuarios.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido o expirado'
      });
    }

    res.json({
      success: true,
      message: 'Código válido'
    });

  } catch (error) {
    console.error('Error en verify-code:', error);
    res.status(500).json({ error: 'Error al verificar código' });
  }
});

// ============================================
// AQUÍ VA TODO TU CÓDIGO EXISTENTE DE MANIFIESTOS, BLS, ETC.


// [... resto de tus rutas de manifiestos, puertos, servicios, naves, BLs, etc ...]
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

// GET - Obtener lista de puertos para los selectores (SIN /api/mantenedores)
app.get("/puertos", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, codigo, nombre, pais FROM puertos ORDER BY nombre"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener puertos:", error);
    res.status(500).json({ error: "Error al obtener puertos" });
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


// ===============================
// LOCACIONES desde PMS
// ===============================

// LE desde línea 74: "74   CLSCL20251125..."
// => devuelve "CLSCL"
function extractLugarEmisionFrom74(lines) {
  const l74 = [...lines].reverse().find((l) => lineCode(l) === "74") || "";
  const m = String(l74).match(/^74\s+([A-Z]{5})/);
  return m ? m[1] : "";
}

// Elige la 14 "principal" para fechas: 01SH si existe; si no, primera con 2 timestamps
function pickMain14ForDates(lines14) {
  if (!Array.isArray(lines14) || lines14.length === 0) return "";
  const withDates = lines14.filter((l) => /(\d{12})\s*(\d{12})/.test(l));
  if (withDates.length === 0) return lines14[0] || "";

  const main = withDates.find((l) => /\b01SH/.test(l));
  return main || withDates[0] || "";
}

// Extrae PE/PD desde una línea 14:
// "14   01SHCLVAPTWKHH..." => PE=CLVAP, PD=TWKHH
function extractPEPDFrom14(line14) {
  const s = String(line14 || "");
  const m = s.match(/\b\d{2}SH([A-Z]{5})([A-Z]{5})/);
  if (!m) return { pe: "", pd: "" };
  return { pe: m[1], pd: m[2] };
}

// Reglas:
// - Normal (1 sola 14): PE/PD = esa 14
// - Transbordo (varias 14): PE = primera 14 (01SH si existe, si no la primera válida)
//                           PD = última 14 válida (mayor "xxSH", o última por orden de aparición)
function pickPEPD(lines14) {
  const arr = Array.isArray(lines14) ? lines14 : [];
  const parsed = arr
    .map((l, idx) => {
      const step = (() => {
        const m = String(l).match(/\b(\d{2})SH/);
        return m ? Number(m[1]) : null;
      })();

      const { pe, pd } = extractPEPDFrom14(l);
      return { idx, step, pe, pd, raw: l };
    })
    .filter((x) => x.pe && x.pd);

  if (parsed.length === 0) return { pe: "", pd: "" };

  // Preferir orden por step si existe, si no por idx
  const hasSteps = parsed.some((x) => Number.isFinite(x.step));
  const ordered = [...parsed].sort((a, b) => {
    if (hasSteps) {
      const sa = Number.isFinite(a.step) ? a.step : 999;
      const sb = Number.isFinite(b.step) ? b.step : 999;
      if (sa !== sb) return sa - sb;
    }
    return a.idx - b.idx;
  });

  // PE: idealmente la 01SH si está
  const first01 = ordered.find((x) => x.step === 1);
  const first = first01 || ordered[0];

  // PD: última del orden
  const last = ordered[ordered.length - 1];

  return { pe: first.pe, pd: last.pd };
}

// --------- Extractores PMS ---------

function itemNoFromLine(line, tag) {
  // tag "41"/"44"/"47" con formato: "41   001 ...."
  const m = String(line || "").match(new RegExp(`^${tag}\\s+(\\d{3})`));
  return m ? parseInt(m[1], 10) : null;
}

function extractItemNumbersSet(bLines) {
  const set = new Set();
  for (const t of ["41", "44", "47"]) {
    for (const l of pickAll(bLines, t)) {
      const n = itemNoFromLine(l, t);
      if (n) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function extractMarcasForItem(lines44, itemNo) {
  return lines44
    .filter(l => itemNoFromLine(l, "44") === itemNo)
    .map(l => String(l).replace(/^44\s+\d{3}/, "").trim())
    .filter(Boolean)
    .join(" | ") || null;
}

function extractDescripcionForItem(lines47, itemNo) {
  return lines47
    .filter(l => itemNoFromLine(l, "47") === itemNo)
    .map(l => String(l).replace(/^47\s+\d{3}/, "").trim())
    .filter(Boolean)
    .join(" ") || null;
}

// Si ya tienes extractWeightVolumeFrom41 / extractUnitsFrom41, úsalas acá.
function extractPesoVolDesde41(lines41, itemNo) {
  const l41 = lines41.find(l => itemNoFromLine(l, "41") === itemNo);
  if (!l41) return { peso_bruto: null, volumen: null, unidad_peso: null, unidad_volumen: null };

  const { peso, volumen } = extractWeightVolumeFrom41(l41) || {};
  const u = extractUnitsFrom41(l41) || {};

  return {
    peso_bruto: typeof peso === "number" ? peso : null,
    volumen: typeof volumen === "number" ? volumen : null,
    unidad_peso: u.unidadPeso || null,
    unidad_volumen: u.unidadVolumen || null,
  };
}

function extractItemsFromBL(bLines) {
  const lines41 = pickAll(bLines, "41");
  const lines44 = pickAll(bLines, "44");
  const lines47 = pickAll(bLines, "47");

  const itemNos = extractItemNumbersSet(bLines);

  return itemNos.map((n) => {
    const marcas = extractMarcasForItem(lines44, n);
    const descripcion = extractDescripcionForItem(lines47, n);
    const wv = extractPesoVolDesde41(lines41, n);

    // Por ahora: carga_peligrosa siempre "N" si no la tienes en otra parte
    const carga_peligrosa = "N";

    return {
      numero_item: n,
      descripcion: descripcion || null,
      marcas: marcas || null,
      carga_peligrosa,
      // tipo_bulto/cantidad: si ya los estás derivando, ponlos acá; si no, null por ahora
      tipo_bulto: null,
      cantidad: null,
      ...wv,
      carga_cnt: "S", // en tu XML está así; si lo quieres desde 51/otros, después lo refinamos
    };
  });
}



function parseLine51(raw) {
  const line = String(raw || "").toUpperCase();

  // item y sec: 001001
  const mHead = line.match(/^51\s+(\d{3})(\d{3})/);
  const itemNo = mHead ? parseInt(mHead[1], 10) : null;
  const seqNo = mHead ? parseInt(mHead[2], 10) : null;

  // contenedor ISO11: ABCD1234567
  const mCont = line.match(/([A-Z]{4}\d{7})/);
  if (!mCont) return null;

  const codigo = mCont[1];
  const sigla = codigo.slice(0, 4);
  const numero = codigo.slice(4, 10);
  const digito = codigo.slice(10, 11);

  // tipo_cnt: N22G1F / N45G1F
  const mTipo = line.match(/N(\d{2}[A-Z]\d)F/);
  const tipo_cnt = mTipo ? mTipo[1] : null;

  const unidad_peso = line.includes("KGM") ? "KGM" : null;
  const unidad_volumen = line.includes("MTQ") ? "MTQ" : null;

  let peso = null;
  let volumen = null;

  // ✅ FIX: después de CASE viene peso(10) + otro(10) + (volumen + sello(6))
  const idxCase = line.indexOf("CASE");
  if (idxCase !== -1) {
    const after = line.slice(idxCase + 4);
    const onlyDigits = after.replace(/\D/g, "");

    // mínimo: 10 + 10 + 6 (sello) = 26
    if (onlyDigits.length >= 26) {
      const w10 = onlyDigits.slice(0, 10);
      const tail = onlyDigits.slice(20); // volumen + sello(6)
      const volDigits = tail.length > 6 ? tail.slice(0, -6) : "";

      if (/^\d{10}$/.test(w10)) peso = parseInt(w10, 10) / 10000;
      if (volDigits && /^\d+$/.test(volDigits)) volumen = parseInt(volDigits, 10) / 1000;
    }
  }

  // sellos (CL + dígitos)
  const sellos = [];
  const mSeal = line.match(/(CL\d{6,})/g);
  if (mSeal) for (const s of mSeal) if (!sellos.includes(s)) sellos.push(s);

  return {
    itemNo,
    seqNo,
    codigo,
    sigla,
    numero,
    digito,
    tipo_cnt,
    carga_cnt: "S",
    peso,
    unidad_peso,
    volumen,
    unidad_volumen,
    sellos,
  };
}

function extractContainersFrom51(lines51) {
  if (!Array.isArray(lines51)) return [];
  const out = [];

  for (const l of lines51) {
    const c = parseLine51(l);
    if (c) out.push(c);
  }

  const seen = new Set();
  return out.filter(c => c.codigo && !seen.has(c.codigo) && seen.add(c.codigo));
}

function splitContainerCode(iso11) {
  const s = String(iso11 || "").trim().toUpperCase();
  const m = s.match(/^([A-Z]{4})(\d{6})(\d)$/);
  if (!m) return { codigo: null, sigla: null, numero: null, digito: null };
  return { codigo: m[1] + m[2] + m[3], sigla: m[1], numero: m[2], digito: m[3] };
}

function extractTipoCntFrom51(line) {
  const s = String(line || "").toUpperCase();

  // Caso real PMS: ...N45G1F... / ...N45R1F...
  // (no hay espacios, así que NO uses \b)
  let m = s.match(/N(\d{2}[A-Z]\d)/);  // 45G1, 45R1, 22G1, etc
  if (m) return m[1];

  // Fallback por si alguna vez viene sin N (raro, pero seguro)
  m = s.match(/(\d{2}[A-Z]\d)/);
  return m ? m[1] : null;
}


function extractSellosFrom51(line) {
  // Heurística segura:
  // - después del tipo de empaque (PE/CT/CS/PK/etc) suelen venir 1..n sellos
  // - en tu PMS: "PE   243379              CL006167"
  const s = String(line || "");

  // Intento 1: capturar segmento luego de " PE " (o CT/CS/PK) hasta fin
  const m = s.match(/\b(?:PE|CT|CS|PK|BX|BG)\b([\s\S]*)$/);
  if (!m) return [];

  const tail = m[1];

  // Tokens: alfanuméricos “de sello” (6 a 35 chars), descartando basura típica
  const tokens = tail
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => /^[A-Z0-9-]{6,35}$/i.test(t))
    .filter(t => !/^(KGM|MTQ|PCS|PACKAGE|CARTON|PALLET|BAG|CASE|CT|CS|PE)$/i.test(t));

  // Dedupe preservando orden
  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    const up = t.toUpperCase();
    if (!seen.has(up)) {
      seen.add(up);
      out.push(up);
    }
  }

  // OJO: si por algún PMS raro se “cuelan” tokens que no son sellos,
  // igual no rompe nada: solo insertas sellos válidos si quieres.
  return out;
}

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

async function getTipoBultoFromTipoCnt(conn, tipoCnt) {
  if (!tipoCnt) return null;
  const [rows] = await conn.query(
    "SELECT tipo_bulto FROM tipo_cnt_tipo_bulto WHERE tipo_cnt = ? AND activo = 1 LIMIT 1",
    [tipoCnt]
  );
  return rows?.[0]?.tipo_bulto || null;
}

async function insertContenedoresYSellos(conn, blId, contenedores) {
  if (!contenedores.length) return;

  const insertContSql = `
    INSERT INTO bl_contenedores
      (bl_id, item_id, codigo, sigla, numero, digito, tipo_cnt,
      carga_cnt, peso, unidad_peso, volumen, unidad_volumen)
    VALUES (?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?)
  `;


  const insertSelloSql = `
    INSERT INTO bl_contenedor_sellos
      (contenedor_id, sello)
    VALUES (?, ?)
  `;

  for (const c of contenedores) {
    const [r] = await conn.query(insertContSql, [
      blId,
      null, // item_id por ahora (hasta que insertes bl_items)
      c.codigo,
      c.sigla,
      c.numero,
      c.digito,
      c.tipo_cnt,

      c.carga_cnt ?? "S",
      c.peso ?? null,
      c.unidad_peso ?? null,
      c.volumen ?? null,
      c.unidad_volumen ?? null,
    ]);

    const contenedorId = r.insertId;

    for (const s of (c.sellos || [])) {
      await conn.query(
        `INSERT INTO bl_contenedor_sellos (contenedor_id, sello) VALUES (?, ?)`,
        [contenedorId, s]
      );
    }
  }
}

function extractItemsFrom41_44_47(bLines) {
  const lines41 = pickAll(bLines, "41");
  const lines44 = pickAll(bLines, "44");
  const lines47 = pickAll(bLines, "47");

  const byItem = new Map(); // key: numero_item

  const getItem = (n) => {
    if (!byItem.has(n)) {
      byItem.set(n, {
        numero_item: n,
        descripcion: null,
        marcas: null,
        carga_peligrosa: "N", // default
        tipo_bulto: null,
        cantidad: null,
        peso_bruto: null,
        volumen: null,
        unidad_peso: null,
        unidad_volumen: null,
        carga_cnt: "S",
      });
    }
    return byItem.get(n);
  };

  // 41 trae peso/volumen/unidades + “código” de item (001)
  for (const l of lines41) {
    const m = String(l).match(/^41\s+(\d{3})/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const it = getItem(n);

    // peso/volumen desde tu extractor existente
    if (typeof extractWeightVolumeFrom41 === "function") {
      const { peso, volumen } = extractWeightVolumeFrom41(l);
      if (typeof peso === "number") it.peso_bruto = peso;
      if (typeof volumen === "number") it.volumen = volumen;
    }

    // unidades desde tu extractor existente
    if (typeof extractUnitsFrom41 === "function") {
      const u = extractUnitsFrom41(l);
      if (u?.unidadPeso) it.unidad_peso = u.unidadPeso;
      if (u?.unidadVolumen) it.unidad_volumen = u.unidadVolumen;
    }
  }

  // 44 son marcas por item (pueden venir varias)
  for (const l of lines44) {
    const m = String(l).match(/^44\s+(\d{3})(.*)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const it = getItem(n);
    const txt = (m[2] || "").trim();
    if (!txt) continue;
    it.marcas = it.marcas ? `${it.marcas} ${txt}` : txt;
  }

  // 47 es descripción por item (pueden venir muchas)
  for (const l of lines47) {
    const m = String(l).match(/^47\s+(\d{3})(.*)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const it = getItem(n);
    const txt = (m[2] || "").trim();
    if (!txt) continue;
    it.descripcion = it.descripcion ? `${it.descripcion} ${txt}` : txt;
  }

  return [...byItem.values()].sort((a, b) => a.numero_item - b.numero_item);
}

async function insertSellos(conn, contenedorId, sellos) {
  if (!contenedorId) return;
  if (!Array.isArray(sellos) || sellos.length === 0) return;

  const sql = `
    INSERT INTO bl_contenedor_sellos (contenedor_id, sello)
    VALUES (?, ?)
  `;

  for (const s of sellos) {
    const sello = String(s || "").trim();
    if (!sello) continue;
    await conn.query(sql, [contenedorId, sello]);
  }
}


// ===============================
// parsePmsTxt CORREGIDA
// ===============================
function parsePmsTxt(content) {
  const lines = splitLines(content);
  const blocks = splitIntoBLBlocks(lines);

  // Header global (1 vez)
  const header00 = pickFirst(lines, "00");
  const header11 = pickFirst(lines, "11");

  const fechaPresentacionGlobal = extractFPRESFrom00(header00); // FPRES (datetime)
  const fechaEmisionGlobal = extractFEMFrom11(header11);        // FEM (date)

  // LE global desde 74
  const lugarEmisionCodGlobal = extractLugarEmisionFrom74(lines);

  return blocks
    .map((bLines) => {
      const l12 = pickFirst(bLines, "12");
      const blNumber = extractBLNumber(l12);
      if (!blNumber) return null;

      const tipoServicioCod = extractServiceCodeFrom12(l12);

      const shipper = extractPartyName(pickFirst(bLines, "16"));
      const consignee = extractPartyName(pickFirst(bLines, "21"));
      const notify = extractPartyName(pickFirst(bLines, "26"));

      // Fallback POL/POD desde 13 (por si 14 viene rara)
      const l13 = pickFirst(bLines, "13");
      const { pol, pod } = (typeof extractPOLPOD === "function")
        ? extractPOLPOD(l13)
        : { pol: "", pod: "" };

      const lines41 = pickAll(bLines, "41");
      const totalItems = countItemsFrom41(lines41);

      const descripcion = lines41.length
        ? lines41.map(extractDescripcionFrom41).filter(Boolean).join(" | ")
        : null;

      // unidades + volumen desde 41
      let unidadPeso = null;
      let unidadVolumen = null;
      let totalVolumen = 0;
      let foundVol = false;

      for (const l41 of lines41) {
        const u = extractUnitsFrom41(l41);
        if (!unidadPeso && u?.unidadPeso) unidadPeso = u.unidadPeso;
        if (!unidadVolumen && u?.unidadVolumen) unidadVolumen = u.unidadVolumen;

        const { volumen } = extractWeightVolumeFrom41(l41);
        if (typeof volumen === "number") {
          foundVol = true;
          totalVolumen += volumen;
        }
      }
      totalVolumen = Math.round(totalVolumen * 1000) / 1000;

      // ---------- 14: FECHAS y LOCACIONES ----------
      const lines14 = pickAll(bLines, "14");

      // Fechas desde 14 principal (01SH si existe; si no, primera con 2 timestamps)
      const main14 = pickMain14ForDates(lines14);

      const fechaPresentacion = fechaPresentacionGlobal;
      const fechaEmision = fechaEmisionGlobal;
      const fechaEmbarque = main14 ? extractFEMBFrom14(main14) : null;
      const fechaZarpe = main14 ? extractFZARPEFrom14(main14) : null;

      // Locaciones PE/PD desde 14 (fallback a 13)
      const { pe, pd } = pickPEPD(lines14);
      const puertoEmbarqueCod = pe || pol || "";
      const puertoDescargaCod = pd || pod || "";

      // ---------- 51: CONTENEDORES + SELLOS (nuevo, NO rompe) ----------
      const lines51 = pickAll(bLines, "51");
      const totalContainers = countContainersFrom51(lines51); // lo sigues usando para bultos

      const weightKgs = extractWeightFrom12(l12);

      const items = extractItemsFrom41_44_47(bLines) || []; // tu función actual
      const contenedores = extractContainersFrom51(pickAll(bLines, "51")) || [];

      for (const it of items) {
        const contsDelItem = contenedores.filter(c => c.itemNo === it.numero_item);
        it.cantidad = contsDelItem.length || null;
      }


      return {
        // ====== lo que ya usas hoy ======
        blNumber,
        tipoServicioCod,

        shipper,
        consignee,
        notify,
        descripcion_carga: descripcion,

        peso_bruto: weightKgs,
        unidad_peso: unidadPeso,
        volumen: foundVol ? totalVolumen : 0,
        unidad_volumen: unidadVolumen,

        bultos: totalContainers,
        total_items: totalItems,

        fecha_presentacion: fechaPresentacion,
        fecha_emision: fechaEmision,
        fecha_embarque: fechaEmbarque,
        fecha_zarpe: fechaZarpe,

        lugar_emision_cod: lugarEmisionCodGlobal, // LE (74)
        puerto_embarque_cod: puertoEmbarqueCod,   // PE (14, fallback 13)
        puerto_descarga_cod: puertoDescargaCod,   // PD (14, fallback 13)

        items,
        // ====== NUEVO (para poblar tablas nuevas, si quieres) ======
        contenedores, // [{ codigo,sigla,numero,digito,tipo_cnt,sellos:[] }]
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

    // Si tus FK están con ON DELETE CASCADE desde bl_items/bl_contenedores -> bls,
    // esto limpia todo automáticamente.
    await conn.query("DELETE FROM bls WHERE manifiesto_id = ?", [id]);

    const insertBlSql = `
      INSERT INTO bls
        (manifiesto_id, bl_number, tipo_servicio_id,
         shipper, consignee, notify_party,
         lugar_emision_id, puerto_embarque_id, puerto_descarga_id,
         lugar_destino_id, lugar_entrega_id, lugar_recepcion_id,
         descripcion_carga,
         peso_bruto, unidad_peso,
         volumen, unidad_volumen,
         bultos, total_items,
         fecha_emision, fecha_presentacion, fecha_embarque, fecha_zarpe,
         status)
      VALUES
        (?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?,
         ?, ?,
         ?, ?,
         ?, ?,
         ?, ?, ?, ?,
         'CREADO')
    `;

    const insertItemSql = `
      INSERT INTO bl_items
        (bl_id, numero_item, descripcion, marcas, carga_peligrosa,
         tipo_bulto, cantidad, peso_bruto, unidad_peso, volumen, unidad_volumen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ojo: bl_contenedores.volumen normalmente NULL (el volumen es del item)
    const insertContSql = `
      INSERT INTO bl_contenedores
        (bl_id, item_id, codigo, sigla, numero, digito,
         tipo_cnt, carga_cnt, peso, unidad_peso, volumen, unidad_volumen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const b of bls) {
      const lugarEmisionId = await getPuertoIdByCodigo(conn, b.lugar_emision_cod);
      const puertoEmbarqueId = await getPuertoIdByCodigo(conn, b.puerto_embarque_cod);
      const puertoDescargaId = await getPuertoIdByCodigo(conn, b.puerto_descarga_cod);

      const tipoServicioId = await getTipoServicioIdByCodigo(conn, b.tipoServicioCod);

      for (const it of (b.items || [])) {
        const contsDelItem = (b.contenedores || []).filter(c => c.itemNo === it.numero_item);
        const tipoCnt = contsDelItem.find(c => c.tipo_cnt)?.tipo_cnt || null;

        it.tipo_bulto = await getTipoBultoFromTipoCnt(conn, tipoCnt);
      }

      const [blIns] = await conn.query(insertBlSql, [
        id,
        b.blNumber,
        tipoServicioId,

        b.shipper || null,
        b.consignee || null,
        b.notify || null,

        lugarEmisionId,
        puertoEmbarqueId,
        puertoDescargaId,

        null, // lugar_destino_id
        null, // lugar_entrega_id
        null, // lugar_recepcion_id

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

      const blId = blIns.insertId;

      // =========================
      // 1) INSERT ITEMS (bl_items)
      // =========================
      const itemIdByNumero = new Map();
      const items = Array.isArray(b.items) ? b.items : [];

      for (const it of items) {
        const [itIns] = await conn.query(insertItemSql, [
          blId,
          it.numero_item,
          it.descripcion || null,
          it.marcas || null,
          it.carga_peligrosa || "N",
          it.tipo_bulto || null,
          it.cantidad ?? null,
          it.peso_bruto ?? null,
          it.unidad_peso || null,
          it.volumen ?? null,
          it.unidad_volumen || null,
        ]);
        itemIdByNumero.set(it.numero_item, itIns.insertId);
      }

      // ==========================================
      // 2) INSERT CONTENEDORES (bl_contenedores)
      //    + link item_id usando itemNo
      // ==========================================
      const conts = Array.isArray(b.contenedores) ? b.contenedores : [];

      for (const c of conts) {
        const itemId = c?.itemNo ? (itemIdByNumero.get(c.itemNo) || null) : null;

        const [cIns] = await conn.query(insertContSql, [
          blId,
          itemId,
          c.codigo,
          c.sigla || null,
          c.numero || null,
          c.digito || null,
          c.tipo_cnt || null,
          c.carga_cnt || null,         // "S"
          c.peso ?? null,              // ✅ ahora ya te funciona
          c.unidad_peso || null,       // KGM
          c.volumen ?? null,           // normalmente NULL
          c.unidad_volumen || null,    // MTQ
        ]);

        // =========================
        // 3) SELLOS (si tienes tabla)
        // =========================
        // Si tienes una tabla tipo bl_contenedor_sellos(contenedor_id, numero):
        await insertSellos(conn, cIns.insertId, c.sellos || []);
      }
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
// Agregar esta ruta en tu archivo de rutas (index.js o routes/bls.js)

// GET todos los BLs con información completa
app.get("/bls", async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.bl_number,
        b.manifiesto_id,
        m.viaje,
        b.shipper,
        b.consignee,
        b.notify_party,

        le.nombre  AS lugar_emision,
        pe.nombre  AS puerto_embarque,
        pd.nombre  AS puerto_descarga,

        b.fecha_emision,
        b.fecha_presentacion,
        b.fecha_embarque,
        b.fecha_zarpe,
        b.descripcion_carga,
        b.peso_bruto,
        b.unidad_peso,
        b.volumen,
        b.unidad_volumen,
        b.bultos,
        b.total_items,
        b.status,
        b.created_at,
        b.updated_at,
        ts.nombre as tipo_servicio

      FROM bls b
      LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
      LEFT JOIN puertos le ON b.lugar_emision_id   = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      ORDER BY b.created_at DESC
    `;

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener BLs:", error);
    res.status(500).json({
      error: "Error al obtener BLs",
      details: error.message
    });
  }
});

// GET un BL específico por número
app.get("/bls/:blNumber", async (req, res) => {
  try {
    const { blNumber } = req.params;

    const query = `
      SELECT
        b.*,
        m.viaje,
        m.tipo_operacion,

        ts.codigo AS tipo_servicio_codigo,
        ts.nombre AS tipo_servicio,

        le.codigo AS lugar_emision_codigo,
        le.nombre AS lugar_emision,
        pe.codigo AS puerto_embarque_codigo,
        pe.nombre AS puerto_embarque,
        pd.codigo AS puerto_descarga_codigo,
        pd.nombre AS puerto_descarga,

        n.nombre AS nave_nombre
      FROM bls b
      LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id

      LEFT JOIN puertos le ON b.lugar_emision_id   = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id

      LEFT JOIN naves n ON m.nave_id = n.id
      WHERE b.bl_number = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(query, [blNumber]);

    if (rows.length === 0) return res.status(404).json({ error: "BL no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener BL:", error);
    res.status(500).json({ error: "Error al obtener BL", details: error.message });
  }
});

// PUT - Actualizar items de un BL
app.put("/bls/:blNumber/items", async (req, res) => {
  const { blNumber } = req.params;
  const { items } = req.body; // Array de items con sus datos actualizados

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener bl_id
    const [blRows] = await conn.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    // 2) Actualizar cada item
    for (const item of items) {
      if (!item.id) continue;

      await conn.query(
        `UPDATE bl_items 
         SET descripcion = ?,
             marcas = ?,
             tipo_bulto = ?,
             cantidad = ?,
             peso_bruto = ?,
             volumen = ?
         WHERE id = ? AND bl_id = ?`,
        [
          item.descripcion || null,
          item.marcas || null,
          item.tipo_bulto || null,
          item.cantidad || null,
          item.peso_bruto || null,
          item.volumen || null,
          item.id,
          blId
        ]
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Items actualizados correctamente" });
  } catch (error) {
    await conn.rollback();
    console.error("Error al actualizar items:", error);
    res.status(500).json({ error: "Error al actualizar items" });
  } finally {
    conn.release();
  }
});

// GET items y contenedores de un BL específico
app.get("/bls/:blNumber/items-contenedores", async (req, res) => {
  try {
    const { blNumber } = req.params;

    // 1) Obtener el BL
    const [blRows] = await pool.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;
    console.log(`📦 BL ID: ${blId} para BL Number: ${blNumber}`);

    // 2) Obtener ítems
    const [items] = await pool.query(
      `SELECT 
        id, numero_item, descripcion, marcas, carga_peligrosa,
        tipo_bulto, cantidad, peso_bruto, unidad_peso, volumen, unidad_volumen
      FROM bl_items
      WHERE bl_id = ?
      ORDER BY numero_item ASC`,
      [blId]
    );

    console.log(`📋 Items encontrados: ${items.length}`);

    // 3) Obtener contenedores POR ITEM
    const [contenedoresPorItem] = await pool.query(
      `SELECT 
        c.item_id,
        c.id as contenedor_id,
        c.codigo,
        c.tipo_cnt,
        c.peso,
        c.unidad_peso,
        c.volumen,
        c.unidad_volumen
      FROM bl_contenedores c
      WHERE c.bl_id = ?
      ORDER BY c.item_id, c.codigo ASC`,
      [blId]
    );

    console.log(`📦 Contenedores totales: ${contenedoresPorItem.length}`);
    console.log(`🔍 Contenedores con item_id:`, contenedoresPorItem.filter(c => c.item_id).length);

    // 4) Agrupar contenedores por item_id
    const contsPorItemMap = {};
    for (const cont of contenedoresPorItem) {
      if (cont.item_id) {
        if (!contsPorItemMap[cont.item_id]) {
          contsPorItemMap[cont.item_id] = [];
        }
        contsPorItemMap[cont.item_id].push({
          codigo: cont.codigo,
          tipo_cnt: cont.tipo_cnt
        });
      }
    }

    console.log(`🗂️ Items con contenedores:`, Object.keys(contsPorItemMap).length);
    console.log(`📊 Mapa de contenedores:`, JSON.stringify(contsPorItemMap, null, 2));

    // 5) Agregar contenedores a cada ítem
    const itemsConContenedores = items.map(item => ({
      ...item,
      contenedores: contsPorItemMap[item.id] || []
    }));

    // 6) Obtener TODOS los contenedores con sellos (para la tabla separada)
    const [contenedores] = await pool.query(
      `SELECT 
        c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito,
        c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen,
        GROUP_CONCAT(s.sello ORDER BY s.sello SEPARATOR ', ') as sellos
      FROM bl_contenedores c
      LEFT JOIN bl_contenedor_sellos s ON s.contenedor_id = c.id
      WHERE c.bl_id = ?
      GROUP BY c.id
      ORDER BY c.codigo ASC`,
      [blId]
    );

    res.json({
      items: itemsConContenedores || [],
      contenedores: contenedores || []
    });
  } catch (error) {
    console.error("❌ Error al obtener items y contenedores:", error);
    res.status(500).json({ 
      error: "Error al obtener items y contenedores",
      details: error.message 
    });
  }
});


app.get("/manifiestos/:id/bls", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        b.*,
        ts.nombre AS tipo_servicio,

        le.nombre AS lugar_emision,
        pe.nombre AS puerto_embarque,
        pd.nombre AS puerto_descarga
      FROM bls b
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      LEFT JOIN puertos le ON b.lugar_emision_id   = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      WHERE b.manifiesto_id = ?
      ORDER BY b.bl_number
    `;

    const [rows] = await pool.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener BLs del manifiesto:", error);
    res.status(500).json({ error: "Error al obtener BLs del manifiesto", details: error.message });
  }
});




// ============================================
// ENDPOINTS PARA EDICIÓN DE BLs
// ============================================

// PUT - Actualizar un BL completo
// PUT - Actualizar un BL completo
app.put("/bls/:blNumber", async (req, res) => {
  const { blNumber } = req.params;
  const {
    viaje,
    tipo_servicio,
    fecha_emision,
    fecha_zarpe,
    fecha_embarque,
    puerto_embarque,      // 🆕 NUEVO
    puerto_descarga,      // 🆕 NUEVO
    shipper,
    consignee,
    notify_party,
    descripcion_carga,
    peso_bruto,
    volumen,
    bultos,
    observaciones,
    prepaid_collect,
    freight_amount,
    payable_at
  } = req.body;

  try {
    // Obtener el tipo_servicio_id si viene el código
    let tipo_servicio_id = null;
    if (tipo_servicio) {
      const [tsRows] = await pool.query(
        "SELECT id FROM tipos_servicio WHERE codigo = ?",
        [tipo_servicio]
      );
      if (tsRows.length > 0) {
        tipo_servicio_id = tsRows[0].id;
      }
    }

    // 🆕 Obtener puerto_embarque_id si viene el código
    let puerto_embarque_id = null;
    if (puerto_embarque) {
      const [peRows] = await pool.query(
        "SELECT id FROM puertos WHERE codigo = ?",
        [puerto_embarque]
      );
      if (peRows.length > 0) {
        puerto_embarque_id = peRows[0].id;
      }
    }

    // 🆕 Obtener puerto_descarga_id si viene el código
    let puerto_descarga_id = null;
    if (puerto_descarga) {
      const [pdRows] = await pool.query(
        "SELECT id FROM puertos WHERE codigo = ?",
        [puerto_descarga]
      );
      if (pdRows.length > 0) {
        puerto_descarga_id = pdRows[0].id;
      }
    }

    // Actualizar el BL
    const [result] = await pool.query(`
      UPDATE bls 
      SET 
        tipo_servicio_id = COALESCE(?, tipo_servicio_id),
        fecha_emision = COALESCE(?, fecha_emision),
        fecha_zarpe = COALESCE(?, fecha_zarpe),
        fecha_embarque = COALESCE(?, fecha_embarque),
        puerto_embarque_id = COALESCE(?, puerto_embarque_id),
        puerto_descarga_id = COALESCE(?, puerto_descarga_id),
        shipper = COALESCE(?, shipper),
        consignee = COALESCE(?, consignee),
        notify_party = COALESCE(?, notify_party),
        descripcion_carga = COALESCE(?, descripcion_carga),
        peso_bruto = COALESCE(?, peso_bruto),
        volumen = COALESCE(?, volumen),
        bultos = COALESCE(?, bultos),
        updated_at = NOW()
      WHERE bl_number = ?
    `, [
      tipo_servicio_id,
      fecha_emision,
      fecha_zarpe,
      fecha_embarque,
      puerto_embarque_id,  // 🆕
      puerto_descarga_id,  // 🆕
      shipper,
      consignee,
      notify_party,
      descripcion_carga,
      peso_bruto,
      volumen,
      bultos,
      blNumber
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    // Retornar el BL actualizado
    const [updated] = await pool.query(
      `
      SELECT
        b.*,
        m.viaje,
        ts.nombre AS tipo_servicio,
        ts.codigo AS tipo_servicio_codigo,
        le.nombre AS lugar_emision,
        le.codigo AS lugar_emision_codigo,
        pe.nombre AS puerto_embarque,
        pe.codigo AS puerto_embarque_codigo,
        pd.nombre AS puerto_descarga,
        pd.codigo AS puerto_descarga_codigo
      FROM bls b
      LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      LEFT JOIN puertos le ON b.lugar_emision_id   = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      WHERE b.bl_number = ?
      LIMIT 1
      `,
      [blNumber]
    );

    res.json({
      message: "BL actualizado exitosamente",
      bl: updated[0]
    });
  } catch (error) {
    console.error("Error al actualizar BL:", error);
    res.status(500).json({ error: "Error al actualizar BL" });
  }
});
// PATCH - Actualizar solo el status del BL
app.patch("/bls/:blNumber/status", async (req, res) => {
  const { blNumber } = req.params;
  const { status } = req.body;

  // Validar status
  const validStatuses = ['CREADO', 'VALIDADO', 'ENVIADO', 'ANULADO'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Status inválido. Debe ser: CREADO, VALIDADO, ENVIADO o ANULADO"
    });
  }

  try {
    const [result] = await pool.query(
      "UPDATE bls SET status = ?, updated_at = NOW() WHERE bl_number = ?",
      [status, blNumber]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    res.json({
      message: "Status actualizado exitosamente",
      status
    });
  } catch (error) {
    console.error("Error al actualizar status:", error);
    res.status(500).json({ error: "Error al actualizar status" });
  }
});


// ============================================
// INICIAR SERVIDOR
// ============================================
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));