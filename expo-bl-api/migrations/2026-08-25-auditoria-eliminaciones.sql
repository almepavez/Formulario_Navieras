-- ============================================================================
-- Auditoria de eliminaciones fisicas de manifiestos y BLs
-- Fecha: 2026-08-25
-- ============================================================================
--
-- Hasta ahora borrar un manifiesto con BLs o un BL individual se hacia a mano
-- por SQL en produccion, sin dejar rastro de quien lo hizo ni de que habia
-- adentro. Esta tabla es el registro de esos borrados, que pasan a hacerse
-- desde la UI y quedan restringidos a rol admin.
--
-- El borrado es FISICO y se apoya en los ON DELETE CASCADE ya existentes:
--
--   manifiestos -> itinerarios
--               -> reportes
--               -> bls -> bl_items
--                      -> bl_transbordos
--                      -> bl_validaciones
--                      -> bl_validaciones_pms
--                      -> bl_contenedores -> bl_contenedor_sellos
--                                         -> bl_contenedor_imo
--
-- La unica excepcion es `reportes` cuando se borra un BL individual: la tabla
-- referencia al manifiesto por FK, pero al BL solo por el string `bl`, sin FK.
-- Un DELETE de un BL dejaria filas huerfanas que ademas bloquean la
-- reinsercion del par (bl, n_contenedor) por el UNIQUE `uk_bl_cnt`, que es
-- global. El endpoint las borra explicitamente, acotadas por manifiesto_id.
--
-- `snapshot` guarda la fila completa de la entidad, los conteos de hijos y —en
-- el caso del manifiesto— el arreglo con todos los bl_number eliminados. Es
-- borrado fisico sin vuelta atras: sin ese arreglo no hay forma de reconstruir
-- que contenia el manifiesto.
--
-- `usuario_id` y `usuario_email` van DESNORMALIZADOS y sin FK a `usuarios` a
-- proposito: el log tiene que sobrevivir aunque despues se elimine el usuario
-- que hizo el borrado.
--
-- ----------------------------------------------------------------------------
-- ANTES DE APLICAR: verificar que el arbol de FKs en produccion coincide con
-- el de arriba. Si alguna FK no esta en CASCADE, el borrado va a fallar o —peor
-- todavia— va a dejar filas huerfanas.
--
--   SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME,
--          k.REFERENCED_TABLE_NAME, r.DELETE_RULE
--     FROM information_schema.KEY_COLUMN_USAGE k
--     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
--       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
--      AND r.CONSTRAINT_NAME   = k.CONSTRAINT_NAME
--    WHERE k.CONSTRAINT_SCHEMA = DATABASE()
--      AND k.REFERENCED_TABLE_NAME IN
--          ('manifiestos','bls','bl_items','bl_contenedores')
--    ORDER BY k.REFERENCED_TABLE_NAME, k.TABLE_NAME;
--
-- Se esperan estas 11 filas, todas con DELETE_RULE = CASCADE salvo la ultima:
--
--   fk_bls_manifiesto          bls                   -> manifiestos      CASCADE
--   itinerarios_ibfk_1         itinerarios           -> manifiestos      CASCADE
--   fk_rd_manifiesto           reportes              -> manifiestos      CASCADE
--   fk_bl_items_bl             bl_items              -> bls              CASCADE
--   fk_cont_bl                 bl_contenedores       -> bls              CASCADE
--   fk_bl_transbordos_bl       bl_transbordos        -> bls              CASCADE
--   fk_bl_validaciones_bl      bl_validaciones       -> bls              CASCADE
--   fk_bl_validaciones_pms_bl  bl_validaciones_pms   -> bls              CASCADE
--   fk_sello_contenedor        bl_contenedor_sellos  -> bl_contenedores  CASCADE
--   fk_imo_contenedor          bl_contenedor_imo     -> bl_contenedores  CASCADE
--   fk_cont_item               bl_contenedores       -> bl_items         SET NULL
-- ============================================================================

CREATE TABLE auditoria_eliminaciones (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo_entidad   ENUM('MANIFIESTO','BL') NOT NULL,
  entidad_id     INT NOT NULL
    COMMENT 'id que tenia el manifiesto o el BL antes del DELETE',
  identificador  VARCHAR(100) NOT NULL
    COMMENT 'numero_manifiesto_aduana (o viaje si venia vacio) / bl_number, para buscar cuando la fila ya no existe',
  snapshot       JSON NOT NULL
    COMMENT 'fila completa de la entidad + conteos de hijos + bl_number de los BLs eliminados',
  usuario_id     INT NULL
    COMMENT 'sin FK a usuarios a proposito: el log sobrevive al usuario',
  usuario_email  VARCHAR(100) NULL,
  motivo         TEXT NULL,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_entidad (tipo_entidad, entidad_id),
  KEY idx_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
