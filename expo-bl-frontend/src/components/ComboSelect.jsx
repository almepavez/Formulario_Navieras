import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const ComboSelect = ({
    label, value, onChange, options, required,
    placeholder, disabled, maxLength, allowFreeText = false,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    const filtradas = query.trim().length >= 1
        ? options.filter(o =>
            String(o.value).toLowerCase().includes(query.toLowerCase()) ||
            String(o.label).toLowerCase().includes(query.toLowerCase())
        )
        : options;

    // Cerrar al click fuera
    useEffect(() => {
        const handler = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);


    // Sincronizar query con value
    useEffect(() => {
        if (!allowFreeText && !open) {
            const found = options.find(o => String(o.value) === String(value));
            setQuery(found ? found.label : "");
        }
    }, [value, open]);


    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            const itemHeight = 41;
            const headerHeight = 28;
            const estimatedHeight = Math.min(
                headerHeight + filtradas.length * itemHeight,
                224
            );

            const showAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

            setDropdownStyle({
                position: "fixed",
                top: showAbove ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
                left: rect.left,
                width: Math.max(rect.width, 200),
                zIndex: 9999,
            });
        }
    }, [open, filtradas.length]);

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "";

    return (
        <div className="relative" ref={triggerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div
                className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between cursor-pointer transition-colors
                    ${disabled ? "bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200" :
                        open ? "border-[#0F2A44] ring-2 ring-[#0F2A44] ring-opacity-20 bg-white" :
                            "border-slate-300 bg-white hover:border-slate-400"}
                `}
                onClick={() => {
                    if (!disabled) {
                        setQuery("");
                        setOpen(o => !o);
                    }
                }}
            >
                {allowFreeText ? (
                    <input
                        type="text"
                        value={value || ""}
                        onChange={e => {
                            onChange(e.target.value.toUpperCase());
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                        onClick={e => e.stopPropagation()}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder || "Seleccionar..."}
                        maxLength={maxLength}
                        disabled={disabled}
                        className="flex-1 outline-none bg-transparent text-sm font-mono uppercase text-slate-800 placeholder-slate-400"
                    />
                ) : (
                    <input
                        type="text"
                        value={open ? query : (selectedLabel || "")}
                        onChange={e => {
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                        onClick={e => e.stopPropagation()}
                        onFocus={() => {
                            setQuery("");
                            setOpen(true);
                        }}
                        placeholder={placeholder || "Seleccionar..."}
                        disabled={disabled}
                        className="flex-1 outline-none bg-transparent text-sm text-slate-800 placeholder-slate-400 cursor-pointer"
                    />
                )}
                <svg
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {open && !disabled && filtradas.length > 0 && createPortal(
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto"
                >
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 sticky top-0">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                            {filtradas.length} opci{filtradas.length !== 1 ? "ones" : "ón"}                        </p>
                    </div>
                    {filtradas.map(op => (
                        <button
                            key={op.value}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                onChange(op.value);
                                setQuery(op.label);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-slate-100 last:border-0 transition-colors
                                ${String(value) === String(op.value)
                                    ? "bg-slate-100 border-l-4 border-l-[#0F2A44]"
                                    : "border-l-4 border-l-transparent hover:bg-slate-50"
                                }`}
                        >
                            {allowFreeText ? (
                                <>
                                    <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded w-12 text-center flex-shrink-0">
                                        {op.value}
                                    </span>
                                    <span className="text-slate-600 truncate">{op.label.split(" - ")[1] || op.label}</span>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-slate-800">{op.label}</span>
                                    {String(value) === String(op.value) && (
                                        <svg className="w-4 h-4 text-[#0F2A44] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default ComboSelect;