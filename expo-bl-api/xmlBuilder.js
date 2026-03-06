// xmlBuilder.js
// Módulo compartido para construcción de XMLs de BL (EXPO, IMPO, Carga Suelta)

const { create } = require('xmlbuilder2');

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

const cleanRUT = (rut) => {
  if (!rut) return '';
  return rut.replace(/\./g, '').trim();
};

const mapTipoServicio = (codigo) => {
  const mapeo = { 'FF': 'FCL/FCL', 'MM': 'EMPTY', 'BB': 'BB' };
  return mapeo[codigo] || 'FCL/FCL';
};

const formatDateCL = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const formatDateTimeCL = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

// ══════════════════════════════════════════
// DETECTORES DE TIPO
// ══════════════════════════════════════════

const detectarTipo = (bl) => ({
  esCargaSuelta: bl.tipo_servicio_codigo === 'BB',
  esEmpty: bl.tipo_servicio_codigo === 'MM',
  esImpo: bl.tipo_operacion === 'I' || bl.tipo_operacion === 'TR' || bl.tipo_operacion === 'TRB',
  esExpo: bl.tipo_operacion === 'S',
  esTránsito: bl.tipo_operacion === 'TR' || bl.tipo_operacion === 'TRB',
  sinVolumen: !(bl.volumen > 0),
});

// ══════════════════════════════════════════
// PARTICIPACIONES
// ══════════════════════════════════════════

const buildParticipacion = (nombre, participante, includeRUT = true, extraFields = {}, includeContacto = true) => {
  if (!participante || !participante.nombre) return null;

  const p = { nombre };

  if (includeRUT && participante.rut) {
    p['tipo-id'] = participante.tipo_id || 'RUT';
    p['valor-id'] = cleanRUT(participante.rut);
    p['nacion-id'] = participante.nacion_id || participante.pais || 'CL';
  }

  p['nombres'] = participante.nombre;

  if (includeContacto) {
    const tel = participante.telefono?.trim();
    p['telefono'] = (tel && tel !== '.') ? tel : '.';

    if (participante.email?.trim() && participante.email.trim() !== '.') {
      p['correo-electronico'] = participante.email.trim();
    }

    const dir = participante.direccion?.trim();
    p['direccion'] = (dir && dir !== '.') ? dir : '.';
  }

  if (includeRUT && participante.rut && participante.pais) {
    p['codigo-pais'] = participante.pais;
  }

  Object.assign(p, extraFields);
  return p;
};

