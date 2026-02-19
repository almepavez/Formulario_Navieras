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
const { create } = require('xmlbuilder2');
const archiver = require('archiver'); // npm install archiver

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



app.post("/manifiestos", async (req, res) => {
  const {
    servicio,
    nave,
    puertoCentral,
    viaje,
    tipoOperacion,
    operadorNave,
    status,
    remark,
    emisorDocumento,
    representante,
    fechaManifiestoAduana,
    numeroManifiestoAduana,
    itinerario = [],
    // 🆕 NUEVOS CAMPOS PARA REFERENCIA
    referenciaId,
    numeroReferencia,
    fechaReferencia,
    fecha_zarpe
  } = req.body || {};

  // Validación mínima
  if (
    !servicio || !nave || !puertoCentral || !viaje || !tipoOperacion ||
    !operadorNave || !emisorDocumento || !representante ||
    !fechaManifiestoAduana || !numeroManifiestoAduana
  ) {
    return res.status(400).json({ error: "Faltan campos obligatorios del manifiesto." });
  }

  const validStatuses = ["Activo", "Inactivo", "Enviado"];
  const statusFinal = status && validStatuses.includes(status) ? status : "Activo";

  const allowedOps = new Set(["I", "S", "TR", "TRB"]);
  if (!allowedOps.has(String(tipoOperacion).toUpperCase())) {
    return res.status(400).json({ error: "tipoOperacion inválido. Valores permitidos: I, S, TR, TRB" });
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

    // 2) Insert manifiesto (🆕 CON CAMPOS DE REFERENCIA)
    const [result] = await conn.query(
      `INSERT INTO manifiestos
  (servicio_id, nave_id, puerto_central_id,
   viaje, tipo_operacion, operador_nave,
   status, remark, emisor_documento, representante,
   fecha_manifiesto_aduana, numero_manifiesto_aduana,
   referencia_id, numero_referencia, fecha_referencia,
   fecha_zarpe)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        servRow.id,
        naveRow.id,
        pcRow.id,
        String(viaje).trim(),
        String(tipoOperacion).toUpperCase(),
        String(operadorNave).trim(),
        statusFinal,
        remark || null,
        String(emisorDocumento).trim(),
        String(representante).trim(),
        fechaManifiestoAduana,
        String(numeroManifiestoAduana).trim(),
        referenciaId || null,           // 🆕
        numeroReferencia || null,        // 🆕
        fechaReferencia || null,          // 🆕
        fecha_zarpe || null 
      ]
    );

    const manifiestoId = result.insertId;

    // 3) Insert itinerario
    if (Array.isArray(itinerario) && itinerario.length > 0) {
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
    itinerario,
    // 🆕 CAMPOS DE REFERENCIA
    referenciaId,
    numeroReferencia,
    fechaReferencia,
    // 🆕 PUERTO CENTRAL - ¡FALTABA ESTE!
    puertoCentral,
    fechaZarpe
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ ACTUALIZAR EL MANIFIESTO (🆕 CON PUERTO CENTRAL)
    await connection.query(
      `UPDATE manifiestos 
       SET operador_nave = ?, 
           status = ?, 
           remark = ?,
           emisor_documento = ?,
           representante = ?,
           fecha_manifiesto_aduana = ?,
           numero_manifiesto_aduana = ?,
           referencia_id = ?,
           numero_referencia = ?,
           fecha_referencia = ?,
           puerto_central_id = ?,
           fecha_zarpe = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [
        operadorNave,
        status,
        remark,
        emisorDocumento,
        representante,
        fechaManifiestoAduana,
        numeroManifiestoAduana,
        referenciaId || null,
        numeroReferencia || null,
        fechaReferencia || null,
        puertoCentral || null,
        fechaZarpe || null,  // 🆕 ESTE DEBERÍA SER EL ID DEL PUERTO
        id
      ]
    );

    // 2️⃣ ACTUALIZAR ITINERARIO
    if (itinerario && Array.isArray(itinerario)) {
      for (const item of itinerario) {
        await connection.query(
          `UPDATE itinerarios 
           SET eta = ?, ets = ?
           WHERE id = ?`,
          [item.eta || null, item.ets || null, item.id]
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Manifiesto actualizado correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error actualizando manifiesto:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
// ============================================
// CRUD MANIFIESTOS
// ============================================

// GET - Listar manifiestos
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
          m.fecha_zarpe AS fechaZarpe, 
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

// 🔥 REEMPLAZA ESTO (línea ~1061)
app.get("/manifiestos/:id", async (req, res) => {
  const { id } = req.params;

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
          m.updated_at AS updatedAt,
          
          -- 🆕 AGREGAR ESTOS 3 CAMPOS
          m.referencia_id AS referenciaId,
          m.numero_referencia AS numeroReferencia,
          m.fecha_referencia AS fechaReferencia,
          m.fecha_zarpe AS fechaZarpe     

          
       FROM manifiestos m
       JOIN servicios s ON s.id = m.servicio_id
       JOIN naves n ON n.id = m.nave_id
       JOIN puertos pc ON pc.id = m.puerto_central_id
       WHERE m.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Manifiesto no encontrado" });
    }

    const [itinerario] = await pool.query(
      `SELECT 
          i.id,
          p.codigo AS port,
          i.port_type AS portType,
          i.eta,
          i.ets,
          i.orden
       FROM itinerarios i
       JOIN puertos p ON p.id = i.puerto_id
       WHERE i.manifiesto_id = ?
       ORDER BY i.orden`,
      [id]
    );

    const [bls] = await pool.query(
      `SELECT 
          id,
          bl_number,
          tipo_servicio_id,
          shipper,
          consignee,
          notify_party,
          fecha_emision,
          fecha_presentacion,
          fecha_embarque,
          fecha_zarpe,
          descripcion_carga,
          peso_bruto,
          unidad_peso,
          volumen,
          unidad_volumen,
          bultos,
          total_items,
          status,
          valid_status,
          valid_count_error,
          valid_count_obs,
          lugar_emision_cod,
          puerto_embarque_cod,
          puerto_descarga_cod,
          lugar_destino_cod,
          lugar_entrega_cod,
          lugar_recepcion_cod,
          created_at,
          updated_at
       FROM bls
       WHERE manifiesto_id = ?
       ORDER BY id`,
      [id]
    );

    const response = {
      manifiesto: rows[0],
      itinerario,
      bls
    };

    res.json(response);

  } catch (err) {
    console.error(`❌ Error:`, err);
    res.status(500).json({ error: "Error al obtener manifiesto" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ENDPOINT: GET /api/manifiestos/siguiente-numero-referencia
// Obtener el siguiente número de referencia disponible
// ══════════════════════════════════════════════════════════════════
app.get("/api/manifiestos/siguiente-numero-referencia", async (req, res) => {
  try {
    // Obtener el número más alto actual
    const [rows] = await pool.query(
      `SELECT COALESCE(MAX(CAST(numero_manifiesto_aduana AS UNSIGNED)), 0) as max_numero 
       FROM manifiestos 
       WHERE numero_manifiesto_aduana REGEXP '^[0-9]+$'`
    );

    const siguienteNumero = (rows[0].max_numero + 1).toString().padStart(6, '0');

    res.json({ numero: siguienteNumero });
  } catch (error) {
    console.error("Error obteniendo siguiente número:", error);
    res.status(500).json({
      error: "Error obteniendo siguiente número",
      details: error.message
    });
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

// ✅ DESPUÉS:
app.post("/api/mantenedores/puertos", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const codigoUpper = codigo.trim().toUpperCase();

    // 1️⃣ Insertar el puerto
    const [result] = await conn.query(
      "INSERT INTO puertos (codigo, nombre) VALUES (?, ?)",
      [codigoUpper, nombre.trim()]
    );

    const puertoId = result.insertId;

    console.log(`🆕 Puerto '${codigoUpper}' creado con ID ${puertoId}`);

    // 2️⃣ ACTUALIZAR BLs que tienen este código en _cod pero NO tienen el _id
    const blsActualizados = [];

    // Función helper para actualizar un campo específico
    const actualizarCampoPuerto = async (campoCod, campoId) => {
      const [result] = await conn.query(
        `UPDATE bls 
         SET ${campoId} = ? 
         WHERE ${campoCod} = ? 
         AND ${campoId} IS NULL`,
        [puertoId, codigoUpper]
      );

      if (result.affectedRows > 0) {
        console.log(`   ✅ ${result.affectedRows} BL(s) actualizados en ${campoId}`);
        return result.affectedRows;
      }
      return 0;
    };

    // Actualizar cada campo de puerto
    const totalLugarEmision = await actualizarCampoPuerto('lugar_emision_cod', 'lugar_emision_id');
    const totalPuertoEmbarque = await actualizarCampoPuerto('puerto_embarque_cod', 'puerto_embarque_id');
    const totalPuertoDescarga = await actualizarCampoPuerto('puerto_descarga_cod', 'puerto_descarga_id');
    const totalLugarDestino = await actualizarCampoPuerto('lugar_destino_cod', 'lugar_destino_id');
    const totalLugarEntrega = await actualizarCampoPuerto('lugar_entrega_cod', 'lugar_entrega_id');
    const totalLugarRecepcion = await actualizarCampoPuerto('lugar_recepcion_cod', 'lugar_recepcion_id');

    const totalActualizados = totalLugarEmision + totalPuertoEmbarque + totalPuertoDescarga +
      totalLugarDestino + totalLugarEntrega + totalLugarRecepcion;

    // 3️⃣ Obtener lista de BLs únicos que fueron afectados (para re-validar)
    const [blsAfectados] = await conn.query(`
      SELECT DISTINCT id 
      FROM bls 
      WHERE lugar_emision_cod = ?
         OR puerto_embarque_cod = ?
         OR puerto_descarga_cod = ?
         OR lugar_destino_cod = ?
         OR lugar_entrega_cod = ?
         OR lugar_recepcion_cod = ?
    `, [codigoUpper, codigoUpper, codigoUpper, codigoUpper, codigoUpper, codigoUpper]);

    console.log(`🔄 Re-validando ${blsAfectados.length} BL(s) afectados...`);

    // 4️⃣ Re-validar cada BL afectado
    for (const bl of blsAfectados) {
      await revalidarBLCompleto(conn, bl.id);
      console.log(`   ✅ BL ID ${bl.id} re-validado`);
    }

    await conn.commit();

    res.status(201).json({
      id: puertoId,
      codigo: codigoUpper,
      nombre: nombre.trim(),
      bls_actualizados: totalActualizados,
      bls_revalidados: blsAfectados.length,
      detalle: {
        lugar_emision: totalLugarEmision,
        puerto_embarque: totalPuertoEmbarque,
        puerto_descarga: totalPuertoDescarga,
        lugar_destino: totalLugarDestino,
        lugar_entrega: totalLugarEntrega,
        lugar_recepcion: totalLugarRecepcion
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error al crear puerto:", error);
    res.status(500).json({ error: "Error al crear puerto" });
  } finally {
    conn.release();
  }
});

// ✅ DESPUÉS:
app.put("/api/mantenedores/puertos/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { codigo, nombre } = req.body;
    const { id } = req.params;

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "codigo y nombre son obligatorios" });
    }

    const codigoUpper = codigo.trim().toUpperCase();

    // 1️⃣ Actualizar el puerto
    const [result] = await conn.query(
      "UPDATE puertos SET codigo = ?, nombre = ? WHERE id = ?",
      [codigoUpper, nombre.trim(), id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Puerto no encontrado" });
    }

    console.log(`📝 Puerto ID ${id} actualizado a '${codigoUpper}'`);

    // 2️⃣ ACTUALIZAR BLs que tienen este código en _cod pero NO tienen el _id correcto
    const actualizarCampoPuerto = async (campoCod, campoId) => {
      const [result] = await conn.query(
        `UPDATE bls 
         SET ${campoId} = ? 
         WHERE ${campoCod} = ? 
         AND (${campoId} IS NULL OR ${campoId} != ?)`,
        [id, codigoUpper, id]
      );

      if (result.affectedRows > 0) {
        console.log(`   ✅ ${result.affectedRows} BL(s) actualizados en ${campoId}`);
        return result.affectedRows;
      }
      return 0;
    };

    // Actualizar cada campo de puerto
    const totalLugarEmision = await actualizarCampoPuerto('lugar_emision_cod', 'lugar_emision_id');
    const totalPuertoEmbarque = await actualizarCampoPuerto('puerto_embarque_cod', 'puerto_embarque_id');
    const totalPuertoDescarga = await actualizarCampoPuerto('puerto_descarga_cod', 'puerto_descarga_id');
    const totalLugarDestino = await actualizarCampoPuerto('lugar_destino_cod', 'lugar_destino_id');
    const totalLugarEntrega = await actualizarCampoPuerto('lugar_entrega_cod', 'lugar_entrega_id');
    const totalLugarRecepcion = await actualizarCampoPuerto('lugar_recepcion_cod', 'lugar_recepcion_id');

    const totalActualizados = totalLugarEmision + totalPuertoEmbarque + totalPuertoDescarga +
      totalLugarDestino + totalLugarEntrega + totalLugarRecepcion;

    // 3️⃣ Obtener BLs afectados para re-validar
    const [blsAfectados] = await conn.query(`
      SELECT DISTINCT id 
      FROM bls 
      WHERE lugar_emision_cod = ?
         OR puerto_embarque_cod = ?
         OR puerto_descarga_cod = ?
         OR lugar_destino_cod = ?
         OR lugar_entrega_cod = ?
         OR lugar_recepcion_cod = ?
    `, [codigoUpper, codigoUpper, codigoUpper, codigoUpper, codigoUpper, codigoUpper]);

    console.log(`🔄 Re-validando ${blsAfectados.length} BL(s) afectados...`);

    // 4️⃣ Re-validar BLs afectados
    for (const bl of blsAfectados) {
      await revalidarBLCompleto(conn, bl.id);
      console.log(`   ✅ BL ID ${bl.id} re-validado`);
    }

    await conn.commit();

    res.json({
      id: Number(id),
      codigo: codigoUpper,
      nombre: nombre.trim(),
      bls_actualizados: totalActualizados,
      bls_revalidados: blsAfectados.length,
      detalle: {
        lugar_emision: totalLugarEmision,
        puerto_embarque: totalPuertoEmbarque,
        puerto_descarga: totalPuertoDescarga,
        lugar_destino: totalLugarDestino,
        lugar_entrega: totalLugarEntrega,
        lugar_recepcion: totalLugarRecepcion
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error al actualizar puerto:", error);
    res.status(500).json({ error: "Error al actualizar puerto" });
  } finally {
    conn.release();
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

// GET - Obtener tipos de bulto para selectores (SIN /api/mantenedores)
app.get("/tipos-bulto", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT tipo_bulto FROM tipo_cnt_tipo_bulto WHERE activo = 1 ORDER BY tipo_bulto"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener tipos de bulto:", error);
    res.status(500).json({ error: "Error al obtener tipos de bulto" });
  }
});

// GET endpoint para obtener el mapeo tipo_cnt <-> tipo_bulto
app.get("/tipo-cnt-tipo-bulto", async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tipo_cnt_tipo_bulto WHERE activo = 1'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener mapeo tipo_cnt-tipo_bulto:', error);
    res.status(500).json({
      error: 'Error al obtener datos',
      details: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
app.get("/api/mantenedores/referencias", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, customer_id, external_id, rut, match_code, nombre_emisor, pais, tipo_id_emisor, nacion_id 
       FROM referencias 
       ORDER BY nombre_emisor`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo referencias:", error);
    res.status(500).json({
      error: "Error obteniendo referencias",
      details: error.message
    });
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

// ========================================
// 4. TIPO DE BULTO (NUEVO)
// ========================================

// ============================================
// CRUD TIPO-BULTO (tipo_cnt_tipo_bulto)
// ============================================

// GET - Listar tipos de bulto
app.get('/api/mantenedores/tipo-bulto', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, tipo_cnt, tipo_bulto, activo FROM tipo_cnt_tipo_bulto ORDER BY tipo_cnt'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de bulto:', error);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

// GET - Obtener un tipo de bulto específico por ID
app.get('/api/mantenedores/tipo-bulto/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, tipo_cnt, tipo_bulto, activo FROM tipo_cnt_tipo_bulto WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tipo de bulto no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener tipo de bulto:', error);
    res.status(500).json({ error: 'Error al obtener el tipo de bulto' });
  }
});

// POST - Crear tipo de bulto
app.post('/api/mantenedores/tipo-bulto', async (req, res) => {
  const { tipo_cnt, tipo_bulto, activo } = req.body;

  try {
    if (!tipo_cnt || !tipo_bulto) {
      return res.status(400).json({ error: 'tipo_cnt y tipo_bulto son obligatorios' });
    }

    const [result] = await pool.query(
      'INSERT INTO tipo_cnt_tipo_bulto (tipo_cnt, tipo_bulto, activo) VALUES (?, ?, ?)',
      [tipo_cnt, tipo_bulto, activo ?? 1]
    );

    res.status(201).json({
      id: result.insertId,
      tipo_cnt,
      tipo_bulto,
      activo: activo ?? 1
    });
  } catch (error) {
    console.error('Error al crear tipo de bulto:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El tipo de contenedor ya existe' });
    }

    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// PUT - Actualizar tipo de bulto
app.put('/api/mantenedores/tipo-bulto/:id', async (req, res) => {
  const { id } = req.params;
  const { tipo_cnt, tipo_bulto, activo } = req.body;

  console.log('🔧 PUT tipo-bulto recibido:', { id, body: req.body });

  try {
    if (!tipo_cnt || !tipo_bulto) {
      return res.status(400).json({ error: 'tipo_cnt y tipo_bulto son obligatorios' });
    }

    const activoValue = activo !== undefined ? Number(activo) : 1;
    if (![0, 1].includes(activoValue)) {
      return res.status(400).json({ error: 'El campo activo debe ser 0 o 1' });
    }

    const idNum = Number(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM tipo_cnt_tipo_bulto WHERE id = ?',
      [idNum]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Tipo de bulto no encontrado' });
    }

    const [result] = await pool.query(
      'UPDATE tipo_cnt_tipo_bulto SET tipo_cnt = ?, tipo_bulto = ?, activo = ? WHERE id = ?',
      [tipo_cnt.trim(), tipo_bulto.trim(), activoValue, idNum]
    );

    console.log('✅ Tipo de bulto actualizado:', {
      id: idNum,
      tipo_cnt,
      tipo_bulto,
      activo: activoValue,
      affectedRows: result.affectedRows
    });

    res.json({
      id: idNum,
      tipo_cnt: tipo_cnt.trim(),
      tipo_bulto: tipo_bulto.trim(),
      activo: activoValue
    });
  } catch (error) {
    console.error('❌ Error al actualizar tipo de bulto:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El tipo de contenedor ya existe' });
    }

    res.status(500).json({
      error: 'Error al actualizar el registro',
      details: error.message
    });
  }
});

// DELETE - Eliminar tipo de bulto
app.delete('/api/mantenedores/tipo-bulto/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM tipo_cnt_tipo_bulto WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de bulto no encontrado' });
    }

    res.json({ message: 'Tipo de bulto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tipo de bulto:', error);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

// ============================================
// CRUD EMPAQUE-CONTENEDORES (pms51_tokens)
// ============================================

// GET - Listar tokens PMS51
app.get('/api/mantenedores/empaque-contenedores', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, token, activo FROM pms51_tokens ORDER BY token'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tokens:', error);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

// GET - Obtener un token específico por ID
app.get('/api/mantenedores/empaque-contenedores/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, token, activo FROM pms51_tokens WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener token:', error);
    res.status(500).json({ error: 'Error al obtener el token' });
  }
});

// POST - Crear token
app.post('/api/mantenedores/empaque-contenedores', async (req, res) => {
  const { token, activo } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ error: 'El token es obligatorio' });
    }

    const tokenUpper = String(token).toUpperCase().trim();
    const activoValue = activo !== undefined ? Number(activo) : 1;

    const [result] = await pool.query(
      'INSERT INTO pms51_tokens (token, activo) VALUES (?, ?)',
      [tokenUpper, activoValue]
    );

    // 🔄 Recargar tokens en memoria
    await loadPms51Tokens();

    res.status(201).json({
      id: result.insertId,
      token: tokenUpper,
      activo: activoValue
    });
  } catch (error) {
    console.error('Error al crear token:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El token ya existe' });
    }

    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// PUT - Actualizar token
app.put('/api/mantenedores/empaque-contenedores/:id', async (req, res) => {
  const { id } = req.params;
  const { token, activo } = req.body;

  console.log('🔧 PUT empaque-contenedores recibido:', { id, body: req.body });

  try {
    if (!token) {
      return res.status(400).json({ error: 'El token es obligatorio' });
    }

    const tokenUpper = String(token).toUpperCase().trim();
    const activoValue = activo !== undefined ? Number(activo) : 1;

    if (![0, 1].includes(activoValue)) {
      return res.status(400).json({ error: 'El campo activo debe ser 0 o 1' });
    }

    const idNum = Number(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM pms51_tokens WHERE id = ?',
      [idNum]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Token no encontrado' });
    }

    const [result] = await pool.query(
      'UPDATE pms51_tokens SET token = ?, activo = ? WHERE id = ?',
      [tokenUpper, activoValue, idNum]
    );

    // 🔄 Recargar tokens en memoria
    await loadPms51Tokens();

    console.log('✅ Token actualizado:', {
      id: idNum,
      token: tokenUpper,
      activo: activoValue,
      affectedRows: result.affectedRows
    });

    res.json({
      id: idNum,
      token: tokenUpper,
      activo: activoValue
    });
  } catch (error) {
    console.error('❌ Error al actualizar token:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El token ya existe' });
    }

    res.status(500).json({
      error: 'Error al actualizar el registro',
      details: error.message
    });
  }
});

// DELETE - Eliminar token
app.delete('/api/mantenedores/empaque-contenedores/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM pms51_tokens WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Token no encontrado' });
    }

    // 🔄 Recargar tokens en memoria
    await loadPms51Tokens();

    res.json({ message: 'Token eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar token:', error);
    res.status(500).json({ error: 'Error al eliminar el registro' });
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


let PMS51_TOKENS = [];

async function loadPms51Tokens() {
  const [rows] = await pool.query(
    "SELECT token FROM pms51_tokens WHERE activo = 1"
  );

  PMS51_TOKENS = rows
    .map(r => String(r.token).trim().toUpperCase())
    .filter(Boolean);

  // 🔒 Fallback de seguridad
  if (!PMS51_TOKENS.length) {
    PMS51_TOKENS = ["CASE", "CARTON", "PALLET", "BAG", "DRUM"];
  }

}

// ============================================
// CRUD PARTICIPANTES
// ============================================

// GET - Obtener todos los participantes CON sus códigos PIL
app.get('/api/mantenedores/participantes', async (req, res) => {
  try {
    const { tipo } = req.query; // 👈 AGREGAR ESTO

    let query = `
      SELECT 
         p.id, 
         p.codigo_bms, 
         p.codigo_almacen,  -- 👈 AGREGAR ESTA COLUMNA
         t.codigo_pil,
         p.nombre, 
         p.rut, 
         p.direccion, 
         p.ciudad, 
         p.pais, 
         p.email, 
         p.telefono, 
         p.contacto, 
         p.matchcode, 
         p.tiene_contacto_valido,
         p.created_at, 
         p.updated_at 
       FROM participantes p
       LEFT JOIN traductor_pil_bms t ON p.id = t.participante_id AND t.activo = 1
    `;

    // 🔥 FILTRO PARA ALMACENADORES
    if (tipo === 'almacenador') {
      query += ' WHERE p.codigo_almacen IS NOT NULL';
    }

    query += ' ORDER BY p.nombre ASC';

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener participantes:', error);
    res.status(500).json({ error: 'Error al obtener participantes' });
  }
});
// GET - Obtener UN participante específico CON su código PIL
app.get('/api/mantenedores/participantes/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         p.id, 
         p.codigo_bms, 
         t.codigo_pil,  -- 🔥 Traer desde traductor_pil_bms
         p.nombre, 
         p.rut, 
         p.direccion, 
         p.ciudad, 
         p.pais, 
         p.email, 
         p.telefono, 
         p.contacto, 
         p.matchcode, 
         p.tiene_contacto_valido,
         p.created_at, 
         p.updated_at 
       FROM participantes p
       LEFT JOIN traductor_pil_bms t ON p.id = t.participante_id AND t.activo = 1
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener participante:', error);
    res.status(500).json({ error: 'Error al obtener el participante' });
  }
});

// POST - Crear participante
app.post('/api/mantenedores/participantes', async (req, res) => {
  const {
    codigo_bms, nombre, rut, direccion, ciudad, pais,
    email, telefono, contacto, matchcode, tiene_contacto_valido, codigo_almacen
  } = req.body;

  try {
    if (!codigo_bms || !nombre) {
      return res.status(400).json({ error: 'codigo_bms y nombre son obligatorios' });
    }

    // 🔥 CALCULAR AUTOMÁTICAMENTE tiene_contacto_valido
    const tieneEmail = email && email.trim();
    const tieneTelefono = telefono && telefono.trim();
    const tiene_contacto_valido = (tieneEmail || tieneTelefono) ? 1 : 0;

    const [result] = await pool.query(
      `INSERT INTO participantes 
       (codigo_bms, nombre, rut, direccion, ciudad, pais, 
        email, telefono, contacto, matchcode, tiene_contacto_valido, codigo_almacen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo_bms.trim(),
        nombre.trim(),
        rut || null,
        direccion || null,
        ciudad || null,
        pais || null,
        email || null,
        telefono || null,
        contacto || null,
        matchcode || null,
        tiene_contacto_valido,  // 🔥 Valor calculado automáticamente
        codigo_almacen || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      codigo_bms: codigo_bms.trim(),
      nombre: nombre.trim(),
      rut: rut || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      pais: pais || null,
      email: email || null,
      telefono: telefono || null,
      contacto: contacto || null,
      matchcode: matchcode || null,
      tiene_contacto_valido: tiene_contacto_valido  // 🔥 Devolver valor calculado
    });
  } catch (error) {
    console.error('Error al crear participante:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El código BMS ya existe' });
    }

    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// PUT - Actualizar participante
// PUT - Actualizar participante
app.put('/api/mantenedores/participantes/:id', async (req, res) => {
  const { id } = req.params;
  const {
    codigo_bms, nombre, rut, direccion, ciudad, pais,
    email, telefono, contacto, matchcode, codigo_almacen
  } = req.body;

  console.log('🔧 PUT participante recibido:', { id, body: req.body });

  try {
    if (!codigo_bms || !nombre) {
      return res.status(400).json({ error: 'codigo_bms y nombre son obligatorios' });
    }

    const idNum = Number(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM participantes WHERE id = ?',
      [idNum]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // 🔥 CALCULAR AUTOMÁTICAMENTE tiene_contacto_valido
    const tieneEmail = email && email.trim();
    const tieneTelefono = telefono && telefono.trim();
    const tiene_contacto_valido = (tieneEmail || tieneTelefono) ? 1 : 0;

    const [result] = await pool.query(
      `UPDATE participantes 
       SET codigo_bms = ?, nombre = ?, rut = ?, direccion = ?, ciudad = ?, 
           pais = ?, email = ?, telefono = ?, contacto = ?, matchcode = ?, 
           tiene_contacto_valido = ?, codigo_almacen = ?
       WHERE id = ?`,
      [
        codigo_bms.trim(),
        nombre.trim(),
        rut || null,
        direccion || null,
        ciudad || null,
        pais || null,
        email || null,
        telefono || null,
        contacto || null,
        matchcode || null,
        tiene_contacto_valido,  // 🔥 Valor calculado automáticamente
        codigo_almacen || null,
        idNum,
      ]
    );

    console.log('✅ Participante actualizado:', {
      id: idNum,
      codigo_bms,
      nombre,
      tiene_contacto_valido,  // 🔥 Mostrar en log
      affectedRows: result.affectedRows
    });

    res.json({
      id: idNum,
      codigo_bms: codigo_bms.trim(),
      nombre: nombre.trim(),
      rut: rut || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      pais: pais || null,
      email: email || null,
      telefono: telefono || null,
      contacto: contacto || null,
      matchcode: matchcode || null,
      tiene_contacto_valido: tiene_contacto_valido  // 🔥 Devolver valor calculado
    });
  } catch (error) {
    console.error('❌ Error al actualizar participante:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El código BMS ya existe' });
    }

    res.status(500).json({
      error: 'Error al actualizar el registro',
      details: error.message
    });
  }
});

// DELETE - Eliminar participante
app.delete('/api/mantenedores/participantes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM participantes WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    res.json({ message: 'Participante eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar participante:', error);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

// ============================================
// CRUD TRADUCTOR PIL-BMS
// ============================================
// GET - Obtener todos los traductores PIL-BMS CON nombre de participante
app.get('/api/mantenedores/traductor-pil-bms', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         t.id, 
         t.codigo_pil, 
         t.codigo_bms, 
         t.participante_id,
         p.nombre as participante_nombre,  -- 🔥 Traer nombre del participante
         p.codigo_bms as participante_codigo_bms,  -- 🔥 Opcional: para mostrar más info
         t.activo,
         t.created_at
       FROM traductor_pil_bms t
       LEFT JOIN participantes p ON t.participante_id = p.id
       ORDER BY t.codigo_pil ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener traductor PIL-BMS:', error);
    res.status(500).json({ error: 'Error al obtener traductor PIL-BMS' });
  }
});

// GET - Obtener UN traductor específico CON nombre de participante
app.get('/api/mantenedores/traductor-pil-bms/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         t.id, 
         t.codigo_pil, 
         t.codigo_bms, 
         t.participante_id,
         p.nombre as participante_nombre,  -- 🔥 Traer nombre del participante
         t.activo,
         t.created_at
       FROM traductor_pil_bms t
       LEFT JOIN participantes p ON t.participante_id = p.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Traductor no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener traductor:', error);
    res.status(500).json({ error: 'Error al obtener el traductor' });
  }
});

// POST - Crear traducción
app.post('/api/mantenedores/traductor-pil-bms', async (req, res) => {
  const { codigo_pil, codigo_bms, participante_id, activo } = req.body;

  try {
    if (!codigo_pil || !codigo_bms) {
      return res.status(400).json({ error: 'codigo_pil y codigo_bms son obligatorios' });
    }

    const activoValue = activo !== undefined ? Number(activo) : 1;
    const participanteIdValue = participante_id ? Number(participante_id) : null;

    const [result] = await pool.query(
      `INSERT INTO traductor_pil_bms (codigo_pil, codigo_bms, participante_id, activo)
       VALUES (?, ?, ?, ?)`,
      [
        codigo_pil.trim(),
        codigo_bms.trim(),
        participanteIdValue,
        activoValue
      ]
    );

    res.status(201).json({
      id: result.insertId,
      codigo_pil: codigo_pil.trim(),
      codigo_bms: codigo_bms.trim(),
      participante_id: participanteIdValue,
      activo: activoValue
    });
  } catch (error) {
    console.error('Error al crear traducción:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El código PIL ya existe' });
    }

    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// PUT - Actualizar traducción
app.put('/api/mantenedores/traductor-pil-bms/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo_pil, codigo_bms, participante_id, activo } = req.body;

  console.log('🔧 PUT traductor-pil-bms recibido:', { id, body: req.body });

  try {
    if (!codigo_pil || !codigo_bms) {
      return res.status(400).json({ error: 'codigo_pil y codigo_bms son obligatorios' });
    }

    const activoValue = activo !== undefined ? Number(activo) : 1;
    if (![0, 1].includes(activoValue)) {
      return res.status(400).json({ error: 'El campo activo debe ser 0 o 1' });
    }

    const participanteIdValue = participante_id ? Number(participante_id) : null;

    const idNum = Number(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM traductor_pil_bms WHERE id = ?',
      [idNum]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Traducción no encontrada' });
    }

    const [result] = await pool.query(
      `UPDATE traductor_pil_bms 
       SET codigo_pil = ?, codigo_bms = ?, participante_id = ?, activo = ?
       WHERE id = ?`,
      [
        codigo_pil.trim(),
        codigo_bms.trim(),
        participanteIdValue,
        activoValue,
        idNum
      ]
    );

    console.log('✅ Traducción actualizada:', {
      id: idNum,
      codigo_pil,
      codigo_bms,
      participante_id: participanteIdValue,
      activo: activoValue,
      affectedRows: result.affectedRows
    });

    res.json({
      id: idNum,
      codigo_pil: codigo_pil.trim(),
      codigo_bms: codigo_bms.trim(),
      participante_id: participanteIdValue,
      activo: activoValue
    });
  } catch (error) {
    console.error('❌ Error al actualizar traducción:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El código PIL ya existe' });
    }

    res.status(500).json({
      error: 'Error al actualizar el registro',
      details: error.message
    });
  }
});

// DELETE - Eliminar traducción
app.delete('/api/mantenedores/traductor-pil-bms/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM traductor_pil_bms WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Traducción no encontrada' });
    }

    res.json({ message: 'Traducción eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar traducción:', error);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});


// 🔥 AGREGAR ESTE ENDPOINT EN TU ARCHIVO DE RUTAS

// POST /api/mantenedores/traductor-pil-bms/sync-participante
app.post("/api/mantenedores/traductor-pil-bms/sync-participante", async (req, res) => {
  const { codigo_pil, codigo_bms, participante_id, activo } = req.body;

  try {
    // Validar datos requeridos
    if (!codigo_pil || !codigo_bms) {
      return res.status(400).json({
        error: "codigo_pil y codigo_bms son obligatorios"
      });
    }

    // Buscar si ya existe una traducción para este codigo_pil
    const [existing] = await pool.query(
      'SELECT id FROM traductor_pil_bms WHERE codigo_pil = ?',
      [codigo_pil]
    );

    if (existing.length > 0) {
      // 🔄 ACTUALIZAR traducción existente
      await pool.query(
        `UPDATE traductor_pil_bms 
         SET codigo_bms = ?, participante_id = ?, activo = ?, updated_at = NOW()
         WHERE codigo_pil = ?`,
        [codigo_bms, participante_id || null, activo !== undefined ? Number(activo) : 1, codigo_pil]
      );

      res.json({
        success: true,
        message: "Traducción PIL-BMS actualizada",
        id: existing[0].id,
        action: "updated"
      });
    } else {
      // ➕ CREAR nueva traducción
      const [result] = await pool.query(
        `INSERT INTO traductor_pil_bms (codigo_pil, codigo_bms, participante_id, activo, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [codigo_pil, codigo_bms, participante_id || null, activo !== undefined ? Number(activo) : 1]
      );

      res.status(201).json({
        success: true,
        message: "Traducción PIL-BMS creada",
        id: result.insertId,
        action: "created"
      });
    }
  } catch (error) {
    console.error("Error sincronizando traductor PIL-BMS:", error);
    res.status(500).json({
      error: "Error al sincronizar traductor PIL-BMS",
      details: error.message
    });
  }
});
// 📍 INSERTAR AQUÍ (después del GET /manifiestos/:id/pms, línea ~1780)
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

function pickFirstWithSuffix(lines, code) {
  // Busca líneas que empiecen exactamente con el código (ej: "16B")
  return lines.find((l) => {
    const s = String(l || "").trim();
    const match = s.match(/^(\d{2}[A-Z]?)\s/);
    return match && match[1] === code;
  }) || "";
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

// Normal (1 sola 14): PE/PD = esa 14
// Transbordo (varias 14): PE = FROM de la primera (01SH si existe)
//                         PD = TO de la última (mayor xxSH o última por aparición)
function pickPEPD(lines14) {
  const arr = Array.isArray(lines14) ? lines14 : [];

  const parsed = arr.map((l, idx) => {
    const s = String(l || "").toUpperCase();

    // 14   02SHCNNGBSGSIN...
    const mStep = s.match(/\b(\d{2})SH/);
    const step = mStep ? Number(mStep[1]) : null;

    // Parse fuerte: FROM/TO fijo en PMS (5+5)
    const m = s.match(/^14\s+\d{2}SH([A-Z]{5})([A-Z]{5})/);
    let pe = m ? m[1] : "";
    let pd = m ? m[2] : "";

    // Fallback a tu extractor si no calzó
    if ((!pe || !pd) && typeof extractPEPDFrom14 === "function") {
      const x = extractPEPDFrom14(l) || {};
      pe = pe || x.pe || "";
      pd = pd || x.pd || "";
    }

    return { idx, step, pe, pd, raw: l };
  }).filter(x => x.pe && x.pd);

  if (!parsed.length) return { pe: "", pd: "" };

  const hasSteps = parsed.some(x => Number.isFinite(x.step));
  const ordered = [...parsed].sort((a, b) => {
    if (hasSteps) {
      const sa = Number.isFinite(a.step) ? a.step : 999;
      const sb = Number.isFinite(b.step) ? b.step : 999;
      if (sa !== sb) return sa - sb;
    }
    return a.idx - b.idx;
  });

  const first = ordered.find(x => x.step === 1) || ordered[0];
  const last = ordered[ordered.length - 1];

  return { pe: first.pe, pd: last.pd };
}


// --------- Extractores PMS ---------
function parseLine56(raw) {
  const s = String(raw || "").toUpperCase();

  // 56 01 001 001  (ej: "56 01001004 ...")
  const m = s.match(/^56\s*(\d{2})(\d{3})(\d{3})/);
  if (!m) return null;

  const itemNo = Number(m[2]); // "001" => 1
  const seqNo = Number(m[3]); // "004" => 4 (según tu PMS)

  // ✅ CLAVE: buscar IMO SOLO después del header (evita capturar 01001004 como UN=1004)
  const tail = s.slice(m[0].length);

  let un = "";
  let clase = "";

  // 1) Preferido: "UN3077" (con o sin espacios / ceros)
  const unMatch = tail.match(/UN\s*0*(\d{4})/);
  if (unMatch) un = unMatch[1];

  // 2) Preferido: "CLASS 9" (con o sin espacios / ceros)
  const classMatch = tail.match(/CLASS\s*0*(\d{1,2})/);
  if (classMatch) clase = classMatch[1];

  // 3) Fallback: formato compacto "3077A9" o "3077 A9"
  //    (usamos (^|[^0-9]) para no enganchar dígitos pegados raros)
  if (!un || !clase) {
    const compact = tail.match(/(^|[^0-9])0*(\d{4})\s*A\s*0*(\d{1,2})/);
    if (compact) {
      if (!un) un = compact[2];
      if (!clase) clase = compact[3];
    }
  }

  // ✅ IMPORTANTE: NO retornes null si falta IMO.
  // Queremos que "exista línea 56" para _hasLinea56 y para que insertImo valide calidad.
  return { itemNo, seqNo, un, clase };
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

  // tipo_cnt: N22G1E / N22G1F  => guardamos "22G1"
  const mTipo = line.match(/N(\d{2}[A-Z]\d)[EF]/);
  const tipo_cnt = mTipo ? mTipo[1] : null;

  const unidad_peso = line.includes("KGM") ? "KGM" : null;
  const unidad_volumen = line.includes("MTQ") ? "MTQ" : null;

  // 🔥 AGREGAR ESTA LÍNEA (la que faltaba):
  const carga_cnt = line.includes("FCL") ? "FCL" : line.includes("LCL") ? "LCL" : null;

  let peso = null;
  let volumen = null;

  // ===========================
  // 1) TOKEN desde tabla/cache
  // ===========================
  let token = null;
  let idx = -1;

  const tokens = Array.isArray(PMS51_TOKENS) ? PMS51_TOKENS : [];
  for (const t of tokens) {
    const tt = String(t).toUpperCase();
    const i = line.indexOf(tt);
    if (i !== -1) { token = tt; idx = i; break; }
  }

  // =========================================
  // 2) Peso/Volumen + TAIL (cola para sellos)
  // =========================================
  let tail = "";

  if (token && idx !== -1) {
    const after = line.slice(idx + token.length);

    const mNums = after.match(/(\d{10})(\d{10})(\d{7,9})/);

    if (mNums) {
      const w10 = mNums[1];
      const v = mNums[3];

      peso = parseFloat(w10) / 10000;

      volumen = parseFloat((parseFloat(v) / 1000).toFixed(2));

      const pos = after.indexOf(mNums[0]);
      tail = (pos !== -1) ? after.slice(pos + mNums[0].length) : after;
    } else {
      tail = after;
    }
  }

  // ===========================
  // 3) Sellos SOLO desde tail
  // ===========================
  const sellos = [];
  if (tail) {
    const mSeal = tail.match(/\b(?:CL|BZ|JG)[0-9A-Z]{5,}\b|\b\d{5,10}\b/g);
    if (mSeal) for (const s of mSeal) if (!sellos.includes(s)) sellos.push(s);
  }

  return {
    itemNo,
    seqNo,
    codigo,
    sigla,
    numero,
    digito,
    tipo_cnt,
    carga_cnt,  // 🔥 Ahora está definido
    peso,
    unidad_peso,
    volumen,
    unidad_volumen,
    sellos,

    // defaults seguridad
    _hasLinea56: false,
    imo: [],
  };
}




function extractContainersFrom51(lines51) {
  if (!Array.isArray(lines51)) return [];
  const out = [];

  for (const l of lines51) {
    const c = parseLine51(l);
    if (!c) continue;

    // Defaults (punto 3)
    c._hasLinea56 = false;
    c.imo = Array.isArray(c.imo) ? c.imo : [];

    out.push(c);
  }

  const seen = new Set();
  return out.filter(c => c.codigo && !seen.has(c.codigo) && seen.add(c.codigo));
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

function extractPartyName(rawLine) {
  if (!rawLine) return null;

  const s = String(rawLine);

  // Quita el prefijo "16   CL101367" o "21   KR" o "26  1KR800791"
  // (2 dígitos de tipo + espacios + id + espacios)
  const rest = s.replace(/^\s*\d{2}\s+\S+\s+/, "");

  // Split por "columnas" (2+ espacios)
  const cols = rest.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);

  // El nombre debería ser la primera columna
  const name = cols[0] || null;

  // Si justo quedó un código tipo "CLSCL" o "KRSEL" como "nombre", es porque faltaba el nombre.
  // En ese caso devuelve null para que dispare tu validación.
  if (name && /^[A-Z]{5}$/.test(name)) return null;

  return name;
}
// ============================================
// ✅ NUEVA FUNCIÓN: Extraer código PIL + nombre
// Agregar después de la línea 2139 (después de extractPartyName)
// ============================================
function extractPartyCodeAndName(rawLine) {
  if (!rawLine) return { codigo_pil: null, nombre: null, direccion: null };

  const s = String(rawLine).trim();

  // Formato: "16   CL101742         INTER-TANK SPA                      DIRECCION COMPLETA AQUI"
  // Capturar: tipo_linea (16/21/26) + código_pil + resto
  const match = s.match(/^\s*(\d{2})\s+(\S+)\s+(.+)$/);

  if (!match) {
    return { codigo_pil: null, nombre: null, direccion: null };
  }

  const tipoLinea = match[1];  // "16", "21", "26"
  let codigoPil = match[2];    // "CL101742", "CN116263", "1CN116263"
  const resto = match[3];      // "INTER-TANK SPA   DIRECCION..."

  // ⚠️ CASO ESPECIAL: Línea 26 (NOTIFY) puede tener "1" adelante del código
  if (tipoLinea === "26" && codigoPil.startsWith("1") && codigoPil.length > 2) {
    codigoPil = codigoPil.substring(1); // "1CN116263" → "CN116263"
  }

  // Extraer columnas separadas por 2+ espacios
  const cols = resto.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);

  const nombre = cols[0] || null;
  const direccion = cols.slice(1).join(' ').trim() || null; // Todo lo demás es dirección

  // Si el nombre parece ser un código de país (ej: "CLSCL"), es inválido
  if (nombre && /^[A-Z]{5}$/.test(nombre)) {
    return { codigo_pil: codigoPil, nombre: null, direccion: null };
  }

  return {
    codigo_pil: normalizeStr(codigoPil),
    nombre: nombre,
    direccion: direccion ? normalizeStr(direccion) : null
  };
}

/**
 * Extrae teléfono y email de líneas 16B, 21B, 26B
 * Formato: "16B  5692274318          medc@gamil.com"
 * Formato: "21B                      info@rootscomp.net"
 * Formato: "26B 1                    tomasbianchi@rootscomp.net"
 */
function extractPartyContact(rawLine) {
  if (!rawLine) return { telefono: null, email: null };

  const s = String(rawLine).trim();

  // Formato: tipo_linea (16B/21B/26B) + [teléfono opcional] + [email opcional]
  // Usar regex para capturar después del tipo de línea
  const match = s.match(/^\s*(\d{2}B)\s+(.*)$/);

  if (!match) {
    return { telefono: null, email: null };
  }

  const resto = match[2].trim(); // Todo después de "16B ", "21B ", etc.

  // Separar por espacios múltiples (2+)
  const parts = resto.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);

  let telefono = null;
  let email = null;

  // Buscar email (contiene @)
  for (const part of parts) {
    if (part.includes('@')) {
      email = part;
    }
  }

  // Lo que queda y no es email, asumimos es teléfono (si es numérico o tiene formato válido)
  for (const part of parts) {
    if (!part.includes('@') && part.length > 0) {
      // Puede ser teléfono o el "1" del notify, validar si tiene dígitos
      if (/\d/.test(part) && part.length > 2) {
        telefono = part;
      }
    }
  }

  return {
    telefono: normalizeStr(telefono),
    email: normalizeStr(email)
  };
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
        carga_cnt: null,
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

    // cantidad esperada desde 41 (ej: "Y000003")
    const my = String(l).match(/Y(\d{6})/);
    if (my) {
      const exp = parseInt(my[1], 10);
      if (Number.isFinite(exp)) it.cantidad = exp;
    }

    if (typeof extractWeightVolumeFrom41 === "function") {
      const { peso, volumen } = extractWeightVolumeFrom41(l);
      if (typeof peso === "number") it.peso_bruto = peso;
      if (typeof volumen === "number") it.volumen = volumen;
    }

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

  const arr = [...byItem.values()].sort((a, b) => a.numero_item - b.numero_item);

  // ✅ NUEVO: negocio Sidemar (todo en item 1; el resto ".")
  if (arr.length > 1) {
    const first = arr[0];

    // juntar todo lo que exista en cualquier item dentro del primero
    const allDesc = arr.map(x => (x.descripcion || "").trim()).filter(Boolean).join(" ");
    const allMarcas = arr.map(x => (x.marcas || "").trim()).filter(Boolean).join(" ");

    first.descripcion = (allDesc || first.descripcion || ".").trim();
    first.marcas = (allMarcas || first.marcas || ".").trim();

    for (let i = 1; i < arr.length; i++) {
      arr[i].descripcion = ".";
      arr[i].marcas = ".";
    }
  } else if (arr.length === 1) {
    // si solo hay 1 item y viene vacío, igual lo protegemos
    arr[0].descripcion = (arr[0].descripcion || ".").trim();
    arr[0].marcas = (arr[0].marcas || ".").trim();
  }

  return arr;
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

function parseLegs14(lines14) {
  const legs = [];
  const arr = Array.isArray(lines14) ? lines14 : [];

  for (const raw of arr) {
    const s = String(raw || "").toUpperCase();
    const mStep = s.match(/\b(\d{2})SH/);
    const step = mStep ? Number(mStep[1]) : 999;

    const m = s.match(/^14\s+\d{2}SH([A-Z]{5})([A-Z]{5})/);
    if (!m) continue;

    legs.push({ step, from: m[1], to: m[2] });
  }

  legs.sort((a, b) => a.step - b.step);
  return legs;
}

function extractTransbordos(legs) {
  if (!Array.isArray(legs) || legs.length <= 1) return [];
  return legs.slice(0, -1).map(l => l.to); // intermedios
}

function extractLugarEmisionFrom00(l00) {
  const s = String(l00 || "").toUpperCase();

  // 12 dígitos (YYYYMMDDHHMM) + espacios + tomar los siguientes 5 chars (aunque vengan pegados a más texto)
  const m = s.match(/\b\d{12}\s+([A-Z0-9]{5})/);
  if (!m) return "";

  const code = m[1];

  // Validación simple de UNLOCODE: 2 letras + 3 alfanum
  if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(code)) return "";

  return code;
}

function pickLugarEmisionCod(lines, header00) {
  const l74 = pickFirst(lines, "74");
  if (l74) {
    const cod = l74.substring(5, 10).trim();
    if (cod) return cod;
  }

  return null;  // ✅ Sin fallback
}

const { DateTime } = require('luxon');

const convertSingaporeToChile = (dateStr) => {
  if (!dateStr) return null;
  try {
    const dt = DateTime.fromSQL(dateStr, { zone: 'Asia/Singapore' });
    if (!dt.isValid) return null;
    return dt.setZone('America/Santiago').toFormat('yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    console.error('error:', e);
    return null;
  }
};
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

  const lugarEmisionCodGlobal = pickLugarEmisionCod(lines, header00);

  return blocks
    .map((bLines) => {
      const l12 = pickFirst(bLines, "12");
      const blNumber = extractBLNumber(l12);
      if (!blNumber) return null;

      const tipoServicioCod = extractServiceCodeFrom12(l12);

      // ✅ Extraer datos completos de participantes (líneas 16, 21, 26)
      const shipperData = extractPartyCodeAndName(pickFirst(bLines, "16"));
      const consigneeData = extractPartyCodeAndName(pickFirst(bLines, "21"));
      const notifyData = extractPartyCodeAndName(pickFirst(bLines, "26"));

      // ✅ Extraer contacto de participantes (líneas 16B, 21B, 26B)
      const shipperContact = extractPartyContact(pickFirstWithSuffix(bLines, "16B"));
      const consigneeContact = extractPartyContact(pickFirstWithSuffix(bLines, "21B"));
      const notifyContact = extractPartyContact(pickFirstWithSuffix(bLines, "26B"));

      // Mantener compatibilidad con código anterior (nombre solo)
      const shipper = shipperData.nombre;
      const consignee = consigneeData.nombre;
      const notify = notifyData.nombre;

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

      const legs14 = parseLegs14(lines14);
      const transbordos = extractTransbordos(legs14); // ["CNNGB","SGSIN"] si aplica

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
      // lo sigues usando para bultos

      const weightKgs = extractWeightFrom12(l12);

      const items = extractItemsFrom41_44_47(bLines) || []; // tu función actual
      const contenedores = extractContainersFrom51(pickAll(bLines, "51")) || [];

      const totalContainers = contenedores.length;

      const raw56 = pickAll(bLines, "56");
      const lines56 = raw56.map(parseLine56).filter(Boolean);

      // pega IMO a cada contenedor por itemNo + seqNo
      for (const c of contenedores) {
        const hits = lines56.filter(x =>
          Number(x.itemNo) === Number(c.itemNo) &&
          Number(x.seqNo) === Number(c.seqNo)
        );

        c._hasLinea56 = hits.length > 0;

        c.imo = hits.map(h => ({ clase_imo: h.clase, numero_imo: h.un }));
      }

      for (const it of items) {
        const itemNum = Number(it.numero_item);

        const contsDelItem = (contenedores || []).filter(c => Number(c.itemNo) === itemNum);

        it.cantidad_real = contsDelItem.length;

        const tieneLinea56 = contsDelItem.some(c => c._hasLinea56 === true);
        it.carga_peligrosa = tieneLinea56 ? "S" : "N";
      }

      const lugar_recepcion_cod = puertoEmbarqueCod; // LRM
      const lugar_destino_cod = puertoDescargaCod; // LD
      const lugar_entrega_cod = puertoDescargaCod; // LEM


      return {
        // ====== lo que ya usas hoy ======
        blNumber,
        tipoServicioCod,

        shipper,
        shipper_direccion: shipperData.direccion,
        shipper_telefono: shipperContact.telefono,
        shipper_email: shipperContact.email,
        shipper_codigo_pil: shipperData.codigo_pil,

        consignee,
        consignee_direccion: consigneeData.direccion,
        consignee_telefono: consigneeContact.telefono,
        consignee_email: consigneeContact.email,
        consignee_codigo_pil: consigneeData.codigo_pil,

        notify,
        notify_direccion: notifyData.direccion,
        notify_telefono: notifyContact.telefono,
        notify_email: notifyContact.email,
        notify_codigo_pil: notifyData.codigo_pil,

        descripcion_carga: null,

        peso_bruto: weightKgs,
        unidad_peso: unidadPeso,
        volumen: foundVol ? totalVolumen : 0,
        unidad_volumen: unidadVolumen,

        bultos: totalContainers,
        total_items: totalItems,

        fecha_presentacion: convertSingaporeToChile(fechaPresentacion),
        fecha_emision: fechaEmision,
        fecha_embarque: fechaEmbarque,
        fecha_zarpe: fechaZarpe,

        lugar_emision_cod: lugarEmisionCodGlobal, // LE (74)
        puerto_embarque_cod: puertoEmbarqueCod,   // PE (14, fallback 13)
        puerto_descarga_cod: puertoDescargaCod,   // PD (14, fallback 13)

        lugar_recepcion_cod,
        lugar_destino_cod,
        lugar_entrega_cod,

        transbordos,


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

// 🔥 HELPER: Obtener peso tara por tipo de contenedor
async function getPesoTaraByTipoCnt(conn, tipoCnt) {
  if (!tipoCnt) return null;
  const [[row]] = await conn.query(
    'SELECT peso_tara_kg FROM tipo_cnt_tipo_bulto WHERE tipo_cnt = ?',
    [tipoCnt]
  );
  return row?.peso_tara_kg || null;
}

app.post("/manifiestos/:id/pms/procesar-directo", upload.single("pms"), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: "Archivo no recibido (campo: pms)" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Validar manifiesto y obtener tipo_operacion
    const [mRows] = await conn.query("SELECT id, tipo_operacion FROM manifiestos WHERE id = ?", [id]);
    if (mRows.length === 0) {
      await conn.rollback();
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Manifiesto no existe" });
    }

    const tipoOperacion = mRows[0].tipo_operacion; // ✅ Guardar para usar después

    // 2) Leer archivo
    const content = fs.readFileSync(req.file.path, "utf-8");

    // 3) Borrar temporal
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // 4) Parsear BLs
    const bls = parsePmsByFile(req.file.originalname, content);
    if (!Array.isArray(bls) || bls.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "No se encontraron BLs en el PMS" });
    }

    // ============================
    // PRECHECK_GLOBAL
    // ============================

    // 4.1) Normalizar BLs del archivo, ignorar duplicados en archivo (NO aborta)
    const blsUnicos = [];
    const seen = new Set();
    const duplicadosEnArchivo = []; // solo para informar

    for (const b of bls) {
      const blNumber = (b?.blNumber || "").trim();
      if (!blNumber) continue;

      if (seen.has(blNumber)) {
        duplicadosEnArchivo.push(blNumber);
        continue; // ✅ ignorado
      }
      seen.add(blNumber);
      blsUnicos.push(b);
    }

    if (blsUnicos.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "No se encontraron BLs válidos (blNumber vacío)" });
    }

    const blNumbers = blsUnicos.map(b => (b.blNumber || "").trim());

    // 4.2) Buscar existentes en 1 query
    const [existRows] = await conn.query(
      `SELECT id, bl_number, manifiesto_id
       FROM bls
       WHERE bl_number IN (?)`,
      [blNumbers]
    );

    // 4.3) Si existe en OTRO manifiesto => abortar TODO
    const conflictosOtroManifiesto = existRows
      .filter(r => Number(r.manifiesto_id) !== Number(id))
      .map(r => ({ bl_number: r.bl_number, manifiesto_existente: r.manifiesto_id }));

    if (conflictosOtroManifiesto.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        error: "Hay BLs que ya existen en otro manifiesto. Carga rechazada.",
        conflictos: conflictosOtroManifiesto,
      });
    }

    // 4.4) Mapa de existentes en el mismo manifiesto (para reemplazar)
    const existentesMismoManifiesto = new Map(); // bl_number -> bl_id
    for (const r of existRows) {
      if (Number(r.manifiesto_id) === Number(id)) {
        existentesMismoManifiesto.set(r.bl_number, r.id);
      }
    }

    // ============================
    // SQL INSERTS
    // ============================
    const insertBlSql = `
      INSERT INTO bls
        (manifiesto_id, bl_number, tipo_servicio_id,
         shipper, shipper_direccion, shipper_telefono, shipper_email, shipper_codigo_pil, shipper_id,
         consignee, consignee_direccion, consignee_telefono, consignee_email, consignee_codigo_pil, consignee_id,
         notify_party, notify_direccion, notify_telefono, notify_email, notify_codigo_pil, notify_id,
         lugar_emision_id, puerto_embarque_id, puerto_descarga_id,
         lugar_destino_id, lugar_entrega_id, lugar_recepcion_id,
         lugar_emision_cod, puerto_embarque_cod, puerto_descarga_cod,
         lugar_destino_cod, lugar_entrega_cod, lugar_recepcion_cod,
         descripcion_carga,
         peso_bruto, unidad_peso,
         volumen, unidad_volumen,
         bultos, total_items,
         fecha_emision, fecha_presentacion, fecha_embarque, fecha_zarpe,
         status)
      VALUES
        (?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?,
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

    const insertContSql = `
      INSERT INTO bl_contenedores
        (bl_id, item_id, codigo, sigla, numero, digito,
         tipo_cnt, carga_cnt, peso, unidad_peso, volumen, unidad_volumen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // ============================
    // CARGA_REAL
    // ============================
    let insertedOk = 0;          // ✅ NUEVOS (no existían en el manifiesto)
    let reemplazadosCount = 0;   // ✅ REEMPLAZADOS (sí existían en el manifiesto)

    for (const b of blsUnicos) {
      const pendingValidations = [];
      const blNumber = (b.blNumber || "").trim();
      if (!blNumber) continue;

      const esEmpty = String(b.tipoServicioCod || "").trim().toUpperCase() === "MM";

      // A) Si existe en el mismo manifiesto => reemplazar
      const existenteId = existentesMismoManifiesto.get(blNumber) || null;

      // ✅ FIX CONTEO: marcar si esto será reemplazo
      const esReemplazo = !!existenteId;

      if (existenteId) {
        await conn.query("DELETE FROM bls WHERE id = ?", [existenteId]);
        reemplazadosCount++;
        // evita re-delete si por alguna razón aparece otra vez (aunque ya filtramos)
        existentesMismoManifiesto.delete(blNumber);
      }

      let lugarEmisionCod = b.lugar_emision_cod;

      if (!lugarEmisionCod && tipoOperacion === 'S') {
        lugarEmisionCod = 'CLSCL';  // Exportación
      }

      const lugarEmisionId = await getPuertoIdByCodigo(conn, lugarEmisionCod);

      if (!lugarEmisionId) pendingValidations.push({
        nivel: "BL", severidad: "ERROR", campo: "lugar_emision_id",
        mensaje: `Lugar de emisión '${b.lugar_emision_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 74)`,
        valorCrudo: b.lugar_emision_cod || null
      });

      const puertoEmbarqueId = await getPuertoIdByCodigo(conn, b.puerto_embarque_cod);
      if (!puertoEmbarqueId) pendingValidations.push({
        nivel: "BL", severidad: "ERROR", campo: "puerto_embarque_id",
        mensaje: `Puerto de embarque '${b.puerto_embarque_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 14 o 13)`,
        valorCrudo: b.puerto_embarque_cod || null
      });

      const puertoDescargaId = await getPuertoIdByCodigo(conn, b.puerto_descarga_cod);
      if (!puertoDescargaId) pendingValidations.push({
        nivel: "BL", severidad: "ERROR", campo: "puerto_descarga_id",
        mensaje: `Puerto de descarga '${b.puerto_descarga_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 14 o 13)`,
        valorCrudo: b.puerto_descarga_cod || null
      });

      const lugarDestinoId = await getPuertoIdByCodigo(conn, b.lugar_destino_cod);
      const lugarEntregaId = await getPuertoIdByCodigo(conn, b.lugar_entrega_cod);
      const lugarRecepcionId = await getPuertoIdByCodigo(conn, b.lugar_recepcion_cod);

      const tipoServicioId = await getTipoServicioIdByCodigo(conn, b.tipoServicioCod);
      if (!tipoServicioId) pendingValidations.push({
        nivel: "BL", severidad: "ERROR", campo: "tipo_servicio_id",
        mensaje: "Tipo de servicio no existe en mantenedor",
        valorCrudo: b.tipoServicioCod || null
      });

      // Ya no resolvemos participantes desde la BD
      const shipperId = null;
      const consigneeId = null;
      const notifyId = null;

      // Pre-calcular tipo_bulto para items
      for (const it of (b.items || [])) {
        const itemNum = Number(it.numero_item);
        const contsDelItem = (b.contenedores || []).filter(c => Number(c.itemNo) === itemNum);
        const tipoCnt = contsDelItem.find(c => c.tipo_cnt)?.tipo_cnt || null;
        it._tipo_cnt_detectado = tipoCnt; // 👈 DEBUG
        it.tipo_bulto = await getTipoBultoFromTipoCnt(conn, tipoCnt);
      }

      // 🔥 CALCULAR PESO REAL PARA MM (EMPTY)
      let pesoBrutoReal = b.peso_bruto ?? null;

      if (esEmpty) {
        let pesoTotal = 0;

        for (const it of (b.items || [])) {
          const itemNum = Number(it.numero_item);
          const contsDelItem = (b.contenedores || []).filter(c => Number(c.itemNo) === itemNum);

          // Obtener tipo_cnt del primer contenedor del item
          const tipoCnt = contsDelItem[0]?.tipo_cnt || null;

          if (tipoCnt) {
            const pesoTara = await getPesoTaraByTipoCnt(conn, tipoCnt);
            if (pesoTara) {
              // Peso tara × cantidad de contenedores de este item
              pesoTotal += pesoTara * contsDelItem.length;
            }
          }
        }

        pesoBrutoReal = pesoTotal > 0 ? pesoTotal : null;
      }

      // Insertar BL
      const [blIns] = await conn.query(insertBlSql, [
        id,
        blNumber,
        tipoServicioId,
        b.shipper || null,
        b.shipper_direccion || null,
        b.shipper_telefono || null,
        b.shipper_email || null,
        b.shipper_codigo_pil || null,
        shipperId || null,
        b.consignee || null,
        b.consignee_direccion || null,
        b.consignee_telefono || null,
        b.consignee_email || null,
        b.consignee_codigo_pil || null,
        consigneeId || null,
        b.notify || null,
        b.notify_direccion || null,
        b.notify_telefono || null,
        b.notify_email || null,
        b.notify_codigo_pil || null,
        notifyId || null,
        lugarEmisionId,
        puertoEmbarqueId,
        puertoDescargaId,
        lugarDestinoId,
        lugarEntregaId,
        lugarRecepcionId,
        lugarEmisionCod || null,
        b.puerto_embarque_cod || null,
        b.puerto_descarga_cod || null,
        b.lugar_destino_cod || null,
        b.lugar_entrega_cod || null,
        b.lugar_recepcion_cod || null,
        null, // descripcion_carga
        pesoBrutoReal,
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

      // ✅ FIX CONTEO: solo sumar a inserted si NO es reemplazo
      if (!esReemplazo) insertedOk++;

      await conn.query("DELETE FROM bl_validaciones WHERE bl_id = ?", [blId]);

      // Validaciones BL (igual que tu código)
      if (!lugarDestinoId) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_destino_id", mensaje: "Lugar destino no existe en mantenedor de puertos (Revisar puerto de descarga)", valorCrudo: b.lugar_destino_cod || null });
      if (!lugarEntregaId) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_entrega_id", mensaje: "Lugar entrega no existe en mantenedor de puertos (Revisar puerto de descarga)", valorCrudo: b.lugar_entrega_cod || null });
      if (!lugarRecepcionId) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_recepcion_id", mensaje: "Lugar recepción no existe en mantenedor de puertos (Revisar puerto de embarque)", valorCrudo: b.lugar_recepcion_cod || null });
      if (isBlank(b.fecha_emision)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_emision", mensaje: "Falta fecha_emision (Linea 11)", valorCrudo: b.fecha_emision || null });
      if (isBlank(b.fecha_presentacion)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_presentacion", mensaje: "Falta fecha_presentacion (Linea 00)", valorCrudo: b.fecha_presentacion || null });

      if (!esEmpty && num(b.peso_bruto) <= 0) {
        pendingValidations.push({
          nivel: "BL", severidad: "ERROR", campo: "peso_bruto",
          mensaje: "peso_bruto debe ser > 0",
          valorCrudo: b.peso_bruto
        });
      }

      if (isBlank(b.unidad_peso)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "unidad_peso", mensaje: "Falta unidad_peso (Linea 41)", valorCrudo: b.unidad_peso || null });
      if (num(b.bultos) < 1) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "bultos", mensaje: "bultos debe ser >= 1", valorCrudo: b.bultos });
      if (num(b.total_items) < 1) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "total_items", mensaje: "total_items debe ser >= 1", valorCrudo: b.total_items });
      if (isBlank(b.shipper)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "shipper", mensaje: "Falta shipper (Linea 16)", valorCrudo: b.shipper || null });
      if (isBlank(b.consignee)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "consignee", mensaje: "Falta consignee (Linea 21)", valorCrudo: b.consignee || null });
      if (isBlank(b.notify)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "notify_party", mensaje: "Falta notify (Linea 26)", valorCrudo: b.notify || null });
      if (isBlank(b.fecha_embarque)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_embarque", mensaje: "Falta fecha_embarque (Linea 14)", valorCrudo: b.fecha_embarque || null });
      if (isBlank(b.fecha_zarpe)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_zarpe", mensaje: "Falta fecha_zarpe (Linea 14)", valorCrudo: b.fecha_zarpe || null });
      if (isBlank(b.unidad_volumen)) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "unidad_volumen", mensaje: "Falta unidad_volumen (Linea 41)", valorCrudo: b.unidad_volumen || null });
      if (num(b.volumen) == null) pendingValidations.push({ nivel: "BL", severidad: "ERROR", campo: "volumen", mensaje: "Falta Volumen debe ser >= 0 (puede ser 0)", valorCrudo: b.volumen });

      for (const v of pendingValidations) {
        await addValidacion(conn, { blId, ...v });
        await addValidacionPMS(conn, { blId, ...v });
      }

      await insertTransbordos(conn, blId, b.transbordos || []);

      // INSERT ITEMS + CONTENEDORES (igual que tu lógica)
      const itemIdByNumero = new Map();
      const itemsArr = Array.isArray(b.items) ? b.items : [];

      // Contar contenedores por itemNo según lo que viene en el PMS
      const contCountByItemNo = new Map();
      const conts = Array.isArray(b.contenedores) ? b.contenedores : [];

      for (const c of conts) {
        const itemNo = Number(c?.itemNo);
        if (!itemNo) continue;
        contCountByItemNo.set(itemNo, (contCountByItemNo.get(itemNo) || 0) + 1);
      }

      for (const it of itemsArr) {
        const itemNum = Number(it.numero_item) || null;
        const pendingItemValidations = [];

        if (!itemNum) pendingItemValidations.push({ nivel: "ITEM", sec: null, severidad: "ERROR", campo: "numero_item", mensaje: "Item sin número", valorCrudo: it.numero_item ?? null });
        if (isBlank(it.descripcion)) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "OBS", campo: "descripcion", mensaje: "Falta Descripción", valorCrudo: it.descripcion ?? null });
        if (isBlank(it.marcas)) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "OBS", campo: "marcas", mensaje: "Falta Marcas", valorCrudo: it.marcas ?? null });

        if (!it.tipo_bulto) pendingItemValidations.push({
          nivel: "ITEM",
          sec: itemNum,
          severidad: "ERROR",
          campo: "tipo_bulto",
          mensaje: `No se pudo determinar tipo_bulto para el item (tipo_cnt detectado: ${it._tipo_cnt_detectado || 'NULL'})`,
          valorCrudo: it._tipo_cnt_detectado || null
        });

        if (!isSN(it.carga_peligrosa)) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "carga_peligrosa", mensaje: "carga_peligrosa debe ser 'S' o 'N'", valorCrudo: it.carga_peligrosa ?? null });
        if (num(it.cantidad) == null || num(it.cantidad) < 1) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "cantidad", mensaje: "Cantidad de contenedores debe ser >= 1 para un item (Linea 51)", valorCrudo: it.cantidad });

        if (!esEmpty && (num(it.peso_bruto) == null || num(it.peso_bruto) <= 0)) {
          pendingItemValidations.push({
            nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "peso_bruto",
            mensaje: "peso_bruto debe ser > 0 (Linea 41)",
            valorCrudo: it.peso_bruto
          });
        }

        if (isBlank(it.unidad_peso)) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "unidad_peso", mensaje: "Falta unidad_peso (Linea 41)", valorCrudo: it.unidad_peso ?? null });
        if (num(it.volumen) == null || num(it.volumen) < 0) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "volumen", mensaje: "Falta Volumen debe ser >= 0 (Linea 41)", valorCrudo: it.volumen });
        if (isBlank(it.unidad_volumen)) pendingItemValidations.push({ nivel: "ITEM", sec: itemNum, severidad: "ERROR", campo: "unidad_volumen", mensaje: "Falta unidad_volumen (Linea 41)", valorCrudo: it.unidad_volumen ?? null });

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

        const itemId = itIns.insertId;
        if (itemNum) itemIdByNumero.set(itemNum, itemId);

        const esperados = num(it.cantidad); // cantidad declarada en el item
        const enArchivo = itemNum ? (contCountByItemNo.get(itemNum) || 0) : 0;

        if (itemNum && esperados != null && esperados > 0 && enArchivo < esperados) {
          const faltan = esperados - enArchivo;

          const v = {
            nivel: "ITEM",
            sec: itemNum,
            severidad: "ERROR",
            campo: "contenedores",
            mensaje: `Faltan contenedores para el item: se esperaban ${esperados} (cantidad) y el PMS trae ${enArchivo}. Faltan ${faltan}.`,
            valorCrudo: JSON.stringify({ esperados, enArchivo, faltan })
          };

          await addValidacion(conn, { blId, ...v, refId: itemId });
          await addValidacionPMS(conn, { blId, ...v, refId: itemId });
        } else if (itemNum && esperados != null && esperados > 0 && enArchivo > esperados) {
          const sobran = enArchivo - esperados;

          const v = {
            nivel: "ITEM",
            sec: itemNum,
            severidad: "OBS",              // ✅ OBS
            campo: "contenedores",
            mensaje: `Sobran contenedores para el item: se esperaban ${esperados} (cantidad) y el PMS trae ${enArchivo}. Sobran ${sobran}.`,
            valorCrudo: JSON.stringify({ esperados, enArchivo, sobran })
          };

          await addValidacion(conn, { blId, ...v, refId: itemId });
          await addValidacionPMS(conn, { blId, ...v, refId: itemId });
        }

        for (const v of pendingItemValidations) {
          await addValidacion(conn, { blId, ...v, refId: itemId });
          await addValidacionPMS(conn, { blId, ...v, refId: itemId });
        }
      }

      for (const c of conts) {
        const itemId = Number.isFinite(Number(c?.itemNo))
          ? (itemIdByNumero.get(Number(c.itemNo)) || null)
          : null;

        const itemNo = Number(c?.itemNo) || null;
        const pendingContValidations = [];

        if (c.codigo) {
          const iso = splitISO11(c.codigo);
          if (!iso) {
            pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "codigo", mensaje: "Código contenedor inválido (no ISO11: AAAA1234567)", valorCrudo: c.codigo });
          } else {
            if ((c.sigla && c.sigla !== iso.sigla) ||
              (c.numero && c.numero !== iso.numero) ||
              (c.digito && String(c.digito) !== iso.digito)) {
              pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "sigla/numero/digito", mensaje: "codigo no coincide con sigla/numero/digito", valorCrudo: `${c.codigo} vs ${c.sigla || ""}${c.numero || ""}${c.digito || ""}` });
            }
          }
        } else {
          pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "codigo", mensaje: "Contenedor sin código", valorCrudo: c.codigo ?? null });
        }

        if (!itemNo) pendingContValidations.push({ nivel: "CONTENEDOR", sec: null, severidad: "ERROR", campo: "itemNo", mensaje: "Contenedor sin itemNo (no se puede asociar a item)", valorCrudo: c.itemNo ?? null });
        else if (!itemId) pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "item_id", mensaje: "Contenedor no se pudo asociar a item (itemNo no existe en bl_items insertados)", valorCrudo: String(itemNo) });

        if (!c.tipo_cnt) pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "tipo_cnt", mensaje: "Contenedor sin tipo_cnt", valorCrudo: c.tipo_cnt ?? null });

        // 🔥 APLICAR PESO TARA SI ES MM Y PESO = 0
        let pesoContenedor = c.peso ?? null;

        if (esEmpty && (pesoContenedor === null || pesoContenedor === 0) && c.tipo_cnt) {
          const pesoTara = await getPesoTaraByTipoCnt(conn, c.tipo_cnt);
          if (pesoTara) {
            pesoContenedor = pesoTara;
          }
        }

        if (!esEmpty && (num(pesoContenedor) == null || num(pesoContenedor) <= 0)) {
          pendingContValidations.push({
            nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "peso",
            mensaje: "peso debe ser > 0",
            valorCrudo: c.peso
          });
        }

        if (isBlank(c.unidad_peso)) pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "unidad_peso", mensaje: "Falta unidad_peso", valorCrudo: c.unidad_peso ?? null });

        const vol = num(c.volumen);
        if (!esEmpty && (vol == null || vol < 0)) {
          pendingContValidations.push({
            nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "volumen",
            mensaje: "Volumen debe ser >= 0 (puede ser 0)",
            valorCrudo: c.volumen
          });
        }

        // ✅ si es EMPTY y viene null, lo normalizamos para insert
        if (esEmpty && vol == null) c.volumen = 0;

        if (isBlank(c.unidad_volumen)) pendingContValidations.push({ nivel: "CONTENEDOR", sec: itemNo, severidad: "ERROR", campo: "unidad_volumen", mensaje: "Falta unidad_volumen", valorCrudo: c.unidad_volumen ?? null });

        const [cIns] = await conn.query(insertContSql, [
          blId,
          itemId,
          c.codigo,
          c.sigla || null,
          c.numero || null,
          c.digito || null,
          c.tipo_cnt || null,
          c.carga_cnt || null,
          pesoContenedor,  // 🔥 PESO CORREGIDO CON TARA
          c.unidad_peso || null,
          c.volumen ?? null,
          c.unidad_volumen || null,
        ]);

        const contenedorId = cIns.insertId;

        for (const v of pendingContValidations) {
          await addValidacion(conn, { blId, ...v, refId: contenedorId, sec: itemNo });
          await addValidacionPMS(conn, { blId, ...v, refId: contenedorId, sec: itemNo });
        }

        // 🔥 VALIDAR: Si es EMPTY y quedó con peso 0, probablemente falta peso_tara
        if (esEmpty && (pesoContenedor === null || pesoContenedor === 0)) {
          const payload = {
            blId,
            nivel: "CONTENEDOR",
            refId: contenedorId,
            sec: itemNo,
            severidad: "ERROR",
            campo: "peso",
            mensaje: `Contenedor ${c.codigo || '(SIN CODIGO)'} tipo '${c.tipo_cnt || 'NULL'}' quedó con peso 0. Probablemente falta configurar peso_tara_kg para este tipo de contenedor en el mantenedor.`,
            valorCrudo: c.tipo_cnt || null
          };
          await addValidacion(conn, payload);
          await addValidacionPMS(conn, payload);
        }


        const itemObj = itemNo ? itemsArr.find(it => Number(it.numero_item) === itemNo) : null;
        const itemPeligroso = itemObj && String(itemObj.carga_peligrosa || "").toUpperCase() === "S";

        const insertedImo = await insertImo(conn, blId, contenedorId, itemNo, c.imo || [], c.codigo || null);
        if (itemPeligroso && insertedImo < 1) {
          const payload = {
            blId,
            nivel: "CONTENEDOR",
            refId: contenedorId,
            sec: itemNo,
            severidad: "ERROR",
            campo: "imo",
            mensaje: "Item marcado como carga_peligrosa='S' - este contenedor debe tener datos IMO (clase_imo y numero_imo) Linea 56",
            valorCrudo: JSON.stringify({ codigo: c.codigo || null })
          };
          await addValidacion(conn, payload);
          await addValidacionPMS(conn, payload);
        }

        await insertSellos(conn, contenedorId, c.sellos || []);
        if (!Array.isArray(c.sellos) || c.sellos.length === 0) {
          const payload = {
            blId,
            nivel: "CONTENEDOR",
            refId: contenedorId,
            sec: itemNo,
            severidad: "OBS",
            campo: "sellos",
            mensaje: `Contenedor ${c.codigo || '(SIN CODIGO)'} sin sellos en PMS (no siempre aplica)`,
            valorCrudo: c.codigo || null
          };
          await addValidacion(conn, payload);
          await addValidacionPMS(conn, payload);
        }
      }

      await refreshResumenValidacionBL(conn, blId);
    }

    // COMMIT
    await conn.commit();

    // Resumen de errores
    const [blsConErrores] = await conn.query(`
      SELECT
        b.bl_number,
        b.valid_count_error,
        b.valid_count_obs,
        GROUP_CONCAT(
          CONCAT(
            CASE
              WHEN v.nivel = 'BL' THEN '📄 '
              WHEN v.nivel = 'ITEM' THEN '📦 Item '
              WHEN v.nivel = 'CONTENEDOR' THEN '📦 Contenedor '
              WHEN v.nivel = 'TRANSBORDO' THEN '🚢 Transbordo '
              ELSE ''
            END,
            CASE WHEN v.sec IS NOT NULL THEN CONCAT(v.sec, ': ') ELSE '' END,
            v.mensaje
          )
          SEPARATOR '|'
        ) AS errores
      FROM bls b
      LEFT JOIN bl_validaciones v ON v.bl_id = b.id AND v.severidad = 'ERROR'
      WHERE b.manifiesto_id = ? AND b.valid_count_error > 0
      GROUP BY b.id, b.bl_number, b.valid_count_error, b.valid_count_obs
    `, [id]);

    const blsConErroresFormateados = blsConErrores.map(bl => ({
      bl_number: bl.bl_number,
      total_errores: bl.valid_count_error,
      errores: bl.errores ? bl.errores.split("|") : []
    }));

    return res.json({
      ok: true,
      inserted: insertedOk, // ✅ solo NUEVOS
      reemplazados: reemplazadosCount,
      procesados_total: insertedOk + reemplazadosCount, // ✅ opcional
      ignorados_duplicados_archivo: [...new Set(duplicadosEnArchivo)].length,
      blsConErrores: blsConErroresFormateados
    });

  } catch (err) {
    await conn.rollback();

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Si algún UNIQUE explota igual (por seguridad)
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "Duplicado (UNIQUE)", detail: err.sqlMessage });
    }

    console.error("❌ Error procesando PMS:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Error procesando PMS" });
  } finally {
    conn.release();
  }
});


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

