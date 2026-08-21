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

// Volumen: la BD almacena DECIMAL(12,3) (precision del PMS), pero SIDEMAR
// solo acepta 2 decimales. El recorte se hace aca, con redondeo
// half-away-from-zero — el mismo criterio que aplicaba MySQL cuando la
// columna era DECIMAL(12,2), para que el XML no cambie respecto del historico.
//
// NO usar toFixed(2): por representacion binaria redondea hacia abajo en
// valores con 5 en la tercera decimal (182.565 -> 182.56 en vez de 182.57).
// Tampoco sirve Math.floor(x * 100 + 0.5): arrastra el mismo problema
// (1.005 * 100 = 100.49999999999999 -> 1.00 en vez de 1.01).
// Pasar por milesimas enteras evita ambos casos.
const vol2 = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '0.00';
  const m = Math.round(Math.abs(n) * 1000);   // a milesimas enteras
  const c = Math.floor((m + 5) / 10);         // a centesimas, half-up sobre enteros
  return (Math.sign(n) * c / 100).toFixed(2);
};

// total-volumen del BL = suma de los volumenes de los items YA redondeados con
// vol2(), para que el total cuadre con sus partes dentro del mismo XML.
//
// Antes salia de bls.volumen, que se redondeaba por su cuenta: con items de
// 19.854 y 182.563 el XML emitia items 19.85 + 182.56 (= 202.41) contra un
// total de 202.42. Ademas bls.volumen es un total derivado que los endpoints
// de edicion no recalculan, asi que podia quedar viejo respecto de sus items.
//
// Se suma en centesimas enteras: 19.85 + 182.56 en float da 202.41000000000003.
const totalVolumenItems = (items) => {
  const centesimas = (items || []).reduce((acc, it) => {
    // Mismo criterio que itemSinVolumen en buildItem: el item que no aporta
    // volumen tampoco emite su tag, y no debe sumar.
    if (!(parseFloat(it.volumen) > 0)) return acc;
    return acc + Math.round(parseFloat(vol2(it.volumen)) * 100);
  }, 0);
  return (centesimas / 100).toFixed(2);
};

const formatDateCL = (date) => {
  if (!date) return '';
  const str = String(date).trim();
  // Ya viene como DD/MM/YYYY (desde getBLQuery con DATE_FORMAT)
  const matchD = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchD) return `${matchD[1]}-${matchD[2]}-${matchD[3]}`;
  // Viene como YYYY-MM-DD (otros campos)
  const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) return `${matchISO[3]}-${matchISO[2]}-${matchISO[1]}`;
  return str;
};

const formatDateTimeCL = (date) => {
  if (!date) return '';
  const str = String(date).replace('T', ' ').trim();
  // Ya viene como DD/MM/YYYY HH:mm (desde getBLQuery con DATE_FORMAT)
  const matchDT = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
  if (matchDT) return `${matchDT[1]}-${matchDT[2]}-${matchDT[3]} ${matchDT[4]}`;
  // Viene como YYYY-MM-DD HH:mm (otros campos como manifiesto_fecha_zarpe)
  const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  if (matchISO) return `${matchISO[3]}-${matchISO[2]}-${matchISO[1]} ${matchISO[4]}`;
  // Solo fecha YYYY-MM-DD sin hora
  const matchD = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchD) return `${matchD[3]}-${matchD[2]}-${matchD[1]} 00:00`;
  return str;
};
const parseFechaCL = (str) => {
  if (!str) return '';
  str = String(str).trim();
  const matchDT = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/);
  if (matchDT) return `${matchDT[1]}-${matchDT[2]}-${matchDT[3]} ${matchDT[4]}`;
  const matchD = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchD) return `${matchD[1]}-${matchD[2]}-${matchD[3]}`;
  return formatDateCL(str); // fallback para fechas que vienen de la BD
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