// Construye el bloque de participaciones según tipo de operación
const buildParticipaciones = (bl, tipo) => {
  const { esCargaSuelta, esImpo } = tipo;
  const lista = [];

  // Datos de referencia (EMI, EMIDO, REP) — vienen del manifiesto
  const emiData = bl.emi_id ? { nombre: bl.emi_nombre, rut: bl.emi_rut, pais: bl.emi_pais || 'CL', tipo_id: bl.emi_tipo_id || 'RUT', nacion_id: bl.emi_nacion_id || 'CL' } : null;
  const emidoData = bl.emido_id ? { nombre: bl.emido_nombre, rut: bl.emido_rut, pais: bl.emido_pais || 'CL', tipo_id: bl.emido_tipo_id || 'RUT', nacion_id: bl.emido_nacion_id || 'CL' } : null;
  const repData = bl.rep_id ? { nombre: bl.rep_nombre, rut: bl.rep_rut, pais: bl.rep_pais || 'CL', tipo_id: bl.rep_tipo_id || 'RUT', nacion_id: bl.rep_nacion_id || 'CL' } : null;

  // Datos de partes (EMB, CONS, NOTI) — vienen del BL
  const shipperData = bl.shipper ? { nombre: bl.shipper, direccion: bl.shipper_direccion || '.', telefono: bl.shipper_telefono || '.', email: bl.shipper_email || null } : null;
  const consigneeData = bl.consignee ? {
    nombre: bl.consignee, direccion: bl.consignee_direccion || '.', telefono: bl.consignee_telefono || '.', email: bl.consignee_email || null,
    rut: bl.consignee_rut || null, nacion_id: bl.consignee_nacion_id || 'CL'
  } : null;
  const notifyData = bl.notify_party ? {
    nombre: bl.notify_party, direccion: bl.notify_direccion || '.', telefono: bl.notify_telefono || '.', email: bl.notify_email || null,
    rut: bl.notify_rut || null, nacion_id: bl.notify_nacion_id || 'CL'
  } : null;

  // Almacenador — existe en bls para IMPO y carga suelta
  const almData = bl.almacenador_id ? {
    nombre: bl.almacenador_nombre,
    rut: bl.almacenador_rut,
    pais: bl.almacenador_pais || 'CL',
    tipo_id: 'RUT',
    nacion_id: 'CL'
  } : null;

  if (esCargaSuelta) {
    // ── CARGA SUELTA (BB) ──────────────────────────────
    // EMI → ALM → REP → EMIDO → EMB → CONS → NOTI
    if (emiData) lista.push(buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais }, false));
    if (almData) lista.push(buildParticipacion('ALM', almData, true, { 'codigo-almacen': bl.almacenador_codigo_almacen || '' }, false));
    if (repData) lista.push(buildParticipacion('REP', repData, true, {}, false));
    if (emidoData) lista.push(buildParticipacion('EMIDO', emidoData, true, {}, false));
    if (shipperData) lista.push(buildParticipacion('EMB', shipperData, false));
    if (consigneeData) lista.push(buildParticipacion('CONS', consigneeData, !!consigneeData.rut));
    if (notifyData) lista.push(buildParticipacion('NOTI', notifyData, false));

  } else if (esImpo) {
    // ── IMPO (FF/MM con sentido I, TR, TRB) ───────────
    // EMI → ALM → REP → EMIDO → EMB → CONS(con RUT) → NOTI(con RUT)
    if (emiData) lista.push(buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais }, false));
    if (almData) lista.push(buildParticipacion('ALM', almData, true, { 'codigo-almacen': bl.almacenador_codigo_almacen || '' }, false));
    if (repData) lista.push(buildParticipacion('REP', repData, true, {}, false));
    if (emidoData) lista.push(buildParticipacion('EMIDO', emidoData, true, {}, false));
    if (shipperData) lista.push(buildParticipacion('EMB', shipperData, false));
    // CONS y NOTI en IMPO llevan RUT + nacion-id
    if (consigneeData) lista.push(buildParticipacion('CONS', consigneeData, !!consigneeData.rut));
    if (notifyData) lista.push(buildParticipacion('NOTI', notifyData, !!notifyData.rut));

  } else {
    // ── EXPO (sentido S) ───────────────────────────────
    // EMI → CONS(sin RUT) → EMIDO → NOTI(sin RUT) → REP → EMB
    if (emiData) lista.push(buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais }, false));
    if (consigneeData) lista.push(buildParticipacion('CONS', consigneeData, false));
    if (emidoData) lista.push(buildParticipacion('EMIDO', emidoData, true, {}, false));
    if (notifyData) lista.push(buildParticipacion('NOTI', notifyData, false));
    if (repData) lista.push(buildParticipacion('REP', repData, true, {}, false));
    if (shipperData) lista.push(buildParticipacion('EMB', shipperData, false));
  }

  return lista.filter(Boolean);
};

// ══════════════════════════════════════════
// CONTENEDORES
// ══════════════════════════════════════════