// ============================================
// ✅ NUEVA FUNCIÓN: Buscar participante por código PIL
// ============================================
async function getParticipanteIdByCodigoPIL(conn, codigoPil) {
  const codigo = normalizeStr(codigoPil);
  if (!codigo) return null;

  const [rows] = await conn.query(
    `SELECT participante_id 
     FROM traductor_pil_bms 
     WHERE codigo_pil = ? AND activo = TRUE 
     LIMIT 1`,
    [codigo]
  );

  return rows.length ? rows[0].participante_id : null;
}


async function insertTransbordos(conn, blId, transbordos) {
  const arr = Array.isArray(transbordos) ? transbordos : [];
  if (!blId || arr.length === 0) return;

  await conn.query("DELETE FROM bl_transbordos WHERE bl_id = ?", [blId]);

  const sql = `
    INSERT INTO bl_transbordos (bl_id, sec, puerto_cod, puerto_id)
    VALUES (?, ?, ?, ?)
  `;
  let sec = 1;

  for (const cod of arr) {
    const c = String(cod || "").trim().toUpperCase();
    if (!c) continue;

    const puertoId = await getPuertoIdByCodigo(conn, c); // 👈 AQUÍ

    if (!puertoId) {
      const payload = {
        blId,
        nivel: "TRANSBORDO",
        sec,
        severidad: "OBS", // NO ERROR
        campo: "puerto_id",
        mensaje: "Puerto de transbordo no existe en mantenedor (no afecta XML)",
        valorCrudo: c
      };

      await addValidacion(conn, payload);
      await addValidacionPMS(conn, payload); // solo si esto está en carga PMS
    }

    await conn.query(sql, [blId, sec++, c, puertoId]);
  }
}

