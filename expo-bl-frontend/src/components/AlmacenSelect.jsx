import { useState, useRef, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const AlmacenSelect = ({ value, onChange, onSave, todos = [] }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const ref = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const found = todos.find(a =>
        a.codigo_tatc === value || a.nombre === value || a.codigo_almacen === value
    );
    const selectedLabel = found ? found.codigo_tatc : value || "";

    const filtrados = query.trim()
        ? todos.filter(a =>
            a.codigo_tatc?.toLowerCase().includes(query.toLowerCase()) ||
            a.nombre?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8)
        : todos.slice(0, 8);

    const handleSelect = (a) => {
        setOpen(false);
        setQuery("");
        onChange(a.codigo_tatc);
        onSave?.();
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange("");
        onSave?.();
    };

    return (
        <div className="relative" ref={ref} style={{ width: "120px" }}>
            <div
                ref={triggerRef}
                onClick={() => {
                    const rect = triggerRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom, left: rect.left });
                    setOpen(v => !v);
                    setQuery("");
                }}
                className="flex items-center justify-between gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1 cursor-pointer hover:border-blue-400 transition-colors"
                style={{ width: "120px" }}
            >
                <span className="text-xs font-mono font-semibold text-blue-800 truncate">
                    {selectedLabel || <span className="text-slate-400 font-normal font-sans">Seleccionar...</span>}
                </span>
                {selectedLabel
                    ? <span onClick={handleClear} className="text-blue-300 hover:text-red-500 flex-shrink-0 text-[10px] cursor-pointer leading-none">✕</span>
                    : <span className="text-slate-400 flex-shrink-0 text-[9px]">▼</span>
                }
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQuery(""); }} />
                    <div className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
                        style={{ width: "280px", top: dropdownPos.top, left: dropdownPos.left }}>
                        <div className="p-2 border-b border-slate-100">
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar TATC o nombre..."
                                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                            {filtrados.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                                    {query ? `Sin resultados para "${query}"` : "Sin almacenistas con TATC"}
                                </div>
                            ) : filtrados.map(a => (
                                <button key={a.id} type="button" onClick={() => handleSelect(a)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex-shrink-0">
                                            {a.codigo_tatc}
                                        </span>
                                        <span className="text-xs text-slate-600 truncate">{a.nombre}</span>
                                    </div>
                                    {a.codigo_almacen && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">ALM: {a.codigo_almacen}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400">Solo almacenistas con código TATC</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AlmacenSelect;