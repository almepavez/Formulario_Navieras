// components/SearchSelect.jsx
import { useState, useEffect, useRef } from "react";

const SearchSelect = ({ label, value, onChange, options, required, placeholder }) => {
    const [query, setQuery] = useState(value || "");
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => { setQuery(value || ""); }, [value]);

    const filtradas = query.length >= 1
        ? options.filter(o =>
            o.value.toLowerCase().includes(query.toLowerCase()) ||
            o.label.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10)
        : [];

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
                onFocus={() => { if (query.length >= 1) setOpen(true); }}
                placeholder={placeholder || "Escribe para buscar..."}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors text-sm"
            />
            {open && filtradas.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                            {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filtradas.map((op, i) => (
                            <button
                                key={i}
                                type="button"
                                onMouseDown={() => {
                                    setQuery(op.value);
                                    onChange(op.value);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-l-4
                                    ${value === op.value ? "border-l-[#0F2A44] bg-slate-100" : "border-l-transparent hover:bg-slate-50"}`}
                            >
                                <span className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold font-mono border bg-blue-50 text-blue-700 border-blue-200">
                                    {op.value}
                                </span>
                                <span className="text-sm text-slate-700 truncate">{op.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchSelect;