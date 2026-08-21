// components/PuertoAutocomplete.jsx
//
// Autocompletado de puertos por código o nombre. Vivía dentro de ExpoBLEdit.jsx
// y se extrajo sin cambios de comportamiento para poder reutilizarlo desde el
// modal de confirmación de tránsito en GenerarXML.
//
// Muestra dos entradas por puerto cuando tiene código SIDEMAR distinto del
// estándar, marcando cuál es cuál.
import { useState, useEffect, useRef } from "react";

const PuertoAutocomplete = ({ label, value, onChange, puertos, required, excluirPais }) => {
    const [query, setQuery] = useState(value || '');
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    const todasOpciones = [];
    puertos.forEach(p => {
        // El filtro por país mira SIEMPRE el código estándar: el prefijo de un
        // código SIDEMAR no corresponde al país. Sin la prop, no filtra nada.
        if (excluirPais && String(p.codigo || '').substring(0, 2).toUpperCase() === excluirPais.toUpperCase()) return;

        if (p.codigo_sidemar && p.codigo_sidemar !== p.codigo) {
            todasOpciones.push({ codigo: p.codigo_sidemar, nombre: p.nombre, esSidemar: true });
        }
        todasOpciones.push({ codigo: p.codigo, nombre: p.nombre, esSidemar: false });
    });

    const filtradas = query.length >= 1
        ? todasOpciones.filter(op =>
            op.codigo.toUpperCase().includes(query.toUpperCase()) ||
            op.nombre.toUpperCase().includes(query.toUpperCase())
        ).slice(0, 8)
        : [];

    const handleSelect = (op) => {
        setQuery(op.codigo);
        onChange(op.codigo);
        setOpen(false);
    };

    const handleInputChange = (e) => {
        const v = e.target.value.toUpperCase();
        setQuery(v);
        onChange(v);
        setOpen(true);
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => { if (query.length >= 1) setOpen(true); }}
                placeholder="Escribe código o nombre..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors"
            />
            {open && filtradas.length > 0 && (
                <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[280px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                            Puertos disponibles · {filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="py-1 max-h-60 overflow-y-auto">
                        {filtradas.map((op, i) => {
                            const isSelected = op.codigo === value;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onMouseDown={() => handleSelect(op)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-l-4 ${isSelected ? 'border-l-[#0F2A44] bg-slate-100' : 'border-l-transparent hover:bg-slate-50'}`}
                                >
                                    <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold font-mono border ${op.esSidemar ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                        {op.codigo}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-slate-800 truncate">{op.nombre}</span>
                                            {isSelected && <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 font-medium flex-shrink-0">Activo</span>}
                                        </div>
                                        {op.esSidemar && <p className="text-[11px] text-amber-600 font-medium mt-0.5">Código SIDEMAR</p>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PuertoAutocomplete;