async function insertImo(conn, blId, contenedorId, itemNo, imoArr, codigoCont = null) {
  const arr = Array.isArray(imoArr) ? imoArr : [];
  if (!contenedorId) return 0;

  let insertedOk = 0;

  for (const x of arr) {
    const clase = String(x?.clase_imo ?? "").trim();
    const numero = String(x?.numero_imo ?? "").trim();

    // Si viene incompleto, NO insert y NO validación (para no duplicar)
    if (!clase || !numero) continue;

    const [r] = await conn.query(
      `INSERT IGNORE INTO bl_contenedor_imo (contenedor_id, clase_imo, numero_imo)
       VALUES (?, ?, ?)`,
      [contenedorId, clase, numero]
    );

    // mysql2: affectedRows = 1 si insertó, 0 si fue IGNORE por duplicado
    if (r?.affectedRows === 1) insertedOk++;
  }

  return insertedOk;
}

const isBlank = (v) => v == null || String(v).trim() === "";
const num = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isSN = (v) => {
  const s = String(v || "").trim().toUpperCase();
  return s === "S" || s === "N";
};

function splitISO11(codigo) {
  const s = String(codigo || "").trim().toUpperCase();
  const m = s.match(/^([A-Z]{4})(\d{6})(\d)$/);
  if (!m) return null;
  return { sigla: m[1], numero: m[2], digito: m[3] };
}

async function addValidacion(conn, {
  blId,
  nivel = "BL",              // BL | ITEM | CONTENEDOR | TRANSBORDO
  refId = null,              // id del item/contenedor/transbordo si aplica
  sec = null,                // opcional: numero_item o sec del transbordo
  severidad = "ERROR",       // ERROR | OBS
  campo,
  mensaje,
  valorCrudo = null
}) {
  await conn.query(`
    INSERT INTO bl_validaciones
      (bl_id, nivel, ref_id, sec, severidad, campo, mensaje, valor_crudo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [blId, nivel, refId, sec, severidad, campo, mensaje, valorCrudo]);
}

async function addValidacionPMS(conn, {
  blId,
  nivel = "BL",               // BL | ITEM | CONTENEDOR | TRANSBORDO
  refId = null,               // id del item/contenedor/transbordo si aplica
  sec = null,                 // numero_item o sec del transbordo
  severidad = "ERROR",        // ERROR | OBS
  campo,
  mensaje,
  valorCrudo = null,

  // extras PMS
  lineaPms = null,            // "41", "44", "47", "51", etc.
  codigoPms = null,           // si existe
  rawLine = null              // línea completa (opcional)
}) {
  await conn.query(`
    INSERT INTO bl_validaciones_pms
      (bl_id, nivel, ref_id, sec, severidad, campo, mensaje, valor_crudo,
       linea_pms, codigo_pms, raw_line)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    blId, nivel, refId, sec, severidad, campo, mensaje, valorCrudo,
    lineaPms, codigoPms, rawLine
  ]);
}


async function refreshResumenValidacionBL(conn, blId) {
  const [[c]] = await conn.query(`
    SELECT
      SUM(severidad='ERROR') AS err,
      SUM(severidad='OBS')   AS obs
    FROM bl_validaciones
    WHERE bl_id = ?
  `, [blId]);

  const err = Number(c?.err || 0);
  const obs = Number(c?.obs || 0);
  const status = err > 0 ? "ERROR" : (obs > 0 ? "OBS" : "OK");

  await conn.query(`
    UPDATE bls
    SET valid_status=?, valid_count_error=?, valid_count_obs=?, valid_last_run=NOW()
    WHERE id=?
  `, [status, err, obs, blId]);
}

// Si tus FK están con ON DELETE CASCADE desde bl_items/bl_contenedores -> bls,
// esto limpia todo automáticamente.

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
  // 🆕 VALIDAR STATUS
  const validStatuses = ["Activo", "Inactivo", "Enviado"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Status inválido. Debe ser: ${validStatuses.join(", ")}`
    });
  }

  // 🆕 VALIDAR TIPO OPERACION (NO PERMITIR EDICIÓN)
  if (req.body.tipoOperacion) {
    return res.status(400).json({
      error: "No se puede modificar el tipo de operación"
    });
  }

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
        status,
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

// DELETE /manifiestos/eliminar-multiples - Eliminar varios manifiestos
app.delete("/manifiestos/eliminar-multiples", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Debe seleccionar al menos un manifiesto" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const resultados = {
      eliminados: [],
      conBLs: [],
      noEncontrados: []
    };

    for (const id of ids) {
      // Verificar existencia
      const [mRows] = await conn.query(
        "SELECT id FROM manifiestos WHERE id = ?",
        [id]
      );

      if (mRows.length === 0) {
        resultados.noEncontrados.push(id);
        continue;
      }

      // Verificar BLs
      const [blRows] = await conn.query(
        "SELECT COUNT(*) as total FROM bls WHERE manifiesto_id = ?",
        [id]
      );

      if (blRows[0].total > 0) {
        resultados.conBLs.push({ id, totalBLs: blRows[0].total });
        continue;
      }

      // Eliminar itinerario y manifiesto
      await conn.query("DELETE FROM itinerarios WHERE manifiesto_id = ?", [id]);
      await conn.query("DELETE FROM manifiestos WHERE id = ?", [id]);
      resultados.eliminados.push(id);
    }

    await conn.commit();

    res.json({
      success: true,
      resultados,
      mensaje: `${resultados.eliminados.length} manifiesto(s) eliminado(s)`
    });

  } catch (err) {
    await conn.rollback();
    console.error("Error al eliminar manifiestos:", err);
    res.status(500).json({
      error: "Error al eliminar manifiestos",
      details: err?.message
    });
  } finally {
    conn.release();
  }
});

// DELETE /manifiestos/:id - Eliminar manifiesto (solo si no tiene BLs)
app.delete("/manifiestos/:id", async (req, res) => {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ Verificar que el manifiesto existe
    const [mRows] = await conn.query(
      "SELECT id FROM manifiestos WHERE id = ?",
      [id]
    );

    if (mRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Manifiesto no encontrado" });
    }

    // 2️⃣ Verificar que NO tenga BLs asociados
    const [blRows] = await conn.query(
      "SELECT COUNT(*) as total FROM bls WHERE manifiesto_id = ?",
      [id]
    );

    if (blRows[0].total > 0) {
      await conn.rollback();
      return res.status(400).json({
        error: "No se puede eliminar",
        message: `Este manifiesto tiene ${blRows[0].total} BL(s) asociado(s). Elimina primero los BLs.`
      });
    }

    // 3️⃣ Eliminar itinerario (FK constraint)
    await conn.query("DELETE FROM itinerarios WHERE manifiesto_id = ?", [id]);

    // 4️⃣ Eliminar manifiesto
    await conn.query("DELETE FROM manifiestos WHERE id = ?", [id]);

    await conn.commit();
    res.json({ success: true, message: "Manifiesto eliminado correctamente" });

  } catch (err) {
    await conn.rollback();
    console.error("Error al eliminar manifiesto:", err);
    res.status(500).json({
      error: "Error al eliminar manifiesto",
      details: err?.message
    });
  } finally {
    conn.release();
  }
});


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

        b.lugar_emision_cod,
        b.puerto_embarque_cod,
        b.puerto_descarga_cod,
        b.lugar_recepcion_cod,
        b.lugar_entrega_cod,
        b.lugar_destino_cod,


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
      LEFT JOIN puertos le ON b.lugar_emision_id = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      LEFT JOIN puertos lr ON b.lugar_recepcion_id = lr.id
      LEFT JOIN puertos lem ON b.lugar_entrega_id = lem.id
      LEFT JOIN puertos ld ON b.lugar_destino_id = ld.id
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
// REEMPLAZA tu GET /bls/:blNumber actual por este:
// REEMPLAZA tu GET /bls/:blNumber (línea ~2570) por este:
app.get("/bls/:blNumber", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { blNumber } = req.params;

    const query = `
      SELECT
        b.*,
        m.viaje,
        m.tipo_operacion,
        ts.codigo AS tipo_servicio_codigo,
        ts.nombre AS tipo_servicio,
        le.codigo AS lugar_emision_cod,
        le.nombre AS lugar_emision,
        pe.codigo AS puerto_embarque_cod,
        pe.nombre AS puerto_embarque,
        pd.codigo AS puerto_descarga_cod,
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

    const [rows] = await conn.query(query, [blNumber]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = rows[0].id;



    // Recargar datos actualizados
    const [updatedRows] = await conn.query(query, [blNumber]);

    res.json(updatedRows[0]);
  } catch (error) {
    console.error("Error al obtener BL:", error);
    res.status(500).json({ error: "Error al obtener BL", details: error.message });
  } finally {
    conn.release();
  }
});

// PUT - Actualizar items de un BL
app.put("/bls/:blNumber/items", async (req, res) => {
  const { blNumber } = req.params;
  const { items } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener bl_id y tipo_servicio del BL
    const [blRows] = await conn.query(
      `SELECT b.id, ts.codigo AS tipo_servicio_codigo
       FROM bls b
       LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
       WHERE b.bl_number = ? LIMIT 1`,
      [blNumber]
    );

    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;
    const esEmpty = String(blRows[0].tipo_servicio_codigo || "").trim().toUpperCase() === "MM";

    // 2) Actualizar cada item
    for (const item of items) {
      if (!item.id) continue;

      const cantidad = parseInt(item.cantidad);
      if (isNaN(cantidad) || cantidad < 1) {
        await conn.rollback();
        return res.status(400).json({
          error: `Item ${item.numero_item}: Cantidad debe ser al menos 1`
        });
      }

      const peso = parseFloat(item.peso_bruto);
      // Si es EMPTY (MM): peso >= 0 | Si no es EMPTY: peso > 0
      if (esEmpty) {
        if (isNaN(peso) || peso < 0) {
          await conn.rollback();
          return res.status(400).json({
            error: `Item ${item.numero_item}: Peso no puede ser negativo`
          });
        }
      } else {
        if (isNaN(peso) || peso <= 0) {
          await conn.rollback();
          return res.status(400).json({
            error: `Item ${item.numero_item}: Peso debe ser mayor a 0`
          });
        }
      }

      const volumen = parseFloat(item.volumen);
      if (isNaN(volumen) || volumen < 0) {
        await conn.rollback();
        return res.status(400).json({
          error: `Item ${item.numero_item}: Volumen no puede ser negativo`
        });
      }

      await conn.query(
        `UPDATE bl_items 
         SET descripcion = ?,
             marcas = ?,
             tipo_bulto = ?,
             cantidad = ?,
             peso_bruto = ?,
             unidad_peso = ?,        
             volumen = ?,
             unidad_volumen = ?
         WHERE id = ? AND bl_id = ?`,
        [
          item.descripcion || null,
          item.marcas || null,
          item.tipo_bulto || null,
          item.cantidad || null,
          item.peso_bruto,          // ← no usar || null, porque 0 es válido
          item.unidad_peso || null,
          item.volumen,             // ← mismo aquí, 0 es válido
          item.unidad_volumen || null,
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

// PUT - Actualizar contenedores de un BL
app.put("/bls/:blNumber/contenedores", async (req, res) => {
  const { blNumber } = req.params;
  const { contenedores } = req.body;

  console.log('🚀 RECIBIENDO contenedores para BL:', blNumber);
  console.log('📦 Total contenedores:', contenedores?.length);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ Obtener bl_id
    const [blRows] = await conn.query(
      "SELECT id FROM bls WHERE bl_number = ?",
      [blNumber]
    );

    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    // 2️⃣ Función auxiliar para parsear código de contenedor
    function parseCodigoContenedor(codigo) {
      if (!codigo || codigo.length !== 11) {
        return { sigla: null, numero: null, digito: null };
      }

      return {
        sigla: codigo.substring(0, 4).toUpperCase(),
        numero: parseInt(codigo.substring(4, 10)),
        digito: parseInt(codigo.substring(10, 11))
      };
    }

    // 3️⃣ Procesar cada contenedor
    for (const cont of contenedores) {
      // 🔥 PARSEAR CÓDIGO
      const { sigla, numero, digito } = parseCodigoContenedor(cont.codigo);

      console.log(`📦 Procesando contenedor ${cont.codigo}:`, {
        sigla, numero, digito,
        peso: cont.peso,
        volumen: cont.volumen
      });

      if (cont._isNew) {
        // ✅ INSERTAR NUEVO CONTENEDOR (CON PESO Y VOLUMEN)
        const [insertResult] = await conn.query(
          `INSERT INTO bl_contenedores 
          (bl_id, item_id, codigo, sigla, numero, digito, tipo_cnt, carga_cnt,
           peso, unidad_peso, volumen, unidad_volumen) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            blId,
            cont.item_id,
            cont.codigo,
            sigla,
            numero,
            digito,
            cont.tipo_cnt,
            cont.carga_cnt || 'S',
            cont.peso || null,              // 🆕
            cont.unidad_peso || 'KGM',      // 🆕
            cont.volumen ?? null,
            cont.unidad_volumen || 'MTQ'    // 🆕
          ]
        );

        const newContId = insertResult.insertId;
        console.log(`✅ Contenedor insertado con ID: ${newContId}`);

        // Insertar sellos
        if (cont.sellos && cont.sellos.length > 0) {
          for (const sello of cont.sellos) {
            await conn.query(
              "INSERT INTO bl_contenedor_sellos (contenedor_id, sello) VALUES (?, ?)",
              [newContId, sello]
            );
          }
        }

        // Insertar IMOs
        if (cont.imos && cont.imos.length > 0) {
          for (const imo of cont.imos) {
            await conn.query(
              "INSERT INTO bl_contenedor_imo (contenedor_id, clase_imo, numero_imo) VALUES (?, ?, ?)",
              [newContId, imo.clase, imo.numero]
            );
          }
        }

      } else {
        // ✅ ACTUALIZAR CONTENEDOR EXISTENTE (CON PESO Y VOLUMEN)
        await conn.query(
          `UPDATE bl_contenedores 
          SET codigo = ?, sigla = ?, numero = ?, digito = ?, tipo_cnt = ?,
              peso = ?, unidad_peso = ?, volumen = ?, unidad_volumen = ?
          WHERE id = ?`,
          [
            cont.codigo,
            sigla,
            numero,
            digito,
            cont.tipo_cnt,
            cont.peso || null,              // 🆕
            cont.unidad_peso || 'KGM',      // 🆕
            cont.volumen || null,           // 🆕
            cont.unidad_volumen || 'MTQ',   // 🆕
            cont.id
          ]
        );

        console.log(`✅ Contenedor ${cont.id} actualizado`);

        // Actualizar sellos
        await conn.query("DELETE FROM bl_contenedor_sellos WHERE contenedor_id = ?", [cont.id]);
        if (cont.sellos && cont.sellos.length > 0) {
          for (const sello of cont.sellos) {
            await conn.query(
              "INSERT INTO bl_contenedor_sellos (contenedor_id, sello) VALUES (?, ?)",
              [cont.id, sello]
            );
          }
        }

        // Actualizar IMOs
        await conn.query("DELETE FROM bl_contenedor_imo WHERE contenedor_id = ?", [cont.id]);
        if (cont.imos && cont.imos.length > 0) {
          for (const imo of cont.imos) {
            await conn.query(
              "INSERT INTO bl_contenedor_imo (contenedor_id, clase_imo, numero_imo) VALUES (?, ?, ?)",
              [cont.id, imo.clase, imo.numero]
            );
          }
        }
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Contenedores actualizados correctamente" });

  } catch (error) {
    await conn.rollback();
    console.error("❌ Error al actualizar contenedores:", error);
    res.status(500).json({ error: "Error al actualizar contenedores", details: error.message });
  } finally {
    conn.release();
  }
});

// GET items y contenedores de un BL específico
app.get('/bls/:blNumber/items-contenedores', async (req, res) => {
  const { blNumber } = req.params;

  try {
    // 1. Obtener bl_id
    const [blRows] = await pool.query('SELECT id FROM bls WHERE bl_number = ?', [blNumber]);
    if (blRows.length === 0) {
      return res.status(404).json({ error: 'BL no encontrado' });
    }
    const bl_id = blRows[0].id;

    // 2. Obtener items
    const [items] = await pool.query(
      'SELECT * FROM bl_items WHERE bl_id = ? ORDER BY numero_item',
      [bl_id]
    );

    // 3. Obtener contenedores
    const [contenedores] = await pool.query(
      'SELECT * FROM bl_contenedores WHERE bl_id = ? ORDER BY id',
      [bl_id]
    );

    // 4. Para cada contenedor, obtener sus sellos e IMOs
    for (const cont of contenedores) {
      // Obtener sellos
      const [sellos] = await pool.query(
        'SELECT sello FROM bl_contenedor_sellos WHERE contenedor_id = ?',
        [cont.id]
      );
      // ✅ ASEGURARSE DE QUE SIEMPRE SEA UN ARRAY
      cont.sellos = sellos.map(s => s.sello) || [];

      // Obtener IMOs
      const [imos] = await pool.query(
        'SELECT clase_imo as clase, numero_imo as numero FROM bl_contenedor_imo WHERE contenedor_id = ?',
        [cont.id]
      );
      // ✅ ASEGURARSE DE QUE SIEMPRE SEA UN ARRAY
      cont.imos = imos || [];
    }

    // 5. Asociar contenedores a items
    for (const item of items) {
      const itemContenedores = contenedores.filter(c => c.item_id === item.id);
      item.contenedores = itemContenedores.map(c => ({ codigo: c.codigo }));
    }

    res.json({ items, contenedores });
  } catch (error) {
    console.error('❌ Error al obtener items y contenedores:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// ============================================
// ACTUALIZACIÓN MASIVA DE BLs
// ============================================
app.patch('/bls/bulk-update', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { blNumbers, updates } = req.body;

    // Validaciones
    if (!blNumbers || !Array.isArray(blNumbers) || blNumbers.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar una lista de BL numbers' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar campos a actualizar' });
    }

    await connection.beginTransaction();

    // Campos permitidos según tu esquema de base de datos
    // Campos permitidos según tu esquema de base de datos
    const validFields = [
      // ❌ ELIMINADOS: 'shipper', 'consignee', 'notify_party'
      'shipper_id',
      'consignee_id',
      'notify_id',
      'descripcion_carga',
      'bultos',
      'peso_bruto',
      'volumen',
      'status',
      // 🆕 NUEVOS CAMPOS GENERALES
      'fecha_embarque',
      'fecha_zarpe',
      'fecha_emision',
      'observaciones',
      // Campos de puerto (ya los tienes)
      'lugar_recepcion_cod',
      'puerto_embarque_cod',
      'puerto_descarga_cod',
      'lugar_entrega_cod',
      'lugar_destino_cod',
      'lugar_emision_cod',
      // 🆕 CAMPOS ESPECÍFICOS BB (Carga Suelta)
      'forma_pago_flete',
      'cond_transporte',
      'almacenador'
    ];


    // Construir SET clauses
    const setClauses = [];
    const values = [];

    Object.keys(updates).forEach(field => {
      if (validFields.includes(field)) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    });

    if (setClauses.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // Agregar updated_at
    setClauses.push('updated_at = NOW()');

    // Agregar BL numbers
    values.push(...blNumbers);

    // Placeholders para IN clause
    const placeholders = blNumbers.map(() => '?').join(',');

    // Query final
    const query = `
      UPDATE bls 
      SET ${setClauses.join(', ')}
      WHERE bl_number IN (${placeholders})
    `;

    console.log('Query:', query);
    console.log('Values:', values);

    const [result] = await connection.query(query, values);

    await connection.commit();

    res.json({
      success: true,
      message: `${result.affectedRows} BL(s) actualizados correctamente`,
      affectedRows: result.affectedRows,
      blNumbers: blNumbers
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error en actualización masiva:', error);
    res.status(500).json({
      error: 'Error al actualizar BLs',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ACTUALIZAR UN BL INDIVIDUAL (para puertos)
// ============================================
app.patch('/bls/:blNumber', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { blNumber } = req.params;
    const updates = req.body;

    console.log('═══════════════════════════════════');
    console.log('📥 PATCH recibido para BL:', blNumber);
    console.log('📦 Body completo:', JSON.stringify(updates, null, 2));
    console.log('═══════════════════════════════════');

    await connection.beginTransaction();

    // 1️⃣ Obtener BL ID
    const [blRows] = await connection.query(
      'SELECT id FROM bls WHERE bl_number = ?',
      [blNumber]
    );

    if (blRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'BL no encontrado' });
    }

    const blId = blRows[0].id;

    // 2️⃣ Preparar campos para UPDATE
    const setClauses = [];
    const values = [];

    // 🔥 CAMPOS PERMITIDOS (ACTUALIZADO)
    const validFields = [
      // ❌ ELIMINADOS: 'shipper', 'consignee', 'notify_party'
      'shipper_id',
      'consignee_id',
      'notify_id',
      'descripcion_carga',
      'bultos',
      'peso_bruto',
      'volumen',
      'status',
      // 🆕 NUEVOS CAMPOS GENERALES
      'fecha_embarque',
      'fecha_zarpe',
      'fecha_emision',
      'observaciones',
      // Campos de puerto (ya los tienes)
      'lugar_recepcion_cod',
      'puerto_embarque_cod',
      'puerto_descarga_cod',
      'lugar_entrega_cod',
      'lugar_destino_cod',
      'lugar_emision_cod',
      // 🆕 CAMPOS ESPECÍFICOS BB (Carga Suelta)
      'forma_pago_flete',
      'cond_transporte',
      'almacenador'
    ];

    // 🔥 MAPEO DE CÓDIGOS → IDs
    const puertoFields = [
      'lugar_recepcion_cod',
      'puerto_embarque_cod',
      'puerto_descarga_cod',
      'lugar_entrega_cod',
      'lugar_destino_cod',
      'lugar_emision_cod'
    ];

    for (const field of Object.keys(updates)) {
      const value = updates[field];

      // 🔥 Si es un campo de puerto, resolver ID
      if (puertoFields.includes(field)) {
        const codigo = value;

        if (!codigo) {
          // Si viene vacío, NULL en ambos
          const idField = field.replace('_cod', '_id');
          setClauses.push(`${field} = NULL`, `${idField} = NULL`);
          continue;
        }

        // Buscar puerto en BD
        const [puertoRows] = await connection.query(
          'SELECT id FROM puertos WHERE codigo = ?',
          [codigo]
        );

        const puertoId = puertoRows.length > 0 ? puertoRows[0].id : null;

        // Actualizar AMBOS: código + ID
        const idField = field.replace('_cod', '_id');
        setClauses.push(`${field} = ?`, `${idField} = ?`);
        values.push(codigo, puertoId);

        console.log(`🔄 Puerto ${field}: ${codigo} → ID: ${puertoId}`);
      }
      // 🔥 PROCESAMIENTO ESPECIAL PARA OBSERVACIONES
      else if (field === 'observaciones') {
        if (Array.isArray(value)) {
          setClauses.push(`${field} = ?`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${field} = ?`);
          values.push(value);
        }
      }
      // 🔥 Otros campos permitidos
      else if (validFields.includes(field)) {
        setClauses.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // 3️⃣ Agregar updated_at
    setClauses.push('updated_at = NOW()');
    values.push(blNumber);

    // 4️⃣ Ejecutar UPDATE
    const query = `
      UPDATE bls 
      SET ${setClauses.join(', ')}
      WHERE bl_number = ?
    `;

    console.log('📝 Query:', query);
    console.log('📝 Values:', values);

    const [result] = await connection.query(query, values);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'BL no encontrado' });
    }

    await connection.commit();

    console.log(`✅ BL ${blNumber} actualizado - ${result.affectedRows} fila(s)`);

    res.json({
      success: true,
      message: 'BL actualizado exitosamente',
      bl_number: blNumber
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar BL:', error);
    res.status(500).json({
      error: 'Error al actualizar BL',
      details: error.message
    });
  } finally {
    connection.release();
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
        pd.nombre AS puerto_descarga,
        ld.nombre AS lugar_destino,
        len.nombre AS lugar_entrega,
        lr.nombre AS lugar_recepcion

      FROM bls b
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id

      LEFT JOIN puertos le  ON b.lugar_emision_id    = le.id
      LEFT JOIN puertos pe  ON b.puerto_embarque_id  = pe.id
      LEFT JOIN puertos pd  ON b.puerto_descarga_id  = pd.id
      LEFT JOIN puertos ld  ON b.lugar_destino_id    = ld.id
      LEFT JOIN puertos len ON b.lugar_entrega_id    = len.id
      LEFT JOIN puertos lr  ON b.lugar_recepcion_id  = lr.id

      WHERE b.manifiesto_id = ?
      ORDER BY b.bl_number
    `;

    const [rows] = await pool.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener BLs del manifiesto:", error);
    res.status(500).json({ error: "Error al obtener BLs del manifiesto" });
  }
});


// 🔥 AGREGAR/ACTUALIZAR ENDPOINT EN EL BACKEND
// PUT /bls/:blNumber/carga-suelta - Actualizar carga suelta
app.put("/bls/:blNumber/carga-suelta", async (req, res) => {
  const { blNumber } = req.params;
  const {
    forma_pago_flete,
    cond_transporte,
    fecha_emision,
    fecha_presentacion,
    fecha_embarque,
    fecha_zarpe,
    lugar_emision,
    lugar_recepcion,
    puerto_embarque,
    puerto_descarga,
    lugar_destino,
    lugar_entrega,
    shipper_id,
    consignee_id,
    notify_id,
    almacenador_id,

    shipper,
    consignee,
    notify_party,
    almacenador,
    items,
    observaciones
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Obtener bl_id y buscar locaciones
    const [blRows] = await conn.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    // 2) Resolver IDs de puertos
    const resolvePortId = async (codigo) => {
      if (!codigo) return null;
      const [rows] = await conn.query(
        "SELECT id FROM puertos WHERE codigo = ? LIMIT 1",
        [codigo]
      );
      return rows.length > 0 ? rows[0].id : null;
    };

    const lugar_emision_id = await resolvePortId(lugar_emision);
    const lugar_recepcion_id = await resolvePortId(lugar_recepcion);
    const puerto_embarque_id = await resolvePortId(puerto_embarque);
    const puerto_descarga_id = await resolvePortId(puerto_descarga);
    const lugar_destino_id = await resolvePortId(lugar_destino);
    const lugar_entrega_id = await resolvePortId(lugar_entrega);

    // 3) Actualizar BL con IDs de participantes
    await conn.query(`
      UPDATE bls SET
        forma_pago_flete = ?,
        cond_transporte = ?,
        fecha_emision = ?,
        fecha_presentacion = ?,
        fecha_embarque = ?,
        fecha_zarpe = ?,
        lugar_emision_id = ?,
        lugar_recepcion_id = ?,
        puerto_embarque_id = ?,
        puerto_descarga_id = ?,
        lugar_destino_id = ?,
        lugar_entrega_id = ?,
        shipper_id = ?,
        consignee_id = ?,
        notify_id = ?,
        almacenador_id = ?,
        shipper = ?,
        consignee = ?,
        notify_party = ?,
        almacenador = ?,
        observaciones = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      forma_pago_flete,
      cond_transporte,
      fecha_emision,
      fecha_presentacion,
      fecha_embarque,
      fecha_zarpe,
      lugar_emision_id,
      lugar_recepcion_id,
      puerto_embarque_id,
      puerto_descarga_id,
      lugar_destino_id,
      lugar_entrega_id,
      shipper_id,
      consignee_id,
      notify_id,
      almacenador_id,
      shipper,
      consignee,
      notify_party,
      almacenador,
      observaciones ? JSON.stringify(observaciones) : null,
      blId
    ]);

    // 4) Eliminar items anteriores
    await conn.query("DELETE FROM bl_items WHERE bl_id = ?", [blId]);

    // 5) Insertar nuevos items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO bl_items (
            bl_id, numero_item, marcas, tipo_bulto, descripcion,
            cantidad, peso_bruto, unidad_peso, volumen, unidad_volumen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          blId,
          item.numero_item,
          item.marcas || 'N/M',
          item.tipo_bulto,
          item.descripcion,
          item.cantidad,
          item.peso_bruto,
          item.unidad_peso,
          item.volumen || 0,
          item.unidad_volumen,
          'N' // SIEMPRE 'N' para carga suelta
        ]);
      }
    }

    // 6) Calcular totales
    const totalPeso = items.reduce((sum, i) => sum + parseFloat(i.peso_bruto || 0), 0);
    const totalVolumen = items.reduce((sum, i) => sum + parseFloat(i.volumen || 0), 0);
    const totalBultos = items.reduce((sum, i) => sum + parseInt(i.cantidad || 0), 0);

    await conn.query(`
      UPDATE bls SET
        bultos = ?,
        peso_bruto = ?,
        volumen = ?
      WHERE id = ?
    `, [totalBultos, totalPeso, totalVolumen, blId]);

    await conn.commit();

    res.json({
      success: true,
      bl_number: blNumber,
      total_items: items.length,
      bultos: totalBultos,
      peso_bruto: totalPeso,
      volumen: totalVolumen
    });

  } catch (error) {
    await conn.rollback();
    console.error("Error actualizando carga suelta:", error);
    res.status(500).json({
      error: "Error al actualizar carga suelta",
      details: error.message
    });
  } finally {
    conn.release();
  }
});

// ============================================
// ENDPOINTS PARA EDICIÓN DE BLs
// ============================================

// PUT - Actualizar un BL completo
app.put("/bls/:blNumber", async (req, res) => {
  const { blNumber } = req.params;
  const {
    tipo_servicio,
    fecha_emision,
    fecha_presentacion,  // ← DEBE ESTAR AQUÍ
    fecha_zarpe,
    fecha_embarque,
    // 🆕 AGREGAR ESTOS 6 CAMPOS
    lugar_emision,
    puerto_embarque,
    puerto_descarga,
    lugar_destino,
    lugar_entrega,
    lugar_recepcion,
    unidad_peso,      // ← AGREGAR
    unidad_volumen,   // ← AGREGAR
    // FIN NUEVOS CAMPOS
    shipper,
    consignee,
    notify_party,
    descripcion_carga,
    peso_bruto,
    volumen,
    bultos
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Obtener tipo_servicio_id
    let tipo_servicio_id = null;
    if (tipo_servicio) {
      const [tsRows] = await conn.query(
        "SELECT id FROM tipos_servicio WHERE codigo = ?",
        [tipo_servicio]
      );
      if (tsRows.length > 0) {
        tipo_servicio_id = tsRows[0].id;
      }
    }

    // 🆕 Resolver IDs de los 6 lugares
    const lugarEmisionId = lugar_emision ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [lugar_emision]))[0]?.[0]?.id : null;
    const puertoEmbarqueId = puerto_embarque ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [puerto_embarque]))[0]?.[0]?.id : null;
    const puertoDescargaId = puerto_descarga ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [puerto_descarga]))[0]?.[0]?.id : null;
    const lugarDestinoId = lugar_destino ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [lugar_destino]))[0]?.[0]?.id : null;
    const lugarEntregaId = lugar_entrega ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [lugar_entrega]))[0]?.[0]?.id : null;
    const lugarRecepcionId = lugar_recepcion ?
      (await conn.query("SELECT id FROM puertos WHERE codigo = ?", [lugar_recepcion]))[0]?.[0]?.id : null;

    // 🆕 UPDATE con los 6 campos
    await conn.query(`
      UPDATE bls SET
        tipo_servicio_id = COALESCE(?, tipo_servicio_id),
        fecha_emision = COALESCE(?, fecha_emision),
        fecha_presentacion = COALESCE(?, fecha_presentacion),  
        fecha_zarpe = COALESCE(?, fecha_zarpe),
        fecha_embarque = COALESCE(?, fecha_embarque),
        lugar_emision_id = COALESCE(?, lugar_emision_id),
        lugar_emision_cod = COALESCE(?, lugar_emision_cod),
        puerto_embarque_id = COALESCE(?, puerto_embarque_id),
        puerto_embarque_cod = COALESCE(?, puerto_embarque_cod),
        puerto_descarga_id = COALESCE(?, puerto_descarga_id),
        puerto_descarga_cod = COALESCE(?, puerto_descarga_cod),
        lugar_destino_id = COALESCE(?, lugar_destino_id),
        lugar_destino_cod = COALESCE(?, lugar_destino_cod),
        lugar_entrega_id = COALESCE(?, lugar_entrega_id),
        lugar_entrega_cod = COALESCE(?, lugar_entrega_cod),
        lugar_recepcion_id = COALESCE(?, lugar_recepcion_id),
        lugar_recepcion_cod = COALESCE(?, lugar_recepcion_cod),
        shipper = COALESCE(?, shipper),
        consignee = COALESCE(?, consignee),
        notify_party = COALESCE(?, notify_party),
        descripcion_carga = ?,
        peso_bruto = COALESCE(?, peso_bruto),
        unidad_volumen = ?,    
        unidad_peso = ?,    
        volumen = COALESCE(?, volumen),
        bultos = COALESCE(?, bultos),
        updated_at = NOW()
      WHERE bl_number = ?
    `, [
      tipo_servicio_id,
      fecha_emision,
      fecha_presentacion,
      fecha_zarpe,
      fecha_embarque,
      lugarEmisionId,
      lugar_emision,
      puertoEmbarqueId,
      puerto_embarque,
      puertoDescargaId,
      puerto_descarga,
      lugarDestinoId,
      lugar_destino,
      lugarEntregaId,
      lugar_entrega,
      lugarRecepcionId,
      lugar_recepcion,
      shipper,
      consignee,
      notify_party,
      descripcion_carga,
      peso_bruto,
      unidad_volumen,     // ← AGREGAR
      unidad_peso,        // ← AGREGAR
      volumen,
      bultos,
      blNumber
    ]);

    await conn.commit();
    res.json({ message: "BL actualizado correctamente" });
  } catch (error) {
    await conn.rollback();
    console.error("Error al actualizar BL:", error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
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

//Recargar tokens
app.post("/admin/pms51/tokens/reload", async (req, res) => {
  await loadPms51Tokens();
  res.json({ ok: true, tokens: PMS51_TOKENS });
});

// ============================================
// 🛡️ FUNCIÓN DE VALIDACIÓN DE BL PARA XML
// ============================================

function validateBLForXML(bl) {
  const errors = [];

  // Campos obligatorios
  if (!bl.bl_number || bl.bl_number.trim() === '') {
    errors.push("Falta número de BL");
  }

  if (!bl.shipper || bl.shipper.trim() === '') {
    errors.push("Falta Shipper");
  }

  // Lugar Destino (LD)
  if (!bl.lugar_destino_codigo && !bl.lugar_destino_id) {
    errors.push("Falta Lugar de Destino (LD)");
  }

  // Lugar Entrega (LEM)
  if (!bl.lugar_entrega_codigo && !bl.lugar_entrega_id) {
    errors.push("Falta Lugar de Entrega (LEM)");
  }

  // Lugar Recepción (LRM)
  if (!bl.lugar_recepcion_codigo && !bl.lugar_recepcion_id) {
    errors.push("Falta Lugar de Recepción (LRM)");
  }
  if (!bl.consignee || bl.consignee.trim() === '') {
    errors.push("Falta Consignee");
  }

  if (!bl.puerto_embarque_codigo && !bl.puerto_embarque_id) {
    errors.push("Falta Puerto de Embarque (POL)");
  }

  if (!bl.puerto_descarga_codigo && !bl.puerto_descarga_id) {
    errors.push("Falta Puerto de Descarga (POD)");
  }

  if (!bl.lugar_emision_codigo && !bl.lugar_emision_id) {
    errors.push("Falta Lugar de Emisión (LE)");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ... resto del código existente
// Función helper para formatear fechas DD-MM-YYYY HH:MM
function formatDateTimeCL(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

// Función helper para formatear solo fecha DD-MM-YYYY
function formatDateCL(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
// Función para formatear fecha en formato DD-MM-YYYY
function formatDateDDMMYYYY(fecha) {
  if (!fecha) return '';
  const date = new Date(fecha);
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}-${mes}-${anio}`;
}

// Función para generar la sección Referencias
function generarReferencias(bl) {
  if (!bl.numero_referencia || !bl.fecha_referencia) {
    return undefined;
  }

  return {
    referencia: {
      'tipo-referencia': 'REF',
      'tipo-documento': 'MFTO',
      'numero': String(bl.numero_referencia),
      'fecha': formatDateDDMMYYYY(bl.fecha_manifiesto_aduana),
      'tipo-id-emisor': bl.ref_doc_tipo_id || 'RUT',
      'nac-id-emisor': bl.ref_doc_nacion_id || 'CL',
      'valor-id-emisor': bl.ref_doc_rut ? bl.ref_doc_rut.replace(/\./g, '') : '',
      'emisor': bl.ref_doc_nombre || ''
    }
  };
}
// 🔥 REEMPLAZA ESTE ENDPOINT COMPLETO
app.get("/api/manifiestos/:id/bls-para-xml", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;

    // 1️⃣ Obtener todos los BLs del manifiesto
    const [bls] = await conn.query(
      'SELECT id FROM bls WHERE manifiesto_id = ?',
      [id]
    );


    // 2️⃣ RE-VALIDAR CADA BL (esto resuelve los puertos que se agregaron)
    for (const bl of bls) {
      await revalidarBLCompleto(conn, bl.id);
    }

    // 3️⃣ Ahora sí, obtener los datos actualizados con las validaciones frescas
    const query = `
      SELECT
        b.id,
        b.bl_number,
        b.shipper,
        b.lugar_destino_cod,
        b.lugar_entrega_cod,
        b.lugar_recepcion_cod,
        b.lugar_emision_cod,
        b.valid_status,           -- 🆕 Ya actualizado
        b.valid_count_error,      -- 🆕 Ya actualizado
        b.valid_count_obs,        -- 🆕 Ya actualizado
        b.consignee,
        b.notify_party,
        b.descripcion_carga,
        b.bultos,
        b.peso_bruto,
        b.volumen,
        b.unidad_peso,
        b.unidad_volumen,
        b.status,
        b.fecha_emision,
        b.fecha_zarpe,
        b.fecha_embarque,
        b.fecha_presentacion,
        b.created_at,
        pe.codigo AS puerto_embarque_cod,
        pe.nombre AS puerto_embarque,
        pd.codigo AS puerto_descarga_cod,
        pd.nombre AS puerto_descarga,
        le.codigo AS lugar_emision_cod,
        le.nombre AS lugar_emision,
        ts.codigo AS tipo_servicio_cod,
        ts.nombre AS tipo_servicio
      FROM bls b
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      LEFT JOIN puertos le ON b.lugar_emision_id = le.id
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      WHERE b.manifiesto_id = ?
      ORDER BY b.bl_number
    `;

    const [rows] = await conn.query(query, [id]);

    res.json(rows);
  } catch (error) {
    console.error("❌ Error al obtener BLs para XML:", error);
    res.status(500).json({ error: "Error al obtener BLs" });
  } finally {
    conn.release();
  }
});
// 🔥 REEMPLAZA el endpoint POST /api/bls/:blNumber/generar-xml
app.post("/api/bls/:blNumber/generar-xml", async (req, res) => {
  try {
    const { blNumber } = req.params;

    const [blRows] = await pool.query(`
    SELECT
      b.*,
      m.viaje,
      m.tipo_operacion,
      m.numero_referencia,      
      m.fecha_referencia,  
      m.fecha_manifiesto_aduana,  
      m.fecha_zarpe AS manifiesto_fecha_zarpe,
      m.representante AS representante_codigo,
      n.nombre AS nave_nombre,
      ts.codigo AS tipo_servicio_codigo,
      le.codigo AS lugar_emision_codigo,
      le.nombre AS lugar_emision_nombre,
      pe.codigo AS puerto_embarque_codigo,
      pe.nombre AS puerto_embarque_nombre,
      pd.codigo AS puerto_descarga_codigo,
      pd.nombre AS puerto_descarga_nombre,
      ld.codigo AS lugar_destino_codigo,
      ld.nombre AS lugar_destino_nombre,
      lem.codigo AS lugar_entrega_codigo,
      lem.nombre AS lugar_entrega_nombre,
      lrm.codigo AS lugar_recepcion_codigo,
      lrm.nombre AS lugar_recepcion_nombre,
      
      -- 🔥 REPRESENTANTE desde REFERENCIAS (para EMI, EMIDO, REP)
      -- EMI
      ref_emi.id          AS emi_id,
      ref_emi.rut         AS emi_rut,
      ref_emi.nombre_emisor AS emi_nombre,
      ref_emi.pais        AS emi_pais,
      ref_emi.tipo_id_emisor AS emi_tipo_id,
      ref_emi.nacion_id   AS emi_nacion_id,

      -- EMIDO
      ref_emido.id          AS emido_id,
      ref_emido.rut         AS emido_rut,
      ref_emido.nombre_emisor AS emido_nombre,
      ref_emido.pais        AS emido_pais,
      ref_emido.tipo_id_emisor AS emido_tipo_id,
      ref_emido.nacion_id   AS emido_nacion_id,

      -- REP
      ref_rep.id          AS rep_id,
      ref_rep.rut         AS rep_rut,
      ref_rep.nombre_emisor AS rep_nombre,
      ref_rep.pais        AS rep_pais,
      ref_rep.tipo_id_emisor AS rep_tipo_id,
      ref_rep.nacion_id   AS rep_nacion_id,

      -- REF (para sección Referencias del XML)
      ref_doc.id            AS ref_doc_id,
      ref_doc.rut           AS ref_doc_rut,
      ref_doc.nombre_emisor AS ref_doc_nombre,
      ref_doc.match_code    AS ref_doc_codigo,
      ref_doc.pais          AS ref_doc_pais,
      ref_doc.tipo_id_emisor AS ref_doc_tipo_id,
      ref_doc.nacion_id      AS ref_doc_nacion_id,
      

      -- 🔥 ALMACENADOR (para ALM en carga suelta)
      almacenador_p.id AS almacenador_id,
      almacenador_p.rut AS almacenador_rut,
      almacenador_p.nombre AS almacenador_nombre,
      almacenador_p.pais AS almacenador_pais,
      almacenador_p.codigo_almacen AS almacenador_codigo_almacen
      
    FROM bls b
    LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
    LEFT JOIN naves n ON m.nave_id = n.id
    LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
    LEFT JOIN puertos le ON b.lugar_emision_id = le.id
    LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
    LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
    LEFT JOIN puertos ld ON b.lugar_destino_id = ld.id
    LEFT JOIN puertos lem ON b.lugar_entrega_id = lem.id
    LEFT JOIN puertos lrm ON b.lugar_recepcion_id = lrm.id
    
    -- 🔥 JOIN del almacenador (solo para carga suelta)
    LEFT JOIN participantes almacenador_p ON b.almacenador_id = almacenador_p.id
    
    -- 🔥 JOIN del representante desde REFERENCIAS
    LEFT JOIN referencias ref_emi   ON m.operador_nave      = ref_emi.customer_id
    LEFT JOIN referencias ref_emido ON m.emisor_documento   = ref_emido.customer_id
    LEFT JOIN referencias ref_rep   ON m.representante       = ref_rep.match_code

    LEFT JOIN referencias ref_doc ON m.referencia_id = ref_doc.id
    
    WHERE b.bl_number = ?
    LIMIT 1
  `, [blNumber]);

    if (blRows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const bl = blRows[0];

    // 🔥 PARSEAR OBSERVACIONES (SI VIENEN COMO STRING JSON)
    if (bl.observaciones && typeof bl.observaciones === 'string') {
      try {
        bl.observaciones = JSON.parse(bl.observaciones);
      } catch (e) {
        console.error('Error parseando observaciones:', e);
        bl.observaciones = null;
      }
    }

    // 🔥 DETECTAR SI ES CARGA SUELTA
    const esCargaSuelta = bl.tipo_servicio_codigo === 'BB';

    // 🛡️ VALIDAR BL ANTES DE GENERAR XML
    const validation = validateBLForXML(bl);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "BL con datos faltantes",
        details: validation.errors,
        bl_number: blNumber
      });
    }

    // 2️⃣ Obtener items del BL
    const [items] = await pool.query(`
      SELECT * FROM bl_items
      WHERE bl_id = ?
      ORDER BY numero_item
    `, [bl.id]);

    // 3️⃣ Obtener contenedores con sellos E IMO (SOLO SI NO ES CARGA SUELTA)
    let contenedores = [];

    if (!esCargaSuelta) {
      const [contRows] = await pool.query(`
        SELECT
          c.id,
          c.item_id,
          c.codigo,
          c.sigla,
          c.numero,
          c.digito,
          c.tipo_cnt,
          c.carga_cnt,
          c.peso,
          c.unidad_peso,
          c.volumen,
          c.unidad_volumen,
          GROUP_CONCAT(DISTINCT s.sello ORDER BY s.sello SEPARATOR '|') as sellos,
          GROUP_CONCAT(DISTINCT CONCAT(i.clase_imo, ':', i.numero_imo) SEPARATOR '|') as imo_data
        FROM bl_contenedores c
        LEFT JOIN bl_contenedor_sellos s ON s.contenedor_id = c.id
        LEFT JOIN bl_contenedor_imo i ON i.contenedor_id = c.id
        WHERE c.bl_id = ?
        GROUP BY c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito, 
                 c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen
        ORDER BY c.codigo
      `, [bl.id]);

      contenedores = contRows;

      // 🆕 VALIDACIÓN IMO ANTES DE GENERAR XML (solo para contenedores)
      const erroresIMO = [];
      for (const item of items) {
        if (String(item.carga_peligrosa || "").toUpperCase() === "S") {
          const contsDelItem = contenedores.filter(c => c.item_id === item.id);

          for (const cont of contsDelItem) {
            if (!cont.imo_data) {
              erroresIMO.push({
                item: item.numero_item,
                contenedor: cont.codigo,
                mensaje: "Contenedor sin datos IMO (carga peligrosa requiere clase_imo y numero_imo)"
              });
            }
          }
        }
      }

      if (erroresIMO.length > 0) {
        return res.status(400).json({
          error: "Contenedores de carga peligrosa sin datos IMO",
          details: erroresIMO,
          bl_number: blNumber
        });
      }
    }

    // 🔥 AQUÍ VAN LAS FUNCIONES HELPER 👇👇👇

    // 🔥 MAPEO DE CÓDIGOS A DESCRIPCIONES PARA XML
    const mapTipoServicio = (codigo) => {
      const mapeo = {
        'FF': 'FCL/FCL',
        'MM': 'EMPTY',
        'BB': 'BB'
      };
      return mapeo[codigo] || 'FCL/FCL';
    };
    // 🔥 FUNCIÓN HELPER: Limpiar RUT (quitar puntos, mantener guión)
    const cleanRUT = (rut) => {
      if (!rut) return '';
      // Eliminar puntos pero mantener el guión
      return rut.replace(/\./g, '').trim();
    };

    const buildParticipacion = (nombre, participante, includeRUT = true, extraFields = {}) => {
      if (!participante || !participante.nombre) return null;

      const baseData = {
        nombre: nombre
      };

      if (includeRUT && participante.rut) {
        baseData['tipo-id'] = participante.tipo_id || 'RUT';
        baseData['valor-id'] = cleanRUT(participante.rut);
        baseData['nacion-id'] = participante.nacion_id || participante.pais || 'CL';
      }

      baseData['nombres'] = participante.nombre;

      if (participante.direccion && participante.direccion.trim()) {
        baseData['direccion'] = participante.direccion.trim();
      }

      // 🔥 AGREGAR TELÉFONO SI EXISTE
      if (participante.telefono && participante.telefono.trim()) {
        baseData['telefono'] = participante.telefono.trim();
      }

      // 🔥 AGREGAR EMAIL SI EXISTE
      if (participante.email && participante.email.trim()) {
        baseData['correo-electronico'] = participante.email.trim();
      }

      // 🔥 AGREGAR CIUDAD/COMUNA SI EXISTE
      if (participante.ciudad && participante.ciudad.trim()) {
        baseData['comuna'] = participante.ciudad.trim();
      }

      // ✅ AGREGAR CODIGO-PAIS SI TIENE RUT Y PAÍS
      if (includeRUT && participante.rut && participante.pais) {
        baseData['codigo-pais'] = participante.pais;
      }

      // Agregar campos extra si vienen (ej: codigo-almacen)
      Object.assign(baseData, extraFields);

      return baseData;
    };

    // 🔥 CONSTRUIR PARTICIPACIONES EN EL ORDEN CORRECTO
    const participaciones = [];

    // Datos del representante desde REFERENCIAS (para EMI, EMIDO, REP)
    // REEMPLAZA el bloque "representanteData" por estos tres:

    const emiData = bl.emi_id ? {
      nombre: bl.emi_nombre,
      rut: bl.emi_rut,
      pais: bl.emi_pais || 'CL',
      tipo_id: bl.emi_tipo_id || 'RUT',
      nacion_id: bl.emi_nacion_id || 'CL'
    } : null;

    const emidoData = bl.emido_id ? {
      nombre: bl.emido_nombre,
      rut: bl.emido_rut,
      pais: bl.emido_pais || 'CL',
      tipo_id: bl.emido_tipo_id || 'RUT',
      nacion_id: bl.emido_nacion_id || 'CL'
    } : null;

    const repData = bl.rep_id ? {
      nombre: bl.rep_nombre,
      rut: bl.rep_rut,
      pais: bl.rep_pais || 'CL',
      tipo_id: bl.rep_tipo_id || 'RUT',
      nacion_id: bl.rep_nacion_id || 'CL'
    } : null;

    // 🔥 Datos del shipper (para EMB) - DIRECTOS DE BLS
    const shipperData = bl.shipper ? {
      nombre: bl.shipper,
      direccion: bl.shipper_direccion || '.',
      telefono: bl.shipper_telefono || '.',
      email: bl.shipper_email || null
    } : null;

    // 🔥 Datos del consignee (para CONS) - DIRECTOS DE BLS
    const consigneeData = bl.consignee ? {
      nombre: bl.consignee,
      direccion: bl.consignee_direccion || '.',
      telefono: bl.consignee_telefono || '.',
      email: bl.consignee_email || null
    } : null;

    // 🔥 Datos del notify (para NOTI) - DIRECTOS DE BLS
    const notifyData = bl.notify_party ? {
      nombre: bl.notify_party,
      direccion: bl.notify_direccion || '.',
      telefono: bl.notify_telefono || '.',
      email: bl.notify_email || null
    } : null;

    // ✅ ORDEN ESPECÍFICO PARA CARGA SUELTA (BB)
    if (esCargaSuelta) {
      // 1️⃣ EMI - CON CODIGO-PAIS
      if (emiData) {
        const emi = buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais });
        if (emi) participaciones.push(emi);
      }

      // 2️⃣ ALM (Almacenador) - CON CODIGO-ALMACEN
      if (bl.almacenador_id) {
        const almacenadorData = {
          nombre: bl.almacenador_nombre,
          rut: bl.almacenador_rut,
          pais: bl.almacenador_pais || 'CL',
          tipo_id: 'RUT',
          nacion_id: 'CL'
        };

        const extraFields = {};
        if (bl.almacenador_codigo_almacen) {
          extraFields['codigo-almacen'] = bl.almacenador_codigo_almacen;
        }

        const alm = buildParticipacion('ALM', almacenadorData, true, extraFields);
        if (alm) participaciones.push(alm);
      }

      // REP
      if (repData) {
        const rep = buildParticipacion('REP', repData, true);
        if (rep) participaciones.push(rep);
      }

      // EMIDO
      if (emidoData) {
        const emido = buildParticipacion('EMIDO', emidoData, true);
        if (emido) participaciones.push(emido);
      }

      // 5️⃣ EMB - SIN RUT, CON DIRECCION Y TELEFONO
      if (shipperData) {
        const emb = buildParticipacion('EMB', shipperData, false);
        if (emb) participaciones.push(emb);
      }

      // 6️⃣ CONS - CON RUT (si existe), DIRECCION, TELEFONO, COMUNA
      if (consigneeData) {
        const cons = buildParticipacion('CONS', consigneeData, !!consigneeData.rut);
        if (cons) participaciones.push(cons);
      }

      // 7️⃣ NOTI - SIN RUT NORMALMENTE, CON DIRECCION, TELEFONO, COMUNA
      if (notifyData) {
        const noti = buildParticipacion('NOTI', notifyData, false);
        if (noti) participaciones.push(noti);
      }
    }
    // ✅ ORDEN PARA CONTENEDORES (FF/MM) - SIN CAMBIOS
    else {
      // EMI
      if (emiData) {
        const emi = buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais });
        if (emi) participaciones.push(emi);
      }


      // 2️⃣ CONS
      if (consigneeData) {
        const cons = buildParticipacion('CONS', consigneeData, false);
        if (cons) participaciones.push(cons);
      }


      // EMIDO
      if (emidoData) {
        const emido = buildParticipacion('EMIDO', emidoData, true);
        if (emido) participaciones.push(emido);
      }

      // 4️⃣ NOTI
      if (notifyData) {
        const noti = buildParticipacion('NOTI', notifyData, false);
        if (noti) participaciones.push(noti);
      }

      // REP
      if (repData) {
        const rep = buildParticipacion('REP', repData, true);
        if (rep) participaciones.push(rep);
      }


      // 6️⃣ EMB
      if (shipperData) {
        const emb = buildParticipacion('EMB', shipperData, false);
        if (emb) participaciones.push(emb);
      }
    }

    // 4️⃣ Construir XML
    const xmlObj = {
      Documento: {
        '@tipo': 'BL',
        '@version': '1.0',
        'tipo-accion': 'M',
        'numero-referencia': bl.bl_number,
        'service': 'LINER',
        'tipo-servicio': esCargaSuelta ? 'BB' : mapTipoServicio(bl.tipo_servicio_codigo),
        'cond-transporte': bl.cond_transporte || 'HH',
        'total-bultos': bl.bultos || 0,
        'total-peso': bl.peso_bruto || 0,
        'unidad-peso': bl.unidad_peso || 'KGM',
        'total-volumen': bl.volumen || 0,
        'unidad-volumen': bl.unidad_volumen || 'MTQ',
        'total-item': items.length,

        OpTransporte: {
          optransporte: {
            'sentido-operacion': bl.tipo_operacion || 'S',
            'nombre-nave': bl.nave_nombre || ''
          }
        },

        // 🔥 FLETE VA AQUÍ (después de OpTransporte, antes de Fechas)
        ...(esCargaSuelta && {
          Flete: {
            'forma-pago-flete': {
              tipo: bl.forma_pago_flete || 'PREPAID'
            }
          }
        }),

        Fechas: {
          fecha: [
            bl.fecha_presentacion && { nombre: 'FPRES', valor: formatDateTimeCL(bl.fecha_presentacion) },
            bl.manifiesto_fecha_zarpe && { nombre: 'FEM', valor: formatDateCL(bl.manifiesto_fecha_zarpe) },
            bl.manifiesto_fecha_zarpe && { nombre: 'FZARPE', valor: formatDateTimeCL(bl.manifiesto_fecha_zarpe) },
            bl.manifiesto_fecha_zarpe && { nombre: 'FEMB', valor: `${formatDateCL(bl.manifiesto_fecha_zarpe)} 00:00` }
          ].filter(Boolean)
        },

        Locaciones: {
          locacion: [
            // ✅ SOLO incluir LE si NO es carga suelta
            !esCargaSuelta && bl.lugar_emision_codigo && { nombre: 'LE', codigo: bl.lugar_emision_codigo, descripcion: bl.lugar_emision_nombre },

            bl.puerto_embarque_codigo && { nombre: 'PE', codigo: bl.puerto_embarque_codigo, descripcion: bl.puerto_embarque_nombre },
            bl.puerto_descarga_codigo && { nombre: 'PD', codigo: bl.puerto_descarga_codigo, descripcion: bl.puerto_descarga_nombre },
            bl.lugar_destino_codigo && { nombre: 'LD', codigo: bl.lugar_destino_codigo, descripcion: bl.lugar_destino_nombre },
            bl.lugar_entrega_codigo && { nombre: 'LEM', codigo: bl.lugar_entrega_codigo, descripcion: bl.lugar_entrega_nombre },
            bl.lugar_recepcion_codigo && { nombre: 'LRM', codigo: bl.lugar_recepcion_codigo, descripcion: bl.lugar_recepcion_nombre }
          ].filter(Boolean)
        },

        // 🔥 PARTICIPACIONES COMPLETAS
        Participaciones: participaciones.length > 0 ? {
          participacion: participaciones
        } : undefined,

        Items: {
          item: items.map(it => {
            const contsDelItem = contenedores.filter(c => c.item_id === it.id);

            if (esCargaSuelta) {
              return {
                'numero-item': it.numero_item,
                marcas: it.marcas || 'N/M',
                'carga-peligrosa': it.carga_peligrosa || 'N',
                'tipo-bulto': it.tipo_bulto || '',
                descripcion: it.descripcion || '',
                cantidad: it.cantidad || 0,
                'peso-bruto': it.peso_bruto || 0,
                'unidad-peso': it.unidad_peso || 'KGM',
                volumen: parseFloat(it.volumen) || 0,
                'unidad-volumen': it.unidad_volumen || 'MTQ',
                'carga-cnt': 'N'
              };
            }

            return {
              'numero-item': it.numero_item,
              marcas: it.marcas || '',
              'carga-peligrosa': it.carga_peligrosa || 'N',
              'tipo-bulto': it.tipo_bulto || '',
              descripcion: it.descripcion || '',
              cantidad: it.cantidad || 0,
              'peso-bruto': it.peso_bruto || 0,
              'unidad-peso': it.unidad_peso || 'KGM',
              volumen: parseFloat(it.volumen) || 0,
              'unidad-volumen': it.unidad_volumen || 'MTQ',
              'carga-cnt': {},
              Contenedores: contsDelItem.length > 0 ? {
                contenedor: contsDelItem.map(c => {
                  let imoList = [];
                  if (c.imo_data) {
                    imoList = c.imo_data.split('|')
                      .map(item => {
                        const [clase, numero] = item.split(':');
                        return { clase_imo: clase, numero_imo: numero };
                      })
                      .filter(x => x.clase_imo && x.numero_imo);
                  }

                  return {
                    sigla: c.sigla || '',
                    numero: c.numero || '',
                    digito: c.digito || '',
                    'tipo-cnt': c.tipo_cnt || '',
                    'cnt-so': '',
                    peso: c.peso || 0,
                    'valor-id-op': repData?.rut ? cleanRUT(repData.rut) : '',
                    'nombre-operador': repData?.nombre || '',
                    status: mapTipoServicio(bl.tipo_servicio_codigo),

                    CntIMO: imoList.length > 0 ? {
                      cntimo: imoList.length === 1
                        ? { 'clase-imo': String(imoList[0].clase_imo), 'numero-imo': String(imoList[0].numero_imo) }
                        : imoList.map(imo => ({ 'clase-imo': String(imo.clase_imo), 'numero-imo': String(imo.numero_imo) }))
                    } : undefined,

                    Sellos: c.sellos ? {
                      sello: c.sellos.split('|').map(s => ({ numero: s }))
                    } : undefined
                  };
                })
              } : undefined
            };
          })
        },

        Referencias: generarReferencias(bl),

        ...(esCargaSuelta && bl.observaciones && {
          Observaciones: {
            observacion: Array.isArray(bl.observaciones)
              ? bl.observaciones.map(obs => ({
                nombre: obs.nombre || 'GRAL',
                contenido: obs.contenido || ''
              }))
              : [
                {
                  nombre: 'GRAL',
                  contenido: bl.observaciones
                },
                {
                  nombre: 'MOT',
                  contenido: 'LISTA DE ENCARGO'
                }
              ]
          }
        })
      }
    };

    // 5️⃣ Generar XML
    const doc = create({ version: '1.0', encoding: 'ISO-8859-1' }, xmlObj);
    const xmlString = doc.end({ prettyPrint: true });

    // 6️⃣ Enviar como descarga
    res.setHeader('Content-Type', 'application/xml; charset=ISO-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="BMS_V1_SNA-BL-1.0-${bl.bl_number}.xml"`);
    res.send(xmlString);

  } catch (error) {
    console.error("Error al generar XML:", error);
    res.status(500).json({ error: "Error al generar XML", details: error.message });
  }
});
// POST /api/manifiestos/:id/generar-xmls-multiples
// Genera múltiples XMLs y los devuelve en un ZIP
app.post("/api/manifiestos/:id/generar-xmls-multiples", async (req, res) => {
  try {
    const { id } = req.params;
    const { blNumbers } = req.body;

    if (!Array.isArray(blNumbers) || blNumbers.length === 0) {
      return res.status(400).json({ error: "Debe seleccionar al menos un BL" });
    }

    // 🔥 MAPEO DE CÓDIGOS
    const mapTipoServicio = (codigo) => {
      const mapeo = { 'FF': 'FCL/FCL', 'MM': 'EMPTY', 'BB': 'BB' };
      return mapeo[codigo] || 'FCL/FCL';
    };

    const cleanRUT = (rut) => {
      if (!rut) return '';
      return rut.replace(/\./g, '').trim();
    };

    const buildParticipacion = (nombre, participante, includeRUT = true, extraFields = {}) => {
      if (!participante || !participante.nombre) return null;

      const baseData = { nombre };

      if (includeRUT && participante.rut) {
        baseData['tipo-id'] = participante.tipo_id || 'RUT';
        baseData['valor-id'] = cleanRUT(participante.rut);
        baseData['nacion-id'] = participante.nacion_id || participante.pais || 'CL';
      }

      baseData['nombres'] = participante.nombre;

      if (participante.direccion && participante.direccion.trim()) {
        baseData['direccion'] = participante.direccion.trim();
      }

      if (participante.telefono && participante.telefono.trim()) {
        baseData['telefono'] = participante.telefono.trim();
      }

      if (participante.email && participante.email.trim()) {
        baseData['correo-electronico'] = participante.email.trim();
      }

      if (participante.ciudad && participante.ciudad.trim()) {
        baseData['comuna'] = participante.ciudad.trim();
      }

      if (includeRUT && participante.rut && participante.pais) {
        baseData['codigo-pais'] = participante.pais;
      }

      Object.assign(baseData, extraFields);

      return baseData;
    };

    // 🔥 QUERY REUTILIZABLE (con los 4 JOINs correctos)
    const getBLQuery = () => `
      SELECT
        b.*,
        m.viaje,
        m.tipo_operacion,
        m.numero_referencia,
        m.fecha_referencia,
        m.fecha_manifiesto_aduana,
        m.fecha_zarpe AS manifiesto_fecha_zarpe,
        m.representante AS representante_codigo,
        n.nombre AS nave_nombre,
        ts.codigo AS tipo_servicio_codigo,
        ts.nombre AS tipo_servicio_nombre,
        le.codigo AS lugar_emision_codigo,
        le.nombre AS lugar_emision_nombre,
        pe.codigo AS puerto_embarque_codigo,
        pe.nombre AS puerto_embarque_nombre,
        pd.codigo AS puerto_descarga_codigo,
        pd.nombre AS puerto_descarga_nombre,
        ld.codigo AS lugar_destino_codigo,
        ld.nombre AS lugar_destino_nombre,
        lem.codigo AS lugar_entrega_codigo,
        lem.nombre AS lugar_entrega_nombre,
        lrm.codigo AS lugar_recepcion_codigo,
        lrm.nombre AS lugar_recepcion_nombre,

        -- EMI
        ref_emi.id            AS emi_id,
        ref_emi.rut           AS emi_rut,
        ref_emi.nombre_emisor AS emi_nombre,
        ref_emi.pais          AS emi_pais,
        ref_emi.tipo_id_emisor AS emi_tipo_id,
        ref_emi.nacion_id     AS emi_nacion_id,

        -- EMIDO
        ref_emido.id            AS emido_id,
        ref_emido.rut           AS emido_rut,
        ref_emido.nombre_emisor AS emido_nombre,
        ref_emido.pais          AS emido_pais,
        ref_emido.tipo_id_emisor AS emido_tipo_id,
        ref_emido.nacion_id     AS emido_nacion_id,

        -- REP
        ref_rep.id            AS rep_id,
        ref_rep.rut           AS rep_rut,
        ref_rep.nombre_emisor AS rep_nombre,
        ref_rep.pais          AS rep_pais,
        ref_rep.tipo_id_emisor AS rep_tipo_id,
        ref_rep.nacion_id     AS rep_nacion_id,

        -- REF (Referencias XML)
        ref_doc.id            AS ref_doc_id,
        ref_doc.rut           AS ref_doc_rut,
        ref_doc.nombre_emisor AS ref_doc_nombre,
        ref_doc.match_code    AS ref_doc_codigo,
        ref_doc.pais          AS ref_doc_pais,
        ref_doc.tipo_id_emisor AS ref_doc_tipo_id,
        ref_doc.nacion_id     AS ref_doc_nacion_id,

        -- ALMACENADOR
        almacenador_p.id               AS almacenador_id,
        almacenador_p.rut              AS almacenador_rut,
        almacenador_p.nombre           AS almacenador_nombre,
        almacenador_p.pais             AS almacenador_pais,
        almacenador_p.codigo_almacen   AS almacenador_codigo_almacen

      FROM bls b
      LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
      LEFT JOIN naves n ON m.nave_id = n.id
      LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      LEFT JOIN puertos le ON b.lugar_emision_id = le.id
      LEFT JOIN puertos pe ON b.puerto_embarque_id = pe.id
      LEFT JOIN puertos pd ON b.puerto_descarga_id = pd.id
      LEFT JOIN puertos ld ON b.lugar_destino_id = ld.id
      LEFT JOIN puertos lem ON b.lugar_entrega_id = lem.id
      LEFT JOIN puertos lrm ON b.lugar_recepcion_id = lrm.id
      LEFT JOIN participantes almacenador_p ON b.almacenador_id = almacenador_p.id
      LEFT JOIN referencias ref_emi   ON m.operador_nave    = ref_emi.customer_id
      LEFT JOIN referencias ref_emido ON m.emisor_documento = ref_emido.customer_id
      LEFT JOIN referencias ref_rep   ON m.representante    = ref_rep.match_code
      LEFT JOIN referencias ref_doc   ON m.referencia_id    = ref_doc.id

      WHERE b.bl_number = ?
      LIMIT 1
    `;

    // 🛡️ VALIDAR TODOS LOS BLs ANTES DE GENERAR
    const blsConErrores = [];

    for (const blNumber of blNumbers) {
      const [blRows] = await pool.query(getBLQuery(), [blNumber]);
      if (blRows.length === 0) continue;

      const validation = validateBLForXML(blRows[0]);
      if (!validation.isValid) {
        blsConErrores.push({ bl_number: blNumber, errors: validation.errors });
      }
    }

    if (blsConErrores.length > 0) {
      return res.status(400).json({
        error: "Hay BLs con datos faltantes",
        bls_con_errores: blsConErrores,
        total_errores: blsConErrores.length
      });
    }

    // Crear archivo ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="BLs_Manifiesto_${id}.zip"`);
    archive.pipe(res);

    // Generar XML por cada BL
    for (const blNumber of blNumbers) {
      const [blRows] = await pool.query(getBLQuery(), [blNumber]);
      if (blRows.length === 0) continue;

      const bl = blRows[0];

      // 🔥 PARSEAR OBSERVACIONES
      if (bl.observaciones && typeof bl.observaciones === 'string') {
        try { bl.observaciones = JSON.parse(bl.observaciones); }
        catch (e) { bl.observaciones = null; }
      }

      const esCargaSuelta = bl.tipo_servicio_codigo === 'BB';

      const [items] = await pool.query(`
        SELECT * FROM bl_items WHERE bl_id = ? ORDER BY numero_item
      `, [bl.id]);

      let contenedores = [];

      if (!esCargaSuelta) {
        const [contRows] = await pool.query(`
          SELECT
            c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito,
            c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen,
            GROUP_CONCAT(DISTINCT s.sello ORDER BY s.sello SEPARATOR '|') as sellos,
            GROUP_CONCAT(DISTINCT CONCAT(i.clase_imo, ':', i.numero_imo) SEPARATOR '|') as imo_data
          FROM bl_contenedores c
          LEFT JOIN bl_contenedor_sellos s ON s.contenedor_id = c.id
          LEFT JOIN bl_contenedor_imo i ON i.contenedor_id = c.id
          WHERE c.bl_id = ?
          GROUP BY c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito,
                   c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen
          ORDER BY c.codigo
        `, [bl.id]);
        contenedores = contRows;
      }

      const participaciones = [];

      // 🔥 TRES FUENTES DISTINTAS (igual que generar-xml)
      const emiData = bl.emi_id ? {
        nombre: bl.emi_nombre,
        rut: bl.emi_rut,
        pais: bl.emi_pais || 'CL',
        tipo_id: bl.emi_tipo_id || 'RUT',
        nacion_id: bl.emi_nacion_id || 'CL'
      } : null;

      const emidoData = bl.emido_id ? {
        nombre: bl.emido_nombre,
        rut: bl.emido_rut,
        pais: bl.emido_pais || 'CL',
        tipo_id: bl.emido_tipo_id || 'RUT',
        nacion_id: bl.emido_nacion_id || 'CL'
      } : null;

      const repData = bl.rep_id ? {
        nombre: bl.rep_nombre,
        rut: bl.rep_rut,
        pais: bl.rep_pais || 'CL',
        tipo_id: bl.rep_tipo_id || 'RUT',
        nacion_id: bl.rep_nacion_id || 'CL'
      } : null;

      // 🔥 SHIPPER, CONSIGNEE, NOTIFY - DIRECTOS DE BLS (igual que generar-xml)
      const shipperData = bl.shipper ? {
        nombre: bl.shipper,
        direccion: bl.shipper_direccion || '.',
        telefono: bl.shipper_telefono || '.',
        email: bl.shipper_email || null
      } : null;

      const consigneeData = bl.consignee ? {
        nombre: bl.consignee,
        direccion: bl.consignee_direccion || '.',
        telefono: bl.consignee_telefono || '.',
        email: bl.consignee_email || null
      } : null;

      const notifyData = bl.notify_party ? {
        nombre: bl.notify_party,
        direccion: bl.notify_direccion || '.',
        telefono: bl.notify_telefono || '.',
        email: bl.notify_email || null
      } : null;

      // ✅ ORDEN CARGA SUELTA (BB)
      if (esCargaSuelta) {
        if (emiData) {
          const emi = buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais });
          if (emi) participaciones.push(emi);
        }

        if (bl.almacenador_id) {
          const almacenadorData = {
            nombre: bl.almacenador_nombre,
            rut: bl.almacenador_rut,
            pais: bl.almacenador_pais || 'CL',
            tipo_id: 'RUT',
            nacion_id: 'CL'
          };
          const extraFields = {};
          if (bl.almacenador_codigo_almacen) {
            extraFields['codigo-almacen'] = bl.almacenador_codigo_almacen;
          }
          const alm = buildParticipacion('ALM', almacenadorData, true, extraFields);
          if (alm) participaciones.push(alm);
        }

        if (repData) {
          const rep = buildParticipacion('REP', repData, true);
          if (rep) participaciones.push(rep);
        }

        if (emidoData) {
          const emido = buildParticipacion('EMIDO', emidoData, true);
          if (emido) participaciones.push(emido);
        }

        if (shipperData) {
          const emb = buildParticipacion('EMB', shipperData, false);
          if (emb) participaciones.push(emb);
        }

        if (consigneeData) {
          const cons = buildParticipacion('CONS', consigneeData, !!consigneeData.rut);
          if (cons) participaciones.push(cons);
        }

        if (notifyData) {
          const noti = buildParticipacion('NOTI', notifyData, false);
          if (noti) participaciones.push(noti);
        }
      }
      // ✅ ORDEN CONTENEDORES (FF/MM)
      else {
        if (emiData) {
          const emi = buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais });
          if (emi) participaciones.push(emi);
        }

        if (consigneeData) {
          const cons = buildParticipacion('CONS', consigneeData, false);
          if (cons) participaciones.push(cons);
        }

        if (emidoData) {
          const emido = buildParticipacion('EMIDO', emidoData, true);
          if (emido) participaciones.push(emido);
        }

        if (notifyData) {
          const noti = buildParticipacion('NOTI', notifyData, false);
          if (noti) participaciones.push(noti);
        }

        if (repData) {
          const rep = buildParticipacion('REP', repData, true);
          if (rep) participaciones.push(rep);
        }

        if (shipperData) {
          const emb = buildParticipacion('EMB', shipperData, false);
          if (emb) participaciones.push(emb);
        }
      }

      // 🔥 CONSTRUIR XML
      const xmlObj = {
        Documento: {
          '@tipo': 'BL',
          '@version': '1.0',
          'tipo-accion': 'M',
          'numero-referencia': bl.bl_number,
          'service': 'LINER',
          'tipo-servicio': esCargaSuelta ? 'BB' : mapTipoServicio(bl.tipo_servicio_codigo),
          'cond-transporte': bl.cond_transporte || 'HH',
          'total-bultos': bl.bultos || 0,
          'total-peso': bl.peso_bruto || 0,
          'unidad-peso': bl.unidad_peso || 'KGM',
          'total-volumen': bl.volumen || 0,
          'unidad-volumen': bl.unidad_volumen || 'MTQ',
          'total-item': items.length,

          OpTransporte: {
            optransporte: {
              'sentido-operacion': bl.tipo_operacion || 'S',
              'nombre-nave': bl.nave_nombre || ''
            }
          },

          ...(esCargaSuelta && {
            Flete: {
              'forma-pago-flete': {
                tipo: bl.forma_pago_flete || 'PREPAID'
              }
            }
          }),

          Fechas: {
            fecha: [
              bl.fecha_presentacion && { nombre: 'FPRES', valor: formatDateTimeCL(bl.fecha_presentacion) },
              bl.manifiesto_fecha_zarpe && { nombre: 'FEM', valor: formatDateCL(bl.manifiesto_fecha_zarpe) },
              bl.manifiesto_fecha_zarpe && { nombre: 'FZARPE', valor: formatDateTimeCL(bl.manifiesto_fecha_zarpe) },
              bl.manifiesto_fecha_zarpe && { nombre: 'FEMB', valor: `${formatDateCL(bl.manifiesto_fecha_zarpe)} 00:00` }
            ].filter(Boolean)
          },

          Locaciones: {
            locacion: [
              !esCargaSuelta && bl.lugar_emision_codigo && { nombre: 'LE', codigo: bl.lugar_emision_codigo, descripcion: bl.lugar_emision_nombre },
              bl.puerto_embarque_codigo && { nombre: 'PE', codigo: bl.puerto_embarque_codigo, descripcion: bl.puerto_embarque_nombre },
              bl.puerto_descarga_codigo && { nombre: 'PD', codigo: bl.puerto_descarga_codigo, descripcion: bl.puerto_descarga_nombre },
              bl.lugar_destino_codigo && { nombre: 'LD', codigo: bl.lugar_destino_codigo, descripcion: bl.lugar_destino_nombre },
              bl.lugar_entrega_codigo && { nombre: 'LEM', codigo: bl.lugar_entrega_codigo, descripcion: bl.lugar_entrega_nombre },
              bl.lugar_recepcion_codigo && { nombre: 'LRM', codigo: bl.lugar_recepcion_codigo, descripcion: bl.lugar_recepcion_nombre }
            ].filter(Boolean)
          },

          Participaciones: participaciones.length > 0 ? {
            participacion: participaciones
          } : undefined,

          Items: {
            item: items.map(it => {
              const contsDelItem = contenedores.filter(c => c.item_id === it.id);

              if (esCargaSuelta) {
                return {
                  'numero-item': it.numero_item,
                  marcas: it.marcas || 'N/M',
                  'carga-peligrosa': it.carga_peligrosa || 'N',
                  'tipo-bulto': it.tipo_bulto || '',
                  descripcion: it.descripcion || '',
                  cantidad: it.cantidad || 0,
                  'peso-bruto': it.peso_bruto || 0,
                  'unidad-peso': it.unidad_peso || 'KGM',
                  volumen: parseFloat(it.volumen) || 0,
                  'unidad-volumen': it.unidad_volumen || 'MTQ',
                  'carga-cnt': 'N'
                };
              }

              return {
                'numero-item': it.numero_item,
                marcas: it.marcas || '',
                'carga-peligrosa': it.carga_peligrosa || 'N',
                'tipo-bulto': it.tipo_bulto || '',
                descripcion: it.descripcion || '',
                cantidad: it.cantidad || 0,
                'peso-bruto': it.peso_bruto || 0,
                'unidad-peso': it.unidad_peso || 'KGM',
                volumen: parseFloat(it.volumen) || 0,
                'unidad-volumen': it.unidad_volumen || 'MTQ',
                'carga-cnt': {},
                Contenedores: contsDelItem.length > 0 ? {
                  contenedor: contsDelItem.map(c => {
                    let imoList = [];
                    if (c.imo_data) {
                      imoList = c.imo_data.split('|')
                        .map(item => {
                          const [clase, numero] = item.split(':');
                          return { clase_imo: clase, numero_imo: numero };
                        })
                        .filter(x => x.clase_imo && x.numero_imo);
                    }

                    return {
                      sigla: c.sigla || '',
                      numero: c.numero || '',
                      digito: c.digito || '',
                      'tipo-cnt': c.tipo_cnt || '',
                      'cnt-so': '',
                      peso: c.peso || 0,
                      'valor-id-op': repData?.rut ? cleanRUT(repData.rut) : '',
                      'nombre-operador': repData?.nombre || '',
                      status: mapTipoServicio(bl.tipo_servicio_codigo),

                      CntIMO: imoList.length > 0 ? {
                        cntimo: imoList.length === 1
                          ? { 'clase-imo': String(imoList[0].clase_imo), 'numero-imo': String(imoList[0].numero_imo) }
                          : imoList.map(imo => ({ 'clase-imo': String(imo.clase_imo), 'numero-imo': String(imo.numero_imo) }))
                      } : undefined,

                      Sellos: c.sellos ? {
                        sello: c.sellos.split('|').map(s => ({ numero: s }))
                      } : undefined
                    };
                  })
                } : undefined
              };
            })
          },

          Referencias: generarReferencias(bl),

          ...(esCargaSuelta && bl.observaciones && {
            Observaciones: {
              observacion: Array.isArray(bl.observaciones)
                ? bl.observaciones.map(obs => ({
                  nombre: obs.nombre || 'GRAL',
                  contenido: obs.contenido || ''
                }))
                : [
                  { nombre: 'GRAL', contenido: bl.observaciones },
                  { nombre: 'MOT', contenido: 'LISTA DE ENCARGO' }
                ]
            }
          })
        }
      };

      const doc = create({ version: '1.0', encoding: 'ISO-8859-1' }, xmlObj);
      const xmlString = doc.end({ prettyPrint: true });
      archive.append(xmlString, { name: `BMS_V1_SNA-BL-1.0-${bl.bl_number}.xml` });
    }

    await archive.finalize();

  } catch (error) {
    console.error("Error al generar XMLs múltiples:", error);
    res.status(500).json({ error: "Error al generar XMLs" });
  }
});

