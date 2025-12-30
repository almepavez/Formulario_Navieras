const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const crearUsuarios = async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    console.log("🔐 Creando usuarios de prueba...\n");

    // Usuario 1: Admin
    const passwordAdmin = "admin123";
    const hashAdmin = await bcrypt.hash(passwordAdmin, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, activo) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ["Administrador", "admin@broomgroup.cl", hashAdmin, "admin", true]
    );
    console.log("✅ Usuario Admin creado");
    console.log("   Email: admin@broomgroup.cl");
    console.log("   Password: admin123\n");

    // Usuario 2: Usuario normal
    const passwordUser = "user123";
    const hashUser = await bcrypt.hash(passwordUser, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, activo) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ["Usuario Demo", "usuario@broomgroup.cl", hashUser, "usuario", true]
    );
    console.log("✅ Usuario Demo creado");
    console.log("   Email: usuario@broomgroup.cl");
    console.log("   Password: user123\n");

    // Usuario 3: Operador
    const passwordOp = "operador123";
    const hashOp = await bcrypt.hash(passwordOp, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, activo) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ["Operador PIL", "operador@broomgroup.cl", hashOp, "usuario", true]
    );
    console.log("✅ Usuario Operador creado");
    console.log("   Email: operador@broomgroup.cl");
    console.log("   Password: operador123\n");

    console.log("🎉 ¡Usuarios creados exitosamente!\n");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
};

crearUsuarios();