const buildContenedor = (c, repData, tipoServicioCodigo, esImpo) => {
  // Parsear IMOs
  let imoList = [];
  if (c.imo_data) {
    imoList = c.imo_data.split('|')
      .map(entry => { const [clase, numero] = entry.split(':'); return { clase, numero }; })
      .filter(x => x.clase && x.numero);
  }

  // Contenedor SOC: no tiene sigla/numero/digito/valor-id-op
  if (c.es_soc) {
    return {
      'tipo-cnt': c.tipo_cnt || '',
      'cnt-so': c.cnt_so_numero || '',
      peso: c.peso || 0,
      'nombre-operador': 'SHIPPER OWNER',
      status: mapTipoServicio(tipoServicioCodigo),
      ...(imoList.length > 0 && {
        CntIMO: {
          cntimo: imoList.length === 1
            ? { 'clase-imo': String(imoList[0].clase), 'numero-imo': String(imoList[0].numero) }
            : imoList.map(i => ({ 'clase-imo': String(i.clase), 'numero-imo': String(i.numero) }))
        }
      }),
      Sellos: c.sellos ? { sello: c.sellos.split('|').map(s => ({ numero: s })) } : undefined
    };
  }

  // Contenedor normal
  const cnt = {
    sigla: c.sigla || '',
    numero: c.numero || '',
    digito: c.digito || '',
    'tipo-cnt': c.tipo_cnt || '',
    // cnt-so: vacío en EXPO, no existe en IMPO normal
    ...(!esImpo && { 'cnt-so': '' }),
    peso: c.peso || 0,
    'valor-id-op': repData?.rut ? cleanRUT(repData.rut) : '',
    'nombre-operador': repData?.nombre || '',
    status: mapTipoServicio(tipoServicioCodigo),
    ...(imoList.length > 0 && {
      CntIMO: {
        cntimo: imoList.length === 1
          ? { 'clase-imo': String(imoList[0].clase), 'numero-imo': String(imoList[0].numero) }
          : imoList.map(i => ({ 'clase-imo': String(i.clase), 'numero-imo': String(i.numero) }))
      }
    }),
    Sellos: c.sellos ? { sello: c.sellos.split('|').map(s => ({ numero: s })) } : undefined
  };

  return cnt;
};

// ══════════════════════════════════════════
// ITEMS
// ══════════════════════════════════════════

const buildItem = (it, contenedores, repData, tipo, bl) => {
  const { esCargaSuelta, esImpo } = tipo;
  const contsDelItem = contenedores.filter(c => c.item_id === it.id);
  const itemSinVolumen = !(parseFloat(it.volumen) > 0);
  const esPeligroso = String(it.carga_peligrosa || '').toUpperCase() === 'S';
  console.log('itemSinVolumen:', itemSinVolumen, 'volumen:', it.volumen, 'esImpo:', esImpo); // ← AGREGAR

  // IMOs del ítem (union de todos sus contenedores) — necesario en IMPO
  let itemImoList = [];
  if (esImpo && esPeligroso) {
    const imoSet = new Map();
    contsDelItem.forEach(c => {
      if (c.imo_data) {
        c.imo_data.split('|').forEach(entry => {
          const [clase, numero] = entry.split(':');
          if (clase && numero) imoSet.set(`${clase}:${numero}`, { clase, numero });
        });
      }
    });
    itemImoList = Array.from(imoSet.values());
  }

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
      volumen: itemSinVolumen ? undefined : parseFloat(it.volumen || 0).toFixed(2),
      'unidad-volumen': itemSinVolumen ? undefined : (it.unidad_volumen || 'MTQ'),
      'carga-cnt': 'N'
    };
  }
  console.log('volumen final:', itemSinVolumen ? 'undefined' : parseFloat(it.volumen || 0).toFixed(2));

  return {
    'numero-item': it.numero_item,
    marcas: it.marcas || '',
    'carga-peligrosa': it.carga_peligrosa || 'N',
    'tipo-bulto': it.tipo_bulto || '',
    descripcion: it.descripcion || '',
    cantidad: it.cantidad || 0,
    'peso-bruto': it.peso_bruto || 0,
    'unidad-peso': it.unidad_peso || 'KGM',
    volumen: itemSinVolumen ? undefined : parseFloat(it.volumen || 0).toFixed(2),
    'unidad-volumen': itemSinVolumen ? undefined : (it.unidad_volumen || 'MTQ'),

    // carga-cnt: vacío en EXPO, no existe en IMPO
    ...(!esImpo && { 'carga-cnt': {} }),

    // ItemsIMO: solo en IMPO con carga peligrosa
    ...(esImpo && esPeligroso && itemImoList.length > 0 && {
      ItemsIMO: {
        itemimo: itemImoList.length === 1
          ? { 'clase-imo': String(itemImoList[0].clase), 'numero-imo': String(itemImoList[0].numero) }
          : itemImoList.map(i => ({ 'clase-imo': String(i.clase), 'numero-imo': String(i.numero) }))
      }
    }),

    Contenedores: contsDelItem.length > 0 ? {
      contenedor: contsDelItem.map(c => buildContenedor(c, repData, bl.tipo_servicio_codigo, esImpo))
    } : undefined
  };
};

