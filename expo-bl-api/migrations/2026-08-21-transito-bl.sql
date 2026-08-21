-- ============================================================================
-- Soporte de sentido-operacion TR (transito) a nivel de BL
-- Oficio Circular 182 de Aduanas, 29-05-2015
-- Fecha: 2026-08-21
-- ============================================================================
--
-- Un manifiesto de importacion puede traer BLs en transito a Argentina,
-- Bolivia o Peru mezclados con BLs de importacion normal. Hasta ahora el
-- sentido salia de manifiestos.tipo_operacion, uniforme para todo el
-- manifiesto, y no habia forma de distinguirlos.
--
--   sentido_operacion    NULL = hereda de manifiestos.tipo_operacion.
--                        'TR' = este BL va en transito.
--   transito_sugerido    La ingesta PMS encontro "SHIPMENT IN TRANSIT" en las
--                        lineas 47. Es solo una sugerencia: el destino no se
--                        puede parsear del PMS, lo elige el operador.
--   transito_confirmado  El operador ya decidio, sea confirmando el transito o
--                        descartandolo. Saca al BL de la bandeja de pendientes.
--
-- Nota: el reproceso del PMS hace DELETE + reinsert de los BLs, asi que
-- sentido_operacion y transito_confirmado se pierden y los transitos deben
-- reconfirmarse. transito_sugerido se recalcula solo, viene del PMS.
-- ============================================================================

ALTER TABLE bls
  ADD COLUMN sentido_operacion   VARCHAR(5) NULL
    COMMENT 'NULL = hereda de manifiestos.tipo_operacion. TR = transito',
  ADD COLUMN transito_sugerido   TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'La ingesta PMS detecto SHIPMENT IN TRANSIT en las lineas 47',
  ADD COLUMN transito_confirmado TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'El operador ya decidio: confirmo el transito o lo descarto';

-- Contador de pendientes del chip en GenerarXML:
-- WHERE manifiesto_id = ? AND transito_sugerido = 1 AND transito_confirmado = 0
CREATE INDEX idx_bls_transito_pendiente
  ON bls (manifiesto_id, transito_sugerido, transito_confirmado);


-- ── DOWN ────────────────────────────────────────────────────────────────────
-- DROP INDEX idx_bls_transito_pendiente ON bls;
-- ALTER TABLE bls
--   DROP COLUMN sentido_operacion,
--   DROP COLUMN transito_sugerido,
--   DROP COLUMN transito_confirmado;