// 🆕 GET /bls/:blNumber/transbordos
// Obtener transbordos de un BL específico
app.get("/bls/:blNumber/transbordos", async (req, res) => {
  try {
    const { blNumber } = req.params;

    // 1) Obtener bl_id
    const [blRows] = await pool.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    // 2) Obtener transbordos con info del puerto
    const [transbordos] = await pool.query(`
      SELECT 
        t.id,
        t.sec,
        t.puerto_cod,
        t.puerto_id,
        p.nombre AS puerto_nombre,
        p.pais AS puerto_pais
      FROM bl_transbordos t
      LEFT JOIN puertos p ON t.puerto_id = p.id
      WHERE t.bl_id = ?
      ORDER BY t.sec ASC
    `, [blId]);

    res.json(transbordos);
  } catch (error) {
    console.error("Error al obtener transbordos:", error);
    res.status(500).json({ error: "Error al obtener transbordos" });
  }
});


// 🆕 PUT /bls/:blNumber/transbordos
// Actualizar transbordos de un BL
app.put("/bls/:blNumber/transbordos", async (req, res) => {
  const { blNumber } = req.params;
  const { transbordos } = req.body;

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

    // 2) Eliminar transbordos existentes
    await conn.query("DELETE FROM bl_transbordos WHERE bl_id = ?", [blId]);

    // 3) Insertar nuevos transbordos
    if (Array.isArray(transbordos) && transbordos.length > 0) {
      for (const tb of transbordos) {
        if (!tb.puerto_cod) continue;

        const [puertoRows] = await conn.query(
          "SELECT id FROM puertos WHERE codigo = ? LIMIT 1",
          [tb.puerto_cod]
        );

        const puertoId = puertoRows.length > 0 ? puertoRows[0].id : null;

        await conn.query(
          `INSERT INTO bl_transbordos (bl_id, sec, puerto_cod, puerto_id)
           VALUES (?, ?, ?, ?)`,
          [blId, tb.sec, tb.puerto_cod, puertoId]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Transbordos actualizados correctamente" });
  } catch (error) {
    await conn.rollback();
    console.error("Error al actualizar transbordos:", error);
    res.status(500).json({ error: "Error al actualizar transbordos" });
  } finally {
    conn.release();
  }
});

// 🆕 GET /bls/:blNumber/validaciones
app.get("/bls/:blNumber/validaciones", async (req, res) => {
  try {
    const { blNumber } = req.params;

    const [blRows] = await pool.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    const [validaciones] = await pool.query(`
      SELECT 
        id, nivel, ref_id, sec, severidad, campo, mensaje, valor_crudo, created_at
      FROM bl_validaciones
      WHERE bl_id = ?
      ORDER BY 
        FIELD(nivel, 'BL', 'ITEM', 'CONTENEDOR', 'TRANSBORDO'),
        FIELD(severidad, 'ERROR', 'OBS'),
        sec ASC
    `, [blId]);

    res.json(validaciones);
  } catch (error) {
    console.error("Error al obtener validaciones:", error);
    res.status(500).json({ error: "Error al obtener validaciones" });
  }
});

async function revalidarBLCompleto(conn, blId) {
  // 0) limpiar “estado vivo”
  await conn.query("DELETE FROM bl_validaciones WHERE bl_id = ?", [blId]);

  // 1) cargar BL desde BD
  const [[bl]] = await conn.query(
    `SELECT * FROM bls WHERE id = ? LIMIT 1`,
    [blId]
  );
  if (!bl) return;

  // 2) Cargar todo lo relacionado
  const [items] = await conn.query(
    `SELECT * FROM bl_items WHERE bl_id = ? ORDER BY numero_item`,
    [blId]
  );

  const [contenedores] = await conn.query(
    `SELECT * FROM bl_contenedores WHERE bl_id = ? ORDER BY id`,
    [blId]
  );

  const [transbordos] = await conn.query(
    `SELECT * FROM bl_transbordos WHERE bl_id = ? ORDER BY sec`,
    [blId]
  );

  // Mapas útiles
  const itemByNumero = new Map(items.map(i => [Number(i.numero_item), i]));
  const itemById = new Map(items.map(i => [i.id, i]));

  // ==========================================================
  // A) Re-resolver FKs (puertos/tipo_servicio) y actualizar BL
  // ==========================================================
  // (usa los *_cod del BL)
  const lugarEmisionId = await getPuertoIdByCodigo(conn, bl.lugar_emision_cod);
  const puertoEmbarqueId = await getPuertoIdByCodigo(conn, bl.puerto_embarque_cod);
  const puertoDescargaId = await getPuertoIdByCodigo(conn, bl.puerto_descarga_cod);

  const lugarDestinoId = await getPuertoIdByCodigo(conn, bl.lugar_destino_cod);
  const lugarEntregaId = await getPuertoIdByCodigo(conn, bl.lugar_entrega_cod);
  const lugarRecepcionId = await getPuertoIdByCodigo(conn, bl.lugar_recepcion_cod);

  // Ojo: tu tabla tiene tipo_servicio_id, y también tienes tipo_servicio_cod en algunos flujos.
  // Si en BL guardas tipo_servicio_cod (ej ts.codigo), úsalo. Si no, salta esta parte.
  const tipoServicioCod = bl.tipo_servicio_cod || null;
  const tipoServicioId = tipoServicioCod
    ? await getTipoServicioIdByCodigo(conn, tipoServicioCod)
    : bl.tipo_servicio_id;

  // resolver codigo final (por si tipo_servicio_cod viene null)
  let tipoServicioCodFinal = (bl.tipo_servicio_cod || "").trim();

  if (!tipoServicioCodFinal && tipoServicioId) {
    const [[ts]] = await conn.query(
      "SELECT codigo FROM tipos_servicio WHERE id = ? LIMIT 1",
      [tipoServicioId]
    );
    tipoServicioCodFinal = (ts?.codigo || "").trim();
  }

  tipoServicioCodFinal = String(tipoServicioCodFinal || "").trim().toUpperCase();
  const esEmpty = tipoServicioCodFinal === "MM";

  // ✅ BB (carga suelta) se mantiene por reglas de formulario, no PMS
  if (tipoServicioCodFinal.toUpperCase() === "BB") {
    await refreshResumenValidacionBL(conn, blId);
    return;
  }

  // actualiza FKs si corresponde (opcional, pero recomendado)
  await conn.query(
    `UPDATE bls SET
      lugar_emision_id   = ?,
      puerto_embarque_id = ?,
      puerto_descarga_id = ?,
      lugar_destino_id   = ?,
      lugar_entrega_id   = ?,
      lugar_recepcion_id = ?,
      tipo_servicio_id = ?
     WHERE id = ?`,
    [
      lugarEmisionId || null,
      puertoEmbarqueId || null,
      puertoDescargaId || null,
      lugarDestinoId || null,
      lugarEntregaId || null,
      lugarRecepcionId || null,
      tipoServicioId || null,
      blId
    ]
  );

  // ==========================================================
  // B) VALIDACIONES (mismas reglas que PMS)
  // ==========================================================
  const vals = [];

  // ---- BL: puertos y tipo_servicio
  if (!lugarEmisionId) {
    vals.push({
      nivel: "BL", severidad: "ERROR", campo: "lugar_emision_id",
      mensaje: `Lugar de emisión '${bl.lugar_emision_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 74)`,
      valorCrudo: bl.lugar_emision_cod || null
    });
  }
  if (!puertoEmbarqueId) {
    vals.push({
      nivel: "BL", severidad: "ERROR", campo: "puerto_embarque_id",
      mensaje: `Puerto de embarque '${bl.puerto_embarque_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 14 o 13)`,
      valorCrudo: bl.puerto_embarque_cod || null
    });
  }
  // ✅ REEMPLAZA POR:
  // ✅ REEMPLAZA POR:
  if (!puertoDescargaId) {
    vals.push({  // ✅ BIEN
      nivel: "BL",
      severidad: "ERROR",
      campo: "puerto_descarga_id",
      mensaje: `Puerto de descarga '${bl.puerto_descarga_cod || 'No encontrado'}' no existe en mantenedor de puertos (Linea 14 o 13)`,
      valorCrudo: bl.puerto_descarga_cod || null
    });
  }
  if (!tipoServicioId) {
    vals.push({
      nivel: "BL", severidad: "ERROR", campo: "tipo_servicio_id",
      mensaje: "Tipo de servicio no existe en mantenedor",
      valorCrudo: bl.tipoServicioCod || null
    });
  }

  // BL: LD/LEM/LRM (si no existen, ERROR)
  // BL: LD/LEM/LRM (si no existen, ERROR)
  if (!lugarDestinoId) vals.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_destino_id", mensaje: `Lugar destino no existe en mantenedor de puertos (Revisar puerto de descarga)`, valorCrudo: bl.lugar_destino_cod || null });
  if (!lugarEntregaId) vals.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_entrega_id", mensaje: `Lugar entrega no existe en mantenedor de puertos (Revisar puerto de descarga)`, valorCrudo: bl.lugar_entrega_cod || null });
  if (!lugarRecepcionId) vals.push({ nivel: "BL", severidad: "ERROR", campo: "lugar_recepcion_id", mensaje: `Lugar recepción no existe en mantenedor de puertos (Revisar puerto de embarque)`, valorCrudo: bl.lugar_recepcion_cod || null });
  // BL: fechas obligatorias
  if (isBlank(bl.fecha_emision)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_emision", mensaje: "Falta fecha_emision (Linea 11)", valorCrudo: bl.fecha_emision || null });
  if (isBlank(bl.fecha_presentacion)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_presentacion", mensaje: "Falta fecha_presentacion (Linea 00)", valorCrudo: bl.fecha_presentacion || null });
  if (isBlank(bl.fecha_embarque)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_embarque", mensaje: "Falta fecha_embarque (Linea 14)", valorCrudo: bl.fecha_embarque || null });
  if (isBlank(bl.fecha_zarpe)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "fecha_zarpe", mensaje: "Falta fecha_zarpe (Linea 14)", valorCrudo: bl.fecha_zarpe || null });

  // BL: pesos/volumen/unidades/bultos/items

  if (!esEmpty && num(bl.peso_bruto) <= 0) {
    vals.push({ nivel: "BL", severidad: "ERROR", campo: "peso_bruto", mensaje: "peso_bruto debe ser > 0", valorCrudo: bl.peso_bruto });
  }


  if (isBlank(bl.unidad_peso)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "unidad_peso", mensaje: "Falta unidad_peso (Linea 41)", valorCrudo: bl.unidad_peso || null });

  if (num(bl.bultos) < 1) vals.push({ nivel: "BL", severidad: "ERROR", campo: "bultos", mensaje: "bultos debe ser >= 1", valorCrudo: bl.bultos });
  if (num(bl.total_items) < 1) vals.push({ nivel: "BL", severidad: "ERROR", campo: "total_items", mensaje: "total_items debe ser >= 1", valorCrudo: bl.total_items });

  if (isBlank(bl.unidad_volumen)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "unidad_volumen", mensaje: "Falta unidad_volumen (Linea 41)", valorCrudo: bl.unidad_volumen || null });
  if (num(bl.volumen) == null) vals.push({ nivel: "BL", severidad: "ERROR", campo: "volumen", mensaje: "Falta Volumen debe ser >= 0 (puede ser 0)", valorCrudo: bl.volumen });

  // BL: shipper/consignee/notify
  if (isBlank(bl.shipper)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "shipper", mensaje: "Falta shipper (Linea 16)", valorCrudo: bl.shipper || null });
  if (isBlank(bl.consignee)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "consignee", mensaje: "Falta consignee (Linea 21)", valorCrudo: bl.consignee || null });
  if (isBlank(bl.notify_party)) vals.push({ nivel: "BL", severidad: "ERROR", campo: "notify_party", mensaje: "Falta notify (Linea 26)", valorCrudo: bl.notify_party || null });


  // ✅ NUEVO: contar contenedores reales por item_id (lo que realmente quedó en BD)
  const contCountByItemId = new Map(); // item_id -> count

  for (const c of contenedores) {
    const itemId = c.item_id ? Number(c.item_id) : null;
    if (!itemId) continue;
    contCountByItemId.set(itemId, (contCountByItemId.get(itemId) || 0) + 1);
  }


  // ---- ITEMS (misma lógica)
  for (const it of items) {
    const itemNum = Number(it.numero_item) || null;
    const refId = it.id;

    if (!itemNum) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: null, severidad: "ERROR", campo: "numero_item", mensaje: "Item sin número", valorCrudo: it.numero_item ?? null });
    }

    if (isBlank(it.descripcion)) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "OBS", campo: "descripcion", mensaje: "Falta Descripción", valorCrudo: it.descripcion ?? null });
    }
    if (isBlank(it.marcas)) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "OBS", campo: "marcas", mensaje: "Falta Marcas", valorCrudo: it.marcas ?? null });
    }

    // Detectar tipo_cnt real desde contenedores en BD para este item
    const contsDelItem = contenedores.filter(c => Number(c.item_id) === Number(refId));
    let tipoCntDetectado = contsDelItem.find(c => c.tipo_cnt)?.tipo_cnt || null;

    // Si viene con sufijo (ej 22G1E) y tu mantenedor espera 22G1
    if (tipoCntDetectado && tipoCntDetectado.length === 5) {
      tipoCntDetectado = tipoCntDetectado.slice(0, 4);
    }

    // Si no hay tipo_bulto guardado, intenta resolverlo con el tipo_cnt detectado
    let tipoBultoRecalc = it.tipo_bulto || null;
    if (!tipoBultoRecalc && tipoCntDetectado) {
      tipoBultoRecalc = await getTipoBultoFromTipoCnt(conn, tipoCntDetectado);
    }

    if (!it.tipo_bulto && tipoBultoRecalc) {
      await conn.query("UPDATE bl_items SET tipo_bulto = ? WHERE id = ?", [tipoBultoRecalc, refId]);
      it.tipo_bulto = tipoBultoRecalc;
    }


    if (!it.tipo_bulto && !tipoBultoRecalc) {
      vals.push({
        nivel: "ITEM",
        ref_id: refId,
        sec: itemNum,
        severidad: "ERROR",
        campo: "tipo_bulto",
        mensaje: `No se pudo determinar tipo_bulto para el item (tipo_cnt detectado: ${tipoCntDetectado || "NULL"})`,
        valorCrudo: tipoCntDetectado || null
      });
    }

    if (!isSN(it.carga_peligrosa)) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "carga_peligrosa", mensaje: "carga_peligrosa debe ser 'S' o 'N'", valorCrudo: it.carga_peligrosa ?? null });
    }

    if (num(it.cantidad) == null || num(it.cantidad) < 1) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "cantidad", mensaje: "Cantidad de contenedores debe ser >= 1 para un item (Linea 51)", valorCrudo: it.cantidad });
    }

    // ✅ NUEVO: mismatch entre "esperados" (it.cantidad) vs "reales" (contenedores en BD)
    const esperados = num(it.cantidad); // cantidad esperada (línea 41 en tu flujo)
    const reales = contCountByItemId.get(refId) || 0;

    if (itemNum && esperados != null && esperados > 0 && reales < esperados) {
      const faltan = esperados - reales;

      vals.push({
        nivel: "ITEM",
        ref_id: refId,
        sec: itemNum,
        severidad: "ERROR",
        campo: "contenedores",
        mensaje: `Faltan contenedores para el item: se esperaban ${esperados} (cantidad) y hay ${reales} en BD. Faltan ${faltan}.`,
        valorCrudo: JSON.stringify({ esperados, reales, faltan })
      });
    } else if (itemNum && esperados != null && esperados > 0 && reales > esperados) {
      const sobran = reales - esperados;

      vals.push({
        nivel: "ITEM",
        ref_id: refId,
        sec: itemNum,
        severidad: "OBS",             // ✅ OBS
        campo: "contenedores",
        mensaje: `Sobran contenedores para el item: se esperaban ${esperados} (cantidad) y hay ${reales} en BD. Sobran ${sobran}.`,
        valorCrudo: JSON.stringify({ esperados, reales, sobran })
      });
    }

    if (!esEmpty && (num(it.peso_bruto) == null || num(it.peso_bruto) <= 0)) {
      vals.push({
        nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "peso_bruto",
        mensaje: "peso_bruto debe ser > 0 (Linea 41)", valorCrudo: it.peso_bruto
      });
    }

    if (isBlank(it.unidad_peso)) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "unidad_peso", mensaje: "Falta unidad_peso (Linea 41)", valorCrudo: it.unidad_peso ?? null });
    }

    if (num(it.volumen) == null || num(it.volumen) < 0) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "volumen", mensaje: "Falta Volumen debe ser >= 0 (Linea 41)", valorCrudo: it.volumen });
    }
    if (isBlank(it.unidad_volumen)) {
      vals.push({ nivel: "ITEM", ref_id: refId, sec: itemNum, severidad: "ERROR", campo: "unidad_volumen", mensaje: "Falta unidad_volumen (Linea 41)", valorCrudo: it.unidad_volumen ?? null });
    }
  }

  // ---- CONTENEDORES (misma lógica + IMO + sellos)
  for (const c of contenedores) {
    const refId = c.id;

    // itemNo lo sacas desde item asociado
    const itemObj = c.item_id ? itemById.get(c.item_id) : null;
    const itemNo = itemObj ? Number(itemObj.numero_item) : null;

    // codigo ISO11
    if (c.codigo) {
      const iso = splitISO11(c.codigo);
      if (!iso) {
        vals.push({
          nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "codigo",
          mensaje: "Código contenedor inválido (no ISO11: AAAA1234567)", valorCrudo: c.codigo
        });
      } else {
        if ((c.sigla && c.sigla !== iso.sigla) ||
          (c.numero && c.numero !== iso.numero) ||
          (c.digito && String(c.digito) !== iso.digito)) {
          vals.push({
            nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "sigla/numero/digito",
            mensaje: "codigo no coincide con sigla/numero/digito",
            valorCrudo: `${c.codigo} vs ${c.sigla || ""}${c.numero || ""}${c.digito || ""}`
          });
        }
      }
    } else {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "codigo",
        mensaje: "Contenedor sin código", valorCrudo: c.codigo ?? null
      });
    }

    // item_id obligatorio si quieres mantener la misma regla
    if (!c.item_id) {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "item_id",
        mensaje: "Contenedor no asociado a item (item_id null)", valorCrudo: null
      });
    }

    if (!c.tipo_cnt) {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "tipo_cnt",
        mensaje: "Contenedor sin tipo_cnt", valorCrudo: c.tipo_cnt ?? null
      });
    }

    if (!esEmpty && (num(c.peso) == null || num(c.peso) <= 0)) {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "peso",
        mensaje: "peso debe ser > 0", valorCrudo: c.peso
      });
    }

    if (isBlank(c.unidad_peso)) {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "unidad_peso",
        mensaje: "Falta unidad_peso", valorCrudo: c.unidad_peso ?? null
      });
    }

    // ✅ volumen normalizado (MM permite null => lo tratamos como 0)
    let vol = num(c.volumen);

    // si es EMPTY (MM) y viene null, lo tratamos como 0 (y opcional lo persistimos)
    if (esEmpty && vol == null) {
      vol = 0;

      // opcional recomendado: guardar el 0 en BD para que quede limpio
      await conn.query("UPDATE bl_contenedores SET volumen = 0 WHERE id = ?", [c.id]);
    }

    // Validación volumen solo para NO-MM
    if (!esEmpty && (vol == null || vol < 0)) {
      vals.push({
        nivel: "CONTENEDOR",
        ref_id: refId,
        sec: itemNo,
        severidad: "ERROR",
        campo: "volumen",
        mensaje: "Volumen debe ser >= 0 (puede ser 0)",
        valorCrudo: c.volumen
      });
    }

    if (isBlank(c.unidad_volumen)) {
      vals.push({
        nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "unidad_volumen",
        mensaje: "Falta unidad_volumen", valorCrudo: c.unidad_volumen ?? null
      });
    }


    // 🔥 VALIDAR: Si es EMPTY y tiene peso 0, probablemente falta peso_tara
    if (esEmpty && (num(c.peso) === null || num(c.peso) === 0)) {
      vals.push({
        nivel: "CONTENEDOR",
        ref_id: refId,
        sec: itemNo,
        severidad: "ERROR",
        campo: "peso",
        mensaje: `Contenedor ${c.codigo || '(SIN CODIGO)'} tipo '${c.tipo_cnt || 'NULL'}' tiene peso 0. Probablemente falta configurar peso_tara_kg para este tipo de contenedor en el mantenedor.`,
        valorCrudo: c.tipo_cnt || null
      });
    }


    // IMO estricto si item peligroso
    const itemPeligroso = itemObj && String(itemObj.carga_peligrosa || "").toUpperCase() === "S";
    if (itemPeligroso) {
      const [[imoCount]] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM bl_contenedor_imo WHERE contenedor_id = ?",
        [c.id]
      );
      if ((imoCount?.cnt ?? 0) < 1) {
        vals.push({
          nivel: "CONTENEDOR", ref_id: refId, sec: itemNo, severidad: "ERROR", campo: "imo",
          mensaje: "Item marcado como carga_peligrosa='S' - este contenedor debe tener datos IMO (clase_imo y numero_imo) Linea 56",
          valorCrudo: JSON.stringify({ codigo: c.codigo || null })
        });
      }
    }

    // Sellos OBS si no tiene
    const [[sellosCount]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM bl_contenedor_sellos WHERE contenedor_id = ?",
      [c.id]
    );
    if ((sellosCount?.cnt ?? 0) < 1) {
      vals.push({
        nivel: "CONTENEDOR",
        ref_id: refId,
        sec: itemNo,
        severidad: "OBS",
        campo: "sellos",
        mensaje: `Contenedor ${c.codigo || '(SIN CODIGO)'} sin sellos en PMS (no siempre aplica)`,
        valorCrudo: c.codigo || null
      });
    }
  }

  // ---- TRANSBORDOS (OBS si puerto no existe; y si existe puedes actualizar FK)
  for (const tb of transbordos) {
    const [puertoRows] = await conn.query(
      "SELECT id FROM puertos WHERE codigo = ? LIMIT 1",
      [tb.puerto_cod]
    );

    if (puertoRows.length === 0) {
      vals.push({
        nivel: "TRANSBORDO", ref_id: tb.id ?? null, sec: tb.sec, severidad: "OBS", campo: "puerto_id",
        mensaje: "Puerto de transbordo no existe en mantenedor (no afecta XML) (Linea 14)",
        valorCrudo: tb.puerto_cod
      });
    } else if (tb.puerto_id !== puertoRows[0].id) {
      await conn.query("UPDATE bl_transbordos SET puerto_id = ? WHERE id = ?", [puertoRows[0].id, tb.id]);
    }
  }

  // ==========================================================
  // C) Insertar bl_validaciones (solo estado vivo)
  // ==========================================================
  for (const v of vals) {
    await addValidacion(conn, {
      blId,
      nivel: v.nivel,
      refId: v.ref_id ?? null,
      sec: v.sec ?? null,
      severidad: v.severidad,
      campo: v.campo,
      mensaje: v.mensaje,
      valorCrudo: v.valorCrudo ?? v.valor_crudo ?? null
    });
  }

  await refreshResumenValidacionBL(conn, blId);
}

