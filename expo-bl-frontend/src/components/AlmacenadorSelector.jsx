import { useState, useEffect, useRef } from 'react';
import { Search, X, Warehouse } from 'lucide-react';

const API_BASE_URL = 'http://localhost:4000';

/**
 * AlmacenadorSelector
 * 
 * Selector de almacenadores desde la tabla participantes.
 * Filtra solo los que tienen codigo_almacen NOT NULL.
 * 
 * Props:
 *   value         → almacenador_id actual (número o null)
 *   displayValue  → texto del almacenador seleccionado (string)
 *   onChange      → función(id, nombre, datosCompletos) llamada al seleccionar
 *   onClear       → función() llamada al limpiar la selección
 */
const AlmacenadorSelector = ({ value, displayValue, onChange, onClear }) => {
    const [almacenadores, setAlmacenadores] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Cargar almacenadores al montar
    useEffect(() => {
        fetchAlmacenadores();
    }, []);

    // Filtrar al escribir
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFiltered(almacenadores);
            return;
        }
        const term = searchTerm.toLowerCase();
        setFiltered(
            almacenadores.filter(a =>
                a.codigo_bms.toLowerCase().includes(term) ||
                a.nombre.toLowerCase().includes(term) ||
                (a.codigo_almacen && a.codigo_almacen.toLowerCase().includes(term))
            )
        );
    }, [searchTerm, almacenadores]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchAlmacenadores = async () => {
        setLoading(true);
        try {
            // El backend filtra por codigo_almacen IS NOT NULL
            const res = await fetch(`${API_BASE_URL}/api/mantenedores/participantes?tipo=almacenador`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAlmacenadores(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error cargando almacenadores:', err);
            setAlmacenadores([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (almacenador) => {
        // Construir texto de display similar al formato del BL
        const texto = [
            almacenador.nombre,
            almacenador.direccion,
            almacenador.ciudad && almacenador.pais
                ? `${almacenador.ciudad} - ${almacenador.pais}`
                : almacenador.ciudad || almacenador.pais,
            almacenador.telefono && `Tel: ${almacenador.telefono}`,
            almacenador.email && `Email: ${almacenador.email}`,
        ]
            .filter(Boolean)
            .join('\n');

        onChange(almacenador.id, texto, almacenador);
        setShowDropdown(false);
        setSearchTerm('');
    };

    const handleClear = () => {
        onClear();
        setSearchTerm('');
    };

    return (
        <div className="border border-slate-300 rounded-lg p-6 bg-white relative">
            <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2 flex items-center gap-2">
                <Warehouse size={20} className="text-slate-600" />
                Almacenador (ALM)
                <span className="text-sm text-slate-500 font-normal">(Opcional)</span>
            </h3>

            {/* Si hay uno seleccionado, mostrarlo */}
            {value ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                                {displayValue}
                            </pre>
                        </div>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Quitar almacenador"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Buscador / Selector */
                <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setShowDropdown(true)}
                            placeholder={
                                loading
                                    ? 'Cargando almacenadores...'
                                    : 'Buscar por nombre, código BMS o código almacén...'
                            }
                            disabled={loading}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        />
                    </div>

                    {showDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">
                                    {searchTerm
                                        ? 'No se encontraron almacenadores'
                                        : 'No hay almacenadores registrados'}
                                </div>
                            ) : (
                                filtered.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => handleSelect(a)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-800 text-sm truncate">
                                                    {a.nombre}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {a.codigo_bms}
                                                    </span>
                                                    {a.ciudad && (
                                                        <span>{a.ciudad}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {a.codigo_almacen && (
                                                <span className="flex-shrink-0 text-xs font-mono bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">
                                                    ALM: {a.codigo_almacen}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Info */}
            {!value && (
                <p className="mt-2 text-xs text-slate-500">
                    Solo aparecen participantes con código de almacén registrado.
                </p>
            )}
        </div>
    );
};

export default AlmacenadorSelector;