const buildParticipacion = (nombre, participante, includeRUT = true, extraFields = {}, includeContacto = true, includeNacionId = false) => {
  if (!participante || !participante.nombre) return null;

  const p = { nombre };

  if (includeRUT && participante.rut) {
    p['tipo-id'] = participante.tipo_id || 'RUT';
    p['valor-id'] = cleanRUT(participante.rut);
    p['nacion-id'] = 'CL';
  } else if (includeRUT && participante.nacion_id) {
    p['nacion-id'] = participante.nacion_id;  // chileno sin RUT (raro) o extranjero con RUT extranjero
  } else if (includeNacionId && participante.nacion_id) {
    p['nacion-id'] = participante.nacion_id;  // IMPO sin RUT pero con nacion_id
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
    rut: bl.consignee_rut || null, nacion_id: bl.consignee_nacion_id
  } : null;
  const notifyData = bl.notify_party ? {
    nombre: bl.notify_party, direccion: bl.notify_direccion || '.', telefono: bl.notify_telefono || '.', email: bl.notify_email || null,
    rut: bl.notify_rut || null, nacion_id: bl.notify_nacion_id
  } : null;

  // Almacenador — existe en bls para IMPO y carga suelta
  const almData = bl.almacenador_id ? {
    nombre: bl.almacenador_nombre,
    rut: bl.almacenador_rut,
    pais: bl.almacenador_pais || 'CL',
    tipo_id: 'RUT',
    nacion_id: bl.almacenador_pais || 'CL'
  } : null;

  if (esCargaSuelta) {
    // ── CARGA SUELTA (BB) ──────────────────────────────
    // EMI → ALM → REP → EMIDO → EMB → CONS → NOTI
    if (emiData) lista.push(buildParticipacion('EMI', emiData, true, { 'codigo-pais': emiData.pais }, false));
    if (almData) {
      const almSinPais = { ...almData, pais: null };
      lista.push(buildParticipacion('ALM', almSinPais, true, { 'codigo-almacen': bl.almacenador_codigo_almacen || '' }, false));
    } if (repData) lista.push(buildParticipacion('REP', repData, true, {}, false));
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
    if (consigneeData) lista.push(buildParticipacion('CONS', consigneeData, !!consigneeData.rut, {}, true, true));
    if (notifyData) lista.push(buildParticipacion('NOTI', notifyData, !!notifyData.rut, {}, true, true));

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

  // IMOs del ítem (union de todos sus contenedores)
  let itemImoList = [];
  if (esPeligroso) {
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
      descripcion: (it.descripcion || '').substring(0, 2048),
      cantidad: it.cantidad || 0,
      'peso-bruto': it.peso_bruto || 0,
      'unidad-peso': it.unidad_peso || 'KGM',
      volumen: itemSinVolumen ? undefined : vol2(it.volumen),
      'unidad-volumen': itemSinVolumen ? undefined : (it.unidad_volumen || 'MTQ'),
      'carga-cnt': 'N'
    };
  }

  return {
    'numero-item': it.numero_item,
    marcas: it.marcas || '',
    'carga-peligrosa': it.carga_peligrosa || 'N',
    'tipo-bulto': it.tipo_bulto || '',
    descripcion: (it.descripcion || '').substring(0, 2048),
    cantidad: it.cantidad || 0,
    'peso-bruto': it.peso_bruto || 0,
    'unidad-peso': it.unidad_peso || 'KGM',
    volumen: itemSinVolumen ? undefined : vol2(it.volumen),
    'unidad-volumen': itemSinVolumen ? undefined : (it.unidad_volumen || 'MTQ'),

    // carga-cnt: vacío en EXPO, no existe en IMPO
    ...(!esImpo && { 'carga-cnt': {} }),

    // ItemsIMO: carga peligrosa (IMPO y EXPO)
    ...(esPeligroso && itemImoList.length > 0 && {
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

// Glosa del país de destino para la observación 12 de un tránsito.
// No se lee de puertos.pais: esa columna está vacía en 1010 de 1020 puertos, y
// los pocos valores que tiene vienen con tilde y en formato mixto ("Perú").
// Bolivia y Perú no están acá: tienen código propio (10 y 11) por el oficio.
const PAISES_TRANSITO = {
  AR: 'ARGENTINA',
  BO: 'BOLIVIA',
  PE: 'PERU',
  UY: 'URUGUAY',
  PY: 'PARAGUAY',
  BR: 'BRASIL',
};

// Parsea bls.observaciones. Devuelve el arreglo, o null si el valor no es un
// arreglo (texto plano heredado de carga suelta) — quien llame decide qué hacer
// con ese caso, pero NUNCA debe pisarlo.
const parseObservaciones = (valor) => {
  if (!valor) return [];
  const raw = typeof valor === 'string'
    ? (() => { try { return JSON.parse(valor); } catch { return null; } })()
    : valor;
  return Array.isArray(raw) ? raw : null;
};

// Calcula las observaciones automáticas a partir del estado actual del BL.
// Es cálculo puro: no mira lo que el operador cargó a mano ni omite nada por
// coincidencia de código. Si una manual choca con una de estas, eso es un
// conflicto que se resuelve en combinarObservaciones(), no acá — el operador
// tiene que enterarse, no perder la automática en silencio.
const calcularObservacionesAuto = (bl, transbordos, tipo) => {
  const { esCargaSuelta, esImpo, esTránsito } = tipo;

  // Carga suelta y exportación no generan automáticas.
  if (esCargaSuelta || !esImpo) return [];

  const obs = [];

  // El 14 habla de transbordos, no de sentido: aplica igual a importación
  // normal y a tránsito.
  if (!transbordos || transbordos.length === 0) {
    obs.push({ nombre: '14', contenido: 'SIN TRB' });
  }

  if (esTránsito) {
    // Oficio Circular 182 de Aduanas (29-05-2015): el destino final de un
    // tránsito se declara como observación con código por país.
    // El prefijo sale del código estándar del puerto, NO del que va al XML
    // — ese puede venir traducido a SIDEMAR y su prefijo no es el país.
    // Acá no se exige que el destino difiera del puerto de descarga (la
    // condición del 12 de importación): en un tránsito el destino final es
    // extranjero por definición, y la ingesta PMS deja el LD copiado del
    // puerto de descarga hasta que el operador lo corrige.
    const pais = String(bl.lugar_destino_codigo_pais || '').substring(0, 2).toUpperCase();
    if (pais && pais !== 'CL') {
      if (pais === 'BO') obs.push({ nombre: '10', contenido: 'BOLIVIA' });
      else if (pais === 'PE') obs.push({ nombre: '11', contenido: 'PERU' });
      else obs.push({ nombre: '12', contenido: PAISES_TRANSITO[pais] || pais });
    }
    obs.push({ nombre: 'GRAL', contenido: 'Por cuenta y riesgo del consignatario' });
  } else if (bl.lugar_destino_codigo && bl.lugar_destino_codigo !== bl.puerto_descarga_codigo) {
    const pais = bl.lugar_destino_codigo.substring(0, 2);
    if (pais && pais !== 'CL') {
      obs.push({ nombre: '12', contenido: pais === 'AR' ? 'ARGENTINA' : pais });
    }
  }

  return obs;
};

// Une automáticas y manuales en la lista que se guarda en bls.observaciones.
//
// El orden es automáticas primero y manuales después, que es el orden en que el
// XML las viene emitiendo desde siempre.
//
// Una manual marcada `conflicto: 'reemplaza'` suprime la automática de ese
// código: es la opción C) del operador cuando se le avisó del choque.
// Una marcada `conflicto: 'ambas'` convive con la automática sin volver a
// avisar. Una manual sin marca que choque con una automática vigente es un
// conflicto sin resolver, y se devuelve para que el llamador levante el ERROR.
const combinarObservaciones = (autos, manuales) => {
  const reemplazados = new Set(
    manuales.filter(m => m.conflicto === 'reemplaza').map(m => m.nombre)
  );
  const autosVigentes = autos.filter(a => !reemplazados.has(a.nombre));

  // El origen se normaliza al escribir: lo que venía sin campo `origen`
  // (formato antiguo) queda marcado como manual, nunca como auto. Si se
  // marcara como auto, el próximo recálculo lo borraría.
  const lista = [
    ...autosVigentes.map(a => ({ nombre: a.nombre, contenido: a.contenido, origen: 'auto' })),
    ...manuales.map(m => ({
      nombre: m.nombre || 'GRAL',
      contenido: m.contenido || '',
      origen: 'manual',
      ...(m.conflicto ? { conflicto: m.conflicto } : {}),
    })),
  ];

  const conflictos = manuales
    .filter(m => !m.conflicto && autosVigentes.some(a => a.nombre === (m.nombre || 'GRAL')))
    .map(m => m.nombre || 'GRAL');

  return { lista, conflictos: [...new Set(conflictos)] };
};

// Lee las observaciones ya materializadas en bls.observaciones y las deja en la
// forma que espera el XML.
//
// El cálculo vive en revalidarBLCompleto(), no acá. El fallback en vivo se
// dispara cuando el campo está vacío, que es el estado de todo BL anterior a la
// materialización (no se hace backfill masivo).
//
// La condición es "lista vacía" y NO valid_last_run: los BLs que ya existían
// fueron revalidados por el código viejo, que no materializaba, así que tienen
// valid_last_run puesto y observaciones en NULL. Con ese marcador se habrían
// quedado sin el 14 SIN TRB en el XML.
//
// Es seguro por construcción: si la materialización sí corrió y aun así no hay
// observaciones, el cálculo en vivo devuelve la misma lista vacía, porque es la
// misma función. Generar el XML nunca escribe en la base.
const generarObservaciones = (bl, transbordos, tipo) => {
  const { esCargaSuelta } = tipo;
  const obs = [];

  const almacenadas = parseObservaciones(bl.observaciones);

  if (esCargaSuelta && almacenadas === null && bl.observaciones) {
    // Carga suelta con texto plano: se respeta el formato heredado.
    obs.push({ nombre: 'GRAL', contenido: bl.observaciones });
    obs.push({ nombre: 'MOT', contenido: 'LISTA DE ENCARGO' });
    return { observacion: obs };
  }

  const lista = almacenadas || [];

  if (lista.length > 0) {
    lista.forEach(o => obs.push({ nombre: o.nombre || 'GRAL', contenido: o.contenido || '' }));
  } else {
    // Sin materializar: se calculan las automáticas al vuelo. Sale el mismo XML
    // que si estuvieran guardadas, porque es la misma función de cálculo.
    const { lista: combinada } = combinarObservaciones(
      calcularObservacionesAuto(bl, transbordos, tipo),
      []
    );
    combinada.forEach(o => obs.push({ nombre: o.nombre, contenido: o.contenido }));
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
      // fecha-recepcion-bl: IMPO y EXPO (opcional, solo si existe)
      ...(bl.fecha_recepcion_bl && {
        'fecha-recepcion-bl': formatDateTimeCL(bl.fecha_recepcion_bl)
      }),
      'service': 'LINER',
      'tipo-servicio': esCargaSuelta ? 'BB' : mapTipoServicio(bl.tipo_servicio_codigo),
      'cond-transporte': bl.cond_transporte,
      'total-bultos': bl.bultos || 0,
      'total-peso': bl.peso_bruto || 0,
      'unidad-peso': bl.unidad_peso || 'KGM',
      'total-volumen': sinVolumen ? undefined : totalVolumenItems(items),
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
        fecha: (() => {
          if (esCargaSuelta) {
            return [
              { nombre: 'FPRES', valor: (() => { const d = new Date(); const opts = { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }; const p = new Intl.DateTimeFormat('es-CL', opts).formatToParts(d); const get = t => p.find(x => x.type === t).value; return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`; })() }, { nombre: 'FEM', valor: parseFechaCL(bl.fecha_emision) },
              bl.fecha_embarque && { nombre: 'FEMB', valor: parseFechaCL(bl.fecha_embarque) },
              bl.manifiesto_fecha_zarpe && { nombre: 'FZARPE', valor: formatDateTimeCL(bl.manifiesto_fecha_zarpe) }
            ].filter(Boolean);
          }
          // IMPO/EXPO — sin cambios
          return [
            { nombre: 'FPRES', valor: (() => { const d = new Date(); const opts = { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }; const p = new Intl.DateTimeFormat('es-CL', opts).formatToParts(d); const get = t => p.find(x => x.type === t).value; return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`; })() },
            { nombre: 'FEM', valor: formatDateCL(esImpo ? bl.fecha_emision : bl.manifiesto_fecha_zarpe) },
            { nombre: 'FZARPE', valor: formatDateTimeCL(esImpo ? bl.fecha_zarpe : bl.manifiesto_fecha_zarpe) },
            (esImpo ? bl.fecha_embarque : bl.manifiesto_fecha_zarpe) && { nombre: 'FEMB', valor: formatDateTimeCL(esImpo ? bl.fecha_embarque : bl.manifiesto_fecha_zarpe) }
          ].filter(Boolean);
        })()
      },

      Locaciones: {
        locacion: [
          !esCargaSuelta && bl.lugar_emision_codigo && { nombre: 'LE', codigo: bl.lugar_emision_codigo, descripcion: bl.lugar_emision_nombre },
          (() => {
            const ultimoTransbordo = esImpo && transbordos.length > 0 ? transbordos[transbordos.length - 1] : null;
            const peCodigo = ultimoTransbordo ? (ultimoTransbordo.puerto_codigo_sidemar || ultimoTransbordo.puerto_cod) : bl.puerto_embarque_codigo;
            const peNombre = ultimoTransbordo ? (ultimoTransbordo.puerto_nombre || peCodigo) : bl.puerto_embarque_nombre;
            return peCodigo ? { nombre: 'PE', codigo: peCodigo, descripcion: peNombre } : null;
          })(),
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
            'cod-lugar': t.puerto_codigo_sidemar || t.puerto_cod,
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
    DATE_FORMAT(b.fecha_embarque, '%d/%m/%Y %H:%i') AS fecha_embarque,
    DATE_FORMAT(b.fecha_zarpe,    '%d/%m/%Y %H:%i') AS fecha_zarpe,
    DATE_FORMAT(b.fecha_emision,  '%d/%m/%Y')        AS fecha_emision,
    m.viaje,
    -- Sentido por BL: b.sentido_operacion manda; NULL hereda del manifiesto.
    -- Se mantiene el alias tipo_operacion para que detectarTipo() y las ramas
    -- que dependen de esImpo sigan leyendo el mismo campo de siempre.
    COALESCE(b.sentido_operacion, m.tipo_operacion) AS tipo_operacion,
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
    -- Codigo estandar sin traducir del lugar de destino. El alias de arriba es
    -- el que va al XML, pero puede venir como codigo SIDEMAR, y el prefijo de
    -- pais de un codigo SIDEMAR no corresponde al pais real. Para decidir la
    -- observacion de transito (10/11/12) se usa SIEMPRE este.
    ld.codigo AS lugar_destino_codigo_pais,
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
  SELECT t.sec, t.puerto_cod, t.fecha_arribo, p.nombre AS puerto_nombre,
    COALESCE(p.codigo_sidemar, p.codigo) AS puerto_codigo_sidemar
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
  parseFechaCL,
  cleanRUT,
  generarReferencias,
  detectarTipo,
  generarObservaciones,
  parseObservaciones,
  calcularObservacionesAuto,
  combinarObservaciones,
};