// PUT /api/bls/:blNumber - Actualizar BL completo
app.put("/api/bls/:blNumber", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { blNumber } = req.params;
    const updates = req.body;

    console.log('═════════════════════════════════════════');
    console.log('📥 PUT recibido para BL:', blNumber);
    console.log('📦 SHIPPER_ID recibido:', updates.shipper_id);
    console.log('📦 CONSIGNEE_ID recibido:', updates.consignee_id);
    console.log('📦 NOTIFY_ID recibido:', updates.notify_id);
    console.log('📦 Body COMPLETO:', JSON.stringify(updates, null, 2));
    console.log('═════════════════════════════════════════');

    await connection.beginTransaction();

    // 1️⃣ Verificar que el BL existe
    const [blRows] = await connection.query(
      'SELECT id FROM bls WHERE bl_number = ?',
      [blNumber]
    );

    if (blRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'BL no encontrado' });
    }

    const blId = blRows[0].id;

    // 2️⃣ Preparar campos para UPDATE
    const setClauses = [];
    const values = [];

    // 🔥 MAPEO DE TIPO_SERVICIO → TIPO_SERVICIO_ID (AGREGAR ESTO PRIMERO)
    if (updates.tipo_servicio) {
      const tipoServicioMap = {
        'FF': 1,  // FCL/FCL
        'MM': 2   // EMPTY
      };
      const tipoServicioId = tipoServicioMap[updates.tipo_servicio];

      if (tipoServicioId) {
        setClauses.push('tipo_servicio_id = ?');
        values.push(tipoServicioId);
        console.log(`🔄 Tipo servicio: ${updates.tipo_servicio} → ID: ${tipoServicioId}`);
      }

      // Remover tipo_servicio de updates para que no se procese después
      delete updates.tipo_servicio;
    }

    // 🔥 CAMPOS PERMITIDOS (SIN tipo_servicio porque ya lo mapeamos arriba)
    const validFields = [
      'shipper',
      'consignee',
      'notify_party',
      'shipper_id',
      'consignee_id',
      'notify_id',
      'embarcador_id',
      'descripcion_carga',
      'bultos',
      'peso_bruto',
      'unidad_peso',
      'volumen',
      'unidad_volumen',
      'status',
      'fecha_emision',
      'fecha_presentacion',
      'fecha_zarpe',
      'fecha_embarque',
      'cond_transporte',
      'forma_pago_flete',
      'observaciones'
    ];

    // 🔥 MAPEO DE CÓDIGOS → IDs
    const puertoFields = [
      'lugar_recepcion_cod',
      'puerto_embarque_cod',
      'puerto_descarga_cod',
      'lugar_entrega_cod',
      'lugar_destino_cod',
      'lugar_emision_cod',
      'lugar_recepcion',
      'puerto_embarque',
      'puerto_descarga',
      'lugar_entrega',
      'lugar_destino',
      'lugar_emision'
    ];

    for (const field of Object.keys(updates)) {
      const value = updates[field];

      // 🔥 Si es un campo de puerto, resolver ID
      if (puertoFields.includes(field)) {
        const codigo = value;

        const baseField = field.replace('_cod', '');
        const codField = baseField + '_cod';
        const idField = baseField + '_id';

        if (!codigo) {
          setClauses.push(`${codField} = NULL`, `${idField} = NULL`);
          continue;
        }

        const [puertoRows] = await connection.query(
          'SELECT id FROM puertos WHERE codigo = ?',
          [codigo]
        );

        const puertoId = puertoRows.length > 0 ? puertoRows[0].id : null;

        setClauses.push(`${codField} = ?`, `${idField} = ?`);
        values.push(codigo, puertoId);

        console.log(`🔄 Puerto ${field}: ${codigo} → ID: ${puertoId}`);
      }
      // 🔥 PROCESAMIENTO ESPECIAL PARA OBSERVACIONES
      else if (field === 'observaciones') {
        if (Array.isArray(value)) {
          setClauses.push(`${field} = ?`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${field} = ?`);
          values.push(value);
        }
      }
      // 🔥 Otros campos permitidos
      else if (validFields.includes(field)) {
        setClauses.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // 3️⃣ Agregar updated_at
    setClauses.push('updated_at = NOW()');
    values.push(blNumber);

    // 4️⃣ Ejecutar UPDATE
    const query = `
      UPDATE bls 
      SET ${setClauses.join(', ')}
      WHERE bl_number = ?
    `;

    console.log('📝 Query:', query);
    console.log('📝 Values:', values);

    const [result] = await connection.query(query, values);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'BL no encontrado' });
    }

    await connection.commit();

    console.log(`✅ BL ${blNumber} actualizado - ${result.affectedRows} fila(s)`);

    res.json({
      success: true,
      message: 'BL actualizado exitosamente',
      bl_number: blNumber
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar BL:', error);
    res.status(500).json({
      error: 'Error al actualizar BL',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// GET /api/bls/:blNumber - Obtener datos de un BL específico
app.get("/api/bls/:blNumber", async (req, res) => {
  const { blNumber } = req.params;

  try {
    const [blRows] = await pool.query(`
      SELECT 
        b.*,
        shipper_p.nombre AS shipper_nombre,
        consignee_p.nombre AS consignee_nombre,
        notify_p.nombre AS notify_nombre,
        embarcador_p.nombre AS embarcador_nombre
      FROM bls b
      LEFT JOIN participantes shipper_p ON b.shipper_id = shipper_p.id
      LEFT JOIN participantes consignee_p ON b.consignee_id = consignee_p.id
      LEFT JOIN participantes notify_p ON b.notify_id = notify_p.id
      LEFT JOIN participantes embarcador_p ON b.embarcador_id = embarcador_p.id
      WHERE b.bl_number = ?
      LIMIT 1
    `, [blNumber]);

    if (blRows.length === 0) {
      return res.status(404).json({ error: "BL no encontrado" });
    }

    res.json(blRows[0]);

  } catch (error) {
    console.error("Error obteniendo BL:", error);
    res.status(500).json({
      error: "Error al obtener BL",
      details: error.message
    });
  }
});

app.post("/api/bls/:blNumber/revalidar", async (req, res) => {
  const { blNumber } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [blRows] = await conn.query(
      "SELECT id FROM bls WHERE bl_number = ? LIMIT 1",
      [blNumber]
    );

    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "BL no encontrado" });
    }

    const blId = blRows[0].id;

    await revalidarBLCompleto(conn, blId);

    await conn.commit();
    res.json({ success: true, message: "Revalidación completa ejecutada" });
  } catch (error) {
    await conn.rollback();
    console.error("Error al revalidar BL:", error);
    res.status(500).json({ error: "Error al revalidar BL", details: error.message });
  } finally {
    conn.release();
  }
});

// PUT /bls/:blNumber/contenedores
app.put('/bls/:blNumber/contenedores', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { blNumber } = req.params;
    const { contenedores } = req.body;

    console.log('=== DEBUG CONTENEDORES ===');
    console.log('BL Number:', blNumber);
    console.log('Total contenedores:', contenedores.length);

    await conn.beginTransaction();

    // 1. Obtener bl_id desde el bl_number
    const [blRows] = await conn.query('SELECT id FROM bls WHERE bl_number = ?', [blNumber]);
    if (blRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'BL no encontrado' });
    }
    const bl_id = blRows[0].id;

    // 2. Para cada contenedor
    for (const cont of contenedores) {
      let contenedorId = cont.id;

      // 🆕 Si es un contenedor nuevo, insertarlo primero
      if (cont._isNew && typeof cont.id === 'string' && cont.id.startsWith('new_')) {
        console.log('🆕 Insertando contenedor nuevo:', cont.codigo, 'Item ID:', cont.item_id);

        // 🔥 VALIDAR DATOS ANTES DE INSERTAR
        if (!cont.codigo || cont.codigo.length !== 11) {
          await conn.rollback();
          return res.status(400).json({ error: `Código de contenedor inválido: ${cont.codigo}` });
        }

        if (!cont.tipo_cnt) {
          await conn.rollback();
          return res.status(400).json({ error: `Tipo de contenedor requerido para ${cont.codigo}` });
        }

        if (!cont.item_id) {
          await conn.rollback();
          return res.status(400).json({ error: `Item ID requerido para contenedor ${cont.codigo}` });
        }

        const [result] = await conn.query(
          `INSERT INTO bl_contenedores (bl_id, item_id, codigo, tipo_cnt) VALUES (?, ?, ?, ?)`,
          [bl_id, cont.item_id, cont.codigo, cont.tipo_cnt]
        );
        contenedorId = result.insertId;

        console.log('✅ Contenedor insertado con ID:', contenedorId);

      } else {
        // 🔥 ACTUALIZAR CONTENEDOR EXISTENTE - SOLO CAMPOS EDITABLES
        console.log('📝 Actualizando contenedor existente:', cont.codigo, 'ID:', contenedorId);

        // 🔥 VALIDAR CÓDIGO
        if (!cont.codigo || cont.codigo.length !== 11) {
          await conn.rollback();
          return res.status(400).json({ error: `Código de contenedor inválido: ${cont.codigo}` });
        }

        // 🔥 SOLO ACTUALIZAR CÓDIGO Y TIPO (campos editables)
        await conn.query(
          'UPDATE bl_contenedores SET codigo = ?, tipo_cnt = ? WHERE id = ?',
          [cont.codigo, cont.tipo_cnt, contenedorId]
        );

        // 🔥 NO TOCAR peso, volumen, unidades - esos campos NO son editables en contenedores
      }

      // 3. Eliminar sellos actuales y reinsertar
      await conn.query('DELETE FROM bl_contenedor_sellos WHERE contenedor_id = ?', [contenedorId]);
      if (cont.sellos && cont.sellos.length > 0) {
        console.log(`📌 Insertando ${cont.sellos.length} sellos para contenedor ${contenedorId}`);
        for (const sello of cont.sellos) {
          if (sello && sello.trim().length > 0) {
            await conn.query(
              'INSERT INTO bl_contenedor_sellos (contenedor_id, sello) VALUES (?, ?)',
              [contenedorId, sello.trim()]
            );
          }
        }
      }

      // 4. Eliminar IMOs actuales y reinsertar
      await conn.query('DELETE FROM bl_contenedor_imo WHERE contenedor_id = ?', [contenedorId]);
      if (cont.imos && cont.imos.length > 0) {
        console.log(`⚠️ Insertando ${cont.imos.length} IMOs para contenedor ${contenedorId}`);
        for (const imo of cont.imos) {
          if (imo.clase && imo.numero) {
            await conn.query(
              'INSERT INTO bl_contenedor_imo (contenedor_id, clase_imo, numero_imo) VALUES (?, ?, ?)',
              [contenedorId, imo.clase.trim(), imo.numero.trim()]
            );
          }
        }
      }
    }

    await conn.commit();
    console.log('✅ Todos los contenedores actualizados correctamente');
    res.json({ success: true, message: 'Contenedores actualizados correctamente' });

  } catch (error) {
    await conn.rollback();
    console.error('❌ Error al actualizar contenedores:', error);
    res.status(500).json({ error: 'Error al actualizar contenedores: ' + error.message });
  } finally {
    conn.release();
  }
});

// ============================================
// ENDPOINTS PARA EDICIÓN MASIVA DE BLs
// ============================================

// Obtener BLs por viaje/manifesto
app.get('/bls/by-viaje/:viaje', async (req, res) => {
  try {
    const { viaje } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM bls WHERE viaje = ? ORDER BY bl_number',
      [viaje]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener BLs por viaje:', error);
    res.status(500).json({ error: 'Error al obtener BLs' });
  }
});

// Obtener lista de viajes únicos
app.get('/bls/viajes/list', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT viaje FROM bls WHERE viaje IS NOT NULL ORDER BY viaje'
    );
    res.json(rows.map(row => row.viaje));
  } catch (error) {
    console.error('Error al obtener viajes:', error);
    res.status(500).json({ error: 'Error al obtener viajes' });
  }
});


/// ============================================
// ENDPOINT PARA OBTENER PUERTOS
// ============================================
app.get('/mantenedores/puertos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, codigo, nombre, pais FROM puertos ORDER BY nombre'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener puertos:', error);
    res.status(500).json({ error: 'Error al obtener puertos' });
  }
});

// POST /manifiestos/:id/carga-suelta
app.post("/manifiestos/:id/carga-suelta", async (req, res) => {
  const { id: manifiestoId } = req.params;
  const {
    bl_number,
    tipo_servicio,
    forma_pago_flete,
    cond_transporte,
    fecha_emision,
    fecha_presentacion,
    fecha_embarque,
    fecha_zarpe,

    puerto_embarque,
    puerto_descarga,
    lugar_destino,
    lugar_emision,
    lugar_entrega,
    lugar_recepcion,

    // 🔥 IDs de participantes
    shipper_id,
    consignee_id,
    notify_id,
    almacenador_id,    // ✅ YA ESTÁ EN EL DESTRUCTURING

    // Backward compatibility: si viene texto, lo guardamos también
    shipper,
    consignee,
    notify_party,
    almacenador,

    items,
    observaciones
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validaciones previas (mantener las que ya tienes)
    if (tipo_servicio !== 'BB') {
      throw new Error('El tipo de servicio debe ser BB (Break Bulk) para carga suelta');
    }

    const [manifiestos] = await connection.query(
      'SELECT id, viaje FROM manifiestos WHERE id = ?',
      [manifiestoId]
    );
    if (manifiestos.length === 0) {
      throw new Error('Manifiesto no encontrado');
    }

    const [blsExistentes] = await connection.query(
      'SELECT id FROM bls WHERE bl_number = ?',
      [bl_number]
    );
    if (blsExistentes.length > 0) {
      throw new Error(`El BL ${bl_number} ya existe en el sistema`);
    }

    // Validar campos obligatorios
    const camposObligatorios = [
      { campo: bl_number, nombre: 'N° de BL' },
      { campo: shipper_id, nombre: 'Shipper' },
      { campo: consignee_id, nombre: 'Consignee' },
      { campo: puerto_embarque, nombre: 'Puerto de Embarque' },
      { campo: puerto_descarga, nombre: 'Puerto de Descarga' },
      { campo: lugar_destino, nombre: 'Lugar de Destino' },
      { campo: lugar_emision, nombre: 'Lugar de Emisión' },
      { campo: lugar_entrega, nombre: 'Lugar de Entrega' },
      { campo: lugar_recepcion, nombre: 'Lugar de Recepción' },
      { campo: fecha_presentacion, nombre: 'Fecha de Presentación' }
    ];

    for (const { campo, nombre } of camposObligatorios) {
      if (!campo || (typeof campo === 'string' && campo.trim() === '')) {
        throw new Error(`El campo ${nombre} es obligatorio`);
      }
    }

    if (!items || items.length === 0) {
      throw new Error('Debe haber al menos 1 item de carga');
    }

    for (const item of items) {
      if (!item.descripcion || item.descripcion.trim() === '') {
        throw new Error(`El item #${item.numero_item} debe tener descripción`);
      }
      if (!item.tipo_bulto || item.tipo_bulto.trim() === '') {
        throw new Error(`El item #${item.numero_item} debe tener tipo de bulto`);
      }
      if (!item.peso_bruto || parseFloat(item.peso_bruto) <= 0) {
        throw new Error(`El item #${item.numero_item} debe tener peso bruto mayor a 0`);
      }
      if (!item.cantidad || parseInt(item.cantidad) <= 0) {
        throw new Error(`El item #${item.numero_item} debe tener cantidad mayor a 0`);
      }
    }

    // Obtener tipo_servicio_id
    const [tiposServicio] = await connection.query(
      'SELECT id FROM tipos_servicio WHERE codigo = ?',
      ['BB']
    );
    if (tiposServicio.length === 0) {
      throw new Error('Tipo de servicio BB no encontrado.');
    }
    const tipo_servicio_id = tiposServicio[0].id;

    // Función auxiliar para obtener puerto
    const obtenerPuerto = async (codigo, nombreCampo) => {
      if (!codigo || codigo.trim() === '') {
        throw new Error(`El campo ${nombreCampo} es obligatorio`);
      }

      const codigoUpper = codigo.toUpperCase().trim();

      const [rows] = await connection.query(
        'SELECT id, codigo FROM puertos WHERE codigo = ?',
        [codigoUpper]
      );

      if (rows.length === 0) {
        throw new Error(`El puerto '${codigoUpper}' (${nombreCampo}) no existe en el mantenedor`);
      }

      return rows[0];
    };

    const puertoEmbarque = await obtenerPuerto(puerto_embarque, 'Puerto de Embarque');
    const puertoDescarga = await obtenerPuerto(puerto_descarga, 'Puerto de Descarga');
    const lugarDestino = await obtenerPuerto(lugar_destino, 'Lugar de Destino');
    const lugarEmision = await obtenerPuerto(lugar_emision, 'Lugar de Emisión');
    const lugarEntrega = await obtenerPuerto(lugar_entrega, 'Lugar de Entrega');
    const lugarRecepcion = await obtenerPuerto(lugar_recepcion, 'Lugar de Recepción');

    // 🔥 OBTENER NOMBRES DE PARTICIPANTES DESDE BD (para backward compatibility)
    let shipperNombre = shipper || null;
    let consigneeNombre = consignee || null;
    let notifyNombre = notify_party || null;
    let almacenadorNombre = almacenador || null;  // ✅ DECLARAR AQUÍ

    if (shipper_id && !shipperNombre) {
      const [rows] = await connection.query(
        'SELECT nombre FROM participantes WHERE id = ?',
        [shipper_id]
      );
      shipperNombre = rows.length > 0 ? rows[0].nombre : null;
    }

    if (consignee_id && !consigneeNombre) {
      const [rows] = await connection.query(
        'SELECT nombre FROM participantes WHERE id = ?',
        [consignee_id]
      );
      consigneeNombre = rows.length > 0 ? rows[0].nombre : null;
    }

    if (notify_id && !notifyNombre) {
      const [rows] = await connection.query(
        'SELECT nombre FROM participantes WHERE id = ?',
        [notify_id]
      );
      notifyNombre = rows.length > 0 ? rows[0].nombre : null;
    }

    // ✅ AHORA SÍ USAR almacenadorNombre
    if (almacenador_id && !almacenadorNombre) {
      const [rows] = await connection.query(
        'SELECT nombre FROM participantes WHERE id = ?',
        [almacenador_id]
      );
      almacenadorNombre = rows.length > 0 ? rows[0].nombre : null;
    }

    // Calcular totales
    const peso_bruto_total = items.reduce((sum, item) =>
      sum + parseFloat(item.peso_bruto || 0), 0
    );

    const volumen_total = items.reduce((sum, item) =>
      sum + parseFloat(item.volumen || 0), 0
    );

    const bultos_total = items.reduce((sum, item) =>
      sum + parseInt(item.cantidad || 0), 0
    );

    // 🔥 INSERTAR BL CON IDs DE PARTICIPANTES
    const [blResult] = await connection.query(
      `INSERT INTO bls (
    manifiesto_id, bl_number, tipo_servicio_id, forma_pago_flete, cond_transporte,
    shipper_id, consignee_id, notify_id, almacenador_id,
    shipper, consignee, notify_party, almacenador,
    fecha_emision, fecha_presentacion, fecha_embarque, fecha_zarpe,
    puerto_embarque_id, puerto_embarque_cod,
    puerto_descarga_id, puerto_descarga_cod,
    lugar_destino_id, lugar_destino_cod,
    lugar_emision_id, lugar_emision_cod,
    lugar_entrega_id, lugar_entrega_cod,
    lugar_recepcion_id, lugar_recepcion_cod,
    peso_bruto, unidad_peso, volumen, unidad_volumen, bultos, total_items,
    observaciones, status, valid_status
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?
  )`,
      [
        manifiestoId, bl_number, tipo_servicio_id,
        forma_pago_flete || 'PREPAID', cond_transporte || 'HH',
        shipper_id || null, consignee_id || null, notify_id || null, almacenador_id || null,
        shipperNombre, consigneeNombre, notifyNombre, almacenadorNombre,
        fecha_emision || null, fecha_presentacion || null,
        fecha_embarque || null, fecha_zarpe || null,
        puertoEmbarque.id, puertoEmbarque.codigo,
        puertoDescarga.id, puertoDescarga.codigo,
        lugarDestino.id, lugarDestino.codigo,
        lugarEmision.id, lugarEmision.codigo,
        lugarEntrega.id, lugarEntrega.codigo,
        lugarRecepcion.id, lugarRecepcion.codigo,
        peso_bruto_total, 'KGM', volumen_total, 'MTQ', bultos_total, items.length,
        observaciones && observaciones.length > 0 ? JSON.stringify(observaciones) : null,
        'CREADO', 'OK'
      ]
    );

    const bl_id = blResult.insertId;

    // Insertar items (sin cambios)
    for (const item of items) {
      await connection.query(
        `INSERT INTO bl_items (
          bl_id, numero_item, descripcion, marcas, carga_peligrosa,
          tipo_bulto, cantidad, peso_bruto, unidad_peso, volumen, unidad_volumen,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          bl_id,
          item.numero_item,
          item.descripcion,
          item.marcas || 'N/M',
          item.carga_peligrosa || 'N',
          item.tipo_bulto,
          item.cantidad,
          item.peso_bruto,
          item.unidad_peso || 'KGM',
          item.volumen || 0,
          item.unidad_volumen || 'MTQ'
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Carga suelta creada exitosamente',
      bl_id,
      bl_number,
      tipo_servicio: 'BB',
      manifiesto: manifiestos[0].viaje,
      total_items: items.length,
      peso_bruto: peso_bruto_total,
      volumen: volumen_total,
      bultos: bultos_total
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al crear carga suelta:', error);

    res.status(400).json({
      success: false,
      error: error.message || 'Error al crear la carga suelta'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ENDPOINT: GET /bls/:id/validar-tipo
// Validar que un BL sea del tipo correcto
// ============================================

app.get("/bls/:id/validar-tipo", async (req, res) => {
  const { id: bl_id } = req.params;

  try {
    const connection = await pool.getConnection();

    const [bls] = await connection.query(
      `SELECT 
        b.id,
        b.bl_number,
        ts.codigo as tipo_servicio,
        ts.nombre as tipo_servicio_nombre,
        COUNT(c.id) as total_contenedores,
        b.total_items,
        b.peso_bruto,
        b.bultos
      FROM bls b
      JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
      LEFT JOIN bl_contenedores c ON b.id = c.bl_id
      WHERE b.id = ?
      GROUP BY b.id`,
      [bl_id]
    );

    connection.release();

    if (bls.length === 0) {
      return res.status(404).json({ error: 'BL no encontrado' });
    }

    const bl = bls[0];
    const errores = [];

    // Validar según tipo de servicio
    if (bl.tipo_servicio === 'BB') {
      // Carga suelta NO debe tener contenedores
      if (bl.total_contenedores > 0) {
        errores.push(`Un BL de carga suelta (BB) no puede tener contenedores (encontrados: ${bl.total_contenedores})`);
      }

      // Debe tener items
      if (bl.total_items === 0) {
        errores.push('Un BL de carga suelta debe tener al menos 1 item');
      }
    } else if (bl.tipo_servicio === 'FF' || bl.tipo_servicio === 'MM') {
      // Contenedor DEBE tener contenedores
      if (bl.total_contenedores === 0) {
        errores.push(`Un BL de tipo ${bl.tipo_servicio} debe tener al menos 1 contenedor`);
      }
    }

    res.json({
      success: errores.length === 0,
      bl,
      errores,
      es_carga_suelta: bl.tipo_servicio === 'BB'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /tipos-contenedor
app.get('/tipos-contenedor', async (req, res) => {
  try {
    const query = `
            SELECT DISTINCT tipo_cnt 
            FROM bl_contenedores 
            WHERE tipo_cnt IS NOT NULL 
            ORDER BY tipo_cnt
        `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de contenedor:', error);
    res.status(500).json({ error: 'Error al obtener tipos de contenedor' });
  }
});


const port = Number(process.env.PORT || 4000);

(async () => {
  try {
    console.log('Iniciando servidor...');

    // Verificar conexión a base de datos
    console.log('Verificando conexión a base de datos...');
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('Conexión a base de datos exitosa');

    // Cargar tokens PMS
    await loadPms51Tokens();


    // Iniciar servidor
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error iniciando servidor:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();

// Manejo de errores globales
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});