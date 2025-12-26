export const expoInitialModel = {
  documento: {
    tipo: "BL",
    version: "1.0",

    cabecera: {
      tipoAccion: "M",
      numeroReferencia: "",
      service: "LINER",
      tipoServicio: "FCL/FCL",
      condTransporte: "HH"
    },

    totales: {
      totalBultos: 1,
      totalPeso: "",
      unidadPeso: "KGM",
      totalVolumen: "",
      unidadVolumen: "MTQ",
      totalItem: 1
    },

   transporte: {
  sentidoOperacion: "S",
  nombreNave: "",
  viaje: "",
  service: "LINER",
  tipoServicio: "FCL/FCL",
  condTransporte: "HH"
},

    fechas: {
      fechaEmisionBL: "",
      fechaZarpe: "",
      fechaEmbarque: ""
    },

    locaciones: {
      lugarEmision: {
        codigo: "CLSCL",
        descripcion: "SANTIAGO"
      },
      puertoEmbarque: {
        codigo: "",
        descripcion: ""
      },
      puertoDesembarque: {
        codigo: "",
        descripcion: ""
      },
      lugarDestinoFinal: {
        codigo: "",
        descripcion: ""
      }
    },

    participantes: {
      emisor: {
        nombre: "A.J. BROOM Y CIA. S.A.C.",
        tipoId: "RUT",
        valorId: "",
        pais: "CL",
        direccion: "",
        correo: "",
        telefono: ""
      },
      embarcador: {
        nombre: "",
        pais: "",
        direccion: "",
        correo: "",
        telefono: ""
      },
      consignatario: {
        nombre: "",
        pais: "",
        direccion: "",
        correo: "",
        telefono: ""
      },
      notify: {
        nombre: "",
        pais: "",
        direccion: "",
        correo: "",
        telefono: ""
      }
    },

    items: [
      {
        numeroItem: 1,
        tipoBulto: "CONT",
        descripcionMercancia: "",
        cantidad: 1,
        pesoBruto: "",
        unidadPeso: "KGM",
        volumen: "",
        unidadVolumen: "MTQ",
        cargaEnContenedor: "S",

        contenedores: [
          {
            sigla: "",
            numero: "",
            digito: "",
            tipoContenedor: "",
            peso: "",
            operador: "A.J. BROOM Y CIA. S.A.C.",
            sellos: []
          }
        ]
      }
    ]
  }
};