// ══════════════════════════════════════════
// REFERENCIAS
// ══════════════════════════════════════════

const generarReferencias = (bl) => {
  if (!bl.ref_doc_id) return undefined;
  return {
    referencia: {
      'tipo-referencia': 'REF',
      'tipo-documento': 'MFTO',
      numero: bl.numero_referencia || bl.ref_doc_codigo || '',
      fecha: formatDateCL(bl.fecha_referencia || bl.manifiesto_fecha_zarpe),
      'tipo-id-emisor': bl.ref_doc_tipo_id || 'RUT',
      'nac-id-emisor': bl.ref_doc_nacion_id || 'CL',
      'valor-id-emisor': cleanRUT(bl.ref_doc_rut),
      emisor: bl.ref_doc_nombre || ''
    }
  };
};

// ══════════════════════════════════════════
// OBSERVACIONES
// ══════════════════════════════════════════

const generarObservaciones = (bl, transbordos, tipo) => {
  const { esCargaSuelta, esImpo } = tipo;
  const obs = [];

  if (esCargaSuelta) {
    // Carga suelta: observaciones libres guardadas en bl.observaciones
    if (bl.observaciones) {
      const raw = typeof bl.observaciones === 'string'
        ? (() => { try { return JSON.parse(bl.observaciones); } catch { return null; } })()
        : bl.observaciones;

      if (Array.isArray(raw)) {
        raw.forEach(o => obs.push({ nombre: o.nombre || 'GRAL', contenido: o.contenido || '' }));
      } else {
        obs.push({ nombre: 'GRAL', contenido: bl.observaciones });
        obs.push({ nombre: 'MOT', contenido: 'LISTA DE ENCARGO' });
      }
    }
  } else if (esImpo) {
    // IMPO: observaciones automáticas según reglas
    // 14: SIN TRB si no hay transbordos
    if (!transbordos || transbordos.length === 0) {
      obs.push({ nombre: '14', contenido: 'SIN TRB' });
    }
    // País destino si es tránsito (LD distinto al puerto de descarga)
    if (bl.lugar_destino_codigo && bl.lugar_destino_codigo !== bl.puerto_descarga_codigo) {
      // Extraer país del código (primeras 2 letras)
      const pais = bl.lugar_destino_codigo.substring(0, 2);
      if (pais && pais !== 'CL') {
        obs.push({ nombre: '12', contenido: pais === 'AR' ? 'ARGENTINA' : pais });
      }
    }
    // Observaciones manuales adicionales guardadas en bl.observaciones
    if (bl.observaciones) {
      const raw = typeof bl.observaciones === 'string'
        ? (() => { try { return JSON.parse(bl.observaciones); } catch { return null; } })()
        : bl.observaciones;
      if (Array.isArray(raw)) {
        raw.forEach(o => obs.push({ nombre: o.nombre || 'GRAL', contenido: o.contenido || '' }));
      }
    }
  }

  return obs.length > 0 ? { observacion: obs } : undefined;
};

// ══════════════════════════════════════════
// BUILDER PRINCIPAL
// ══════════════════════════════════════════

const buildXML = (bl, items, contenedores, transbordos, tipoAccion = 'I') => {
  const tipo = detectarTipo(bl);
  const { esCargaSuelta, esEmpty, sinVolumen, esImpo } = tipo;

  const participaciones = buildParticipaciones(bl, tipo);

  const repData = bl.rep_id ? {
    nombre: bl.rep_nombre, rut: bl.rep_rut
  } : null;

  const observaciones = generarObservaciones(bl, transbordos, tipo);

  const xmlObj = {
    Documento: {
      '@tipo': 'BL',
      '@version': '1.0',

      'tipo-accion': tipoAccion,
      'numero-referencia': bl.bl_number,
         // fecha-recepcion-bl: solo IMPO
      ...(esImpo && bl.fecha_recepcion_bl && {
        'fecha-recepcion-bl': formatDateTimeCL(bl.fecha_recepcion_bl)
      }),
      'service': 'LINER',
      'tipo-servicio': esCargaSuelta ? 'BB' : mapTipoServicio(bl.tipo_servicio_codigo),
      'cond-transporte': bl.cond_transporte,
      'total-bultos': bl.bultos || 0,
      'total-peso': bl.peso_bruto || 0,
      'unidad-peso': bl.unidad_peso || 'KGM',
      'total-volumen': sinVolumen ? undefined : (bl.volumen || 0),
      'unidad-volumen': sinVolumen ? undefined : (bl.unidad_volumen || 'MTQ'),
      'total-item': items.length,

   

      OpTransporte: {
        optransporte: {
          'sentido-operacion': bl.tipo_operacion || 'S',
          'nombre-nave': bl.nave_nombre || ''
        }
      },

      ...(bl.forma_pago_flete && !esEmpty && {
        Flete: { 'forma-pago-flete': { tipo: bl.forma_pago_flete } }
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

      Participaciones: participaciones.length > 0
        ? { participacion: participaciones }
        : undefined,

      // Transbordos: en IMPO siempre se incluyen (aunque estén vacíos no llegan aquí)
      ...(transbordos.length > 0 && {
        Transbordos: {
          transbordo: transbordos.map(t => ({
            'cod-lugar': t.puerto_cod,
            'descripcion-lugar': t.puerto_nombre || t.puerto_cod,
            'fecha-arribo': t.fecha_arribo ? formatDateTimeCL(t.fecha_arribo) : undefined
          }))
        }
      }),

      Items: {
        item: items.map(it => buildItem(it, contenedores, repData, tipo, bl))
      },

      Referencias: generarReferencias(bl),

      ...(observaciones && { Observaciones: observaciones })
    }
  };

const doc = create({ version: '1.0', encoding: 'ISO-8859-1', standalone: esImpo ? true : undefined }, xmlObj); 
 return doc.end({ prettyPrint: true });
 
};


// ══════════════════════════════════════════
// QUERY REUTILIZABLE
// ══════════════════════════════════════════

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
    COALESCE(le.codigo_sidemar, le.codigo) AS lugar_emision_codigo,  le.nombre AS lugar_emision_nombre,
    COALESCE(pe.codigo_sidemar, pe.codigo) AS puerto_embarque_codigo, pe.nombre AS puerto_embarque_nombre,
    COALESCE(pd.codigo_sidemar, pd.codigo) AS puerto_descarga_codigo, pd.nombre AS puerto_descarga_nombre,
    COALESCE(ld.codigo_sidemar, ld.codigo) AS lugar_destino_codigo,   ld.nombre AS lugar_destino_nombre,
    COALESCE(lem.codigo_sidemar,lem.codigo) AS lugar_entrega_codigo,  lem.nombre AS lugar_entrega_nombre,
    COALESCE(lrm.codigo_sidemar,lrm.codigo) AS lugar_recepcion_codigo,lrm.nombre AS lugar_recepcion_nombre,
    ref_emi.id   AS emi_id,   ref_emi.rut   AS emi_rut,   ref_emi.nombre_emisor AS emi_nombre,
    ref_emi.pais AS emi_pais, ref_emi.tipo_id_emisor AS emi_tipo_id, ref_emi.nacion_id AS emi_nacion_id,
    ref_emido.id   AS emido_id,   ref_emido.rut   AS emido_rut,   ref_emido.nombre_emisor AS emido_nombre,
    ref_emido.pais AS emido_pais, ref_emido.tipo_id_emisor AS emido_tipo_id, ref_emido.nacion_id AS emido_nacion_id,
    ref_rep.id   AS rep_id,   ref_rep.rut   AS rep_rut,   ref_rep.nombre_emisor AS rep_nombre,
    ref_rep.pais AS rep_pais, ref_rep.tipo_id_emisor AS rep_tipo_id, ref_rep.nacion_id AS rep_nacion_id,
    ref_doc.id AS ref_doc_id, ref_doc.rut AS ref_doc_rut, ref_doc.nombre_emisor AS ref_doc_nombre,
    ref_doc.match_code AS ref_doc_codigo, ref_doc.pais AS ref_doc_pais,
    ref_doc.tipo_id_emisor AS ref_doc_tipo_id, ref_doc.nacion_id AS ref_doc_nacion_id,

   CASE WHEN almacenador_p.id IS NOT NULL THEN almacenador_p.id
     WHEN b.almacenista_nombre IS NOT NULL THEN -1
     ELSE NULL END                                    AS almacenador_id,
COALESCE(almacenador_p.rut,    b.almacenista_rut)    AS almacenador_rut,
COALESCE(almacenador_p.nombre, b.almacenista_nombre) AS almacenador_nombre,
COALESCE(almacenador_p.pais,   'CL')                 AS almacenador_pais,
COALESCE(almacenador_p.codigo_almacen, b.almacenista_codigo_almacen) AS almacenador_codigo_almacen

  FROM bls b
  LEFT JOIN manifiestos m ON b.manifiesto_id = m.id
  LEFT JOIN naves n ON m.nave_id = n.id
  LEFT JOIN tipos_servicio ts ON b.tipo_servicio_id = ts.id
  LEFT JOIN puertos le  ON b.lugar_emision_id  = le.id
  LEFT JOIN puertos pe  ON b.puerto_embarque_id = pe.id
  LEFT JOIN puertos pd  ON b.puerto_descarga_id = pd.id
  LEFT JOIN puertos ld  ON b.lugar_destino_id   = ld.id
  LEFT JOIN puertos lem ON b.lugar_entrega_id   = lem.id
  LEFT JOIN puertos lrm ON b.lugar_recepcion_id = lrm.id
LEFT JOIN participantes almacenador_p ON b.almacenador_id = almacenador_p.id
  LEFT JOIN referencias ref_emi   ON m.operador_nave    = ref_emi.customer_id
  LEFT JOIN referencias ref_emido ON m.emisor_documento = ref_emido.customer_id
  LEFT JOIN referencias ref_rep   ON m.representante    = ref_rep.match_code
  LEFT JOIN referencias ref_doc   ON m.referencia_id    = ref_doc.id
  WHERE b.bl_number = ?
  LIMIT 1
`;

const getContenedoresQuery = () => `
  SELECT
    c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito,
    c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen,
    c.es_soc, c.cnt_so_numero,
    GROUP_CONCAT(DISTINCT s.sello ORDER BY s.sello SEPARATOR '|') AS sellos,
    GROUP_CONCAT(DISTINCT CONCAT(i.clase_imo, ':', i.numero_imo) SEPARATOR '|') AS imo_data
  FROM bl_contenedores c
  LEFT JOIN bl_contenedor_sellos s ON s.contenedor_id = c.id
  LEFT JOIN bl_contenedor_imo i ON i.contenedor_id = c.id
  WHERE c.bl_id = ?
  GROUP BY c.id, c.item_id, c.codigo, c.sigla, c.numero, c.digito,
           c.tipo_cnt, c.carga_cnt, c.peso, c.unidad_peso, c.volumen, c.unidad_volumen,
           c.es_soc, c.cnt_so_numero
  ORDER BY c.codigo
`;

const getTransbordosQuery = () => `
  SELECT t.sec, t.puerto_cod, t.fecha_arribo, p.nombre AS puerto_nombre
  FROM bl_transbordos t
  LEFT JOIN puertos p ON t.puerto_id = p.id
  WHERE t.bl_id = ?
  ORDER BY t.sec ASC
`;

module.exports = {
  buildXML,
  getBLQuery,
  getContenedoresQuery,
  getTransbordosQuery,
  formatDateCL,
  formatDateTimeCL,
  cleanRUT,
  generarReferencias
};