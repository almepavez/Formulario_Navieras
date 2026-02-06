import { useState, useEffect, useRef } from 'react';
import { Search, Edit2, Plus, X, Save } from 'lucide-react';
import Swal from 'sweetalert2';

const ParticipanteSelector = ({ label, tipo, value, displayValue, onChange, required }) => {
    const [participantes, setParticipantes] = useState([]);
    const [filteredParticipantes, setFilteredParticipantes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('new');
    const [selectedParticipante, setSelectedParticipante] = useState(null);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        fetchParticipantes();
    }, []);

    const fetchParticipantes = async () => {
        try {
            const response = await fetch('http://localhost:4000/api/mantenedores/participantes', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Participantes cargados:', data.length);
            setParticipantes(data);
            setFilteredParticipantes(data);
        } catch (error) {
            console.error('❌ Error cargando participantes:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los participantes',
                confirmButtonColor: '#3b82f6'
            });
        }
    };

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredParticipantes(participantes);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = participantes.filter(p =>
            p.codigo_bms.toLowerCase().includes(term) ||
            p.nombre.toLowerCase().includes(term) ||
            (p.rut && p.rut.toLowerCase().includes(term)) ||
            (p.codigo_pil && p.codigo_pil.toLowerCase().includes(term)) // 🔥 BÚSQUEDA POR CÓDIGO PIL
        );
        setFilteredParticipantes(filtered);
    }, [searchTerm, participantes]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectParticipante = (participante) => {
        const textoCompleto = formatParticipanteTexto(participante);
        onChange(participante.id, textoCompleto);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const formatParticipanteTexto = (p) => {
        let texto = p.nombre;
        if (p.direccion) texto += `\n${p.direccion}`;
        if (p.ciudad) texto += `\n${p.ciudad}`;
        if (p.pais) texto += ` - ${p.pais}`;
        if (p.telefono) texto += `\nTel: ${p.telefono}`;
        if (p.email) texto += `\nEmail: ${p.email}`;
        return texto;
    };

    const handleOpenEditModal = (participante) => {
        setSelectedParticipante(participante);
        setModalMode('edit');
        setShowModal(true);
    };

    const handleOpenNewModal = () => {
        setSelectedParticipante({
            codigo_bms: '',
            codigo_pil: '', // 🔥 NUEVO CAMPO
            nombre: '',
            direccion: '',
            ciudad: '',
            pais: '',
            email: '',
            telefono: '',
            rut: '',
            contacto: '',
            matchcode: '',
            tiene_contacto_valido: 0
        });
        setModalMode('new');
        setShowModal(true);
    };

    const validateParticipante = () => {
        const p = selectedParticipante;

        // Campos obligatorios básicos
        if (!p.codigo_bms || !p.codigo_bms.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El Código BMS es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.nombre || !p.nombre.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El Nombre es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.rut || !p.rut.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El RUT es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.ciudad || !p.ciudad.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'La Ciudad es obligatoria',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.pais || !p.pais.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El País es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.contacto || !p.contacto.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El Contacto es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        if (!p.matchcode || !p.matchcode.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El Matchcode es obligatorio',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        // 🔥 VALIDACIÓN: Debe tener email O teléfono (o ambos)
        const tieneEmail = p.email && p.email.trim();
        const tieneTelefono = p.telefono && p.telefono.trim();

        if (!tieneEmail && !tieneTelefono) {
            Swal.fire({
                icon: 'warning',
                title: 'Información de contacto requerida',
                text: 'Debe ingresar al menos un Email o un Teléfono',
                confirmButtonColor: '#3b82f6'
            });
            return false;
        }

        // 🔥 VALIDACIÓN: Si es nuevo, verificar que el código BMS no exista
        if (modalMode === 'new') {
            const codigoExiste = participantes.some(
                participante => participante.codigo_bms.toLowerCase() === p.codigo_bms.trim().toLowerCase()
            );

            if (codigoExiste) {
                Swal.fire({
                    icon: 'error',
                    title: 'Código duplicado',
                    text: `El Código BMS "${p.codigo_bms}" ya existe`,
                    confirmButtonColor: '#3b82f6'
                });
                return false;
            }
        }

        return true;
    };

    const handleSaveParticipante = async () => {
        if (!validateParticipante()) {
            return;
        }

        setLoading(true);
        try {
            const url = modalMode === 'new'
                ? 'http://localhost:4000/api/mantenedores/participantes'
                : `http://localhost:4000/api/mantenedores/participantes/${selectedParticipante.id}`;

            const method = modalMode === 'new' ? 'POST' : 'PUT';

            // 🔥 Preparar datos para enviar
            const dataToSend = { ...selectedParticipante };

            // Asegurar que tiene_contacto_valido sea número
            if (dataToSend.tiene_contacto_valido !== undefined) {
                dataToSend.tiene_contacto_valido = Number(dataToSend.tiene_contacto_valido);
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar');
            }

            const savedParticipante = await response.json();

            // 🔥 Si tiene codigo_pil, sincronizar con traductor_pil_bms
            if (selectedParticipante.codigo_pil && selectedParticipante.codigo_pil.trim()) {
                try {
                    const participanteId = savedParticipante.id || selectedParticipante.id;

                    await fetch('http://localhost:4000/api/mantenedores/traductor-pil-bms/sync-participante', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            codigo_pil: selectedParticipante.codigo_pil.trim(),
                            codigo_bms: selectedParticipante.codigo_bms.trim(),
                            participante_id: participanteId,
                            activo: 1
                        })
                    });
                } catch (syncError) {
                    console.warn('Advertencia al sincronizar traductor:', syncError);
                }
            }

            await fetchParticipantes();

            if (modalMode === 'new') {
                handleSelectParticipante(savedParticipante);
            } else {
                if (value === savedParticipante.id) {
                    const textoActualizado = formatParticipanteTexto(savedParticipante);
                    onChange(savedParticipante.id, textoActualizado);
                }
            }

            setShowModal(false);
            setSelectedParticipante(null);

            Swal.fire({
                icon: 'success',
                title: modalMode === 'new' ? '¡Creado!' : '¡Actualizado!',
                text: `Participante ${modalMode === 'new' ? 'creado' : 'actualizado'} correctamente`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error guardando participante:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo guardar el participante',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="border-b pb-6">
            <h3 className="font-semibold text-slate-800 mb-4">
                {label} {required && <span className="text-red-500">*</span>}
            </h3>

            <div className="relative" ref={dropdownRef}>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Buscar por código BMS, código PIL, nombre o RUT..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo
                    </button>
                </div>

                {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {filteredParticipantes.length === 0 ? (
                            <div className="p-4 text-center text-slate-500">
                                No se encontraron participantes
                            </div>
                        ) : (
                            filteredParticipantes.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                                >
                                    <div
                                        onClick={() => handleSelectParticipante(p)}
                                        className="flex-1"
                                    >
                                        <div className="font-medium text-slate-800">
                                            {p.codigo_bms} {p.codigo_pil && `(PIL: ${p.codigo_pil})`} - {p.nombre}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {p.ciudad && `${p.ciudad}, `}{p.pais}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditModal(p);
                                        }}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {displayValue && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-start">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                            {displayValue}
                        </pre>
                        <button
                            type="button"
                            onClick={() => {
                                const participante = participantes.find(p => p.id === value);
                                if (participante) handleOpenEditModal(participante);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-xl font-semibold">
                                {modalMode === 'new' ? 'Nuevo Participante' : 'Editar Participante'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* 🔥 ACTUALIZADO: Fila con Código BMS y Código PIL */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Código BMS <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.codigo_bms || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            codigo_bms: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                                        disabled={modalMode === 'edit'}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Código PIL
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.codigo_pil || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            codigo_pil: e.target.value
                                        })}
                                        placeholder={modalMode === 'new' ? "Ej: CL100001" : ""}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                                        disabled={modalMode === 'edit'} // 🔥 DESHABILITADO EN EDICIÓN
                                    />
                                    <p className="mt-1 text-xs text-slate-500">
                                        {modalMode === 'new'
                                            ? 'Opcional. Se sincroniza automáticamente con el traductor PIL-BMS'
                                            : 'El código PIL no se puede modificar. Edítalo desde el mantenedor de Traductor PIL-BMS'
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        RUT <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.rut || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            rut: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Matchcode <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.matchcode || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            matchcode: e.target.value
                                        })}
                                        placeholder="Código de búsqueda rápida"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nombre <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={selectedParticipante?.nombre || ''}
                                    onChange={(e) => setSelectedParticipante({
                                        ...selectedParticipante,
                                        nombre: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Dirección
                                </label>
                                <textarea
                                    rows={2}
                                    value={selectedParticipante?.direccion || ''}
                                    onChange={(e) => setSelectedParticipante({
                                        ...selectedParticipante,
                                        direccion: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Ciudad <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.ciudad || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            ciudad: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        País <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.pais || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            pais: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={selectedParticipante?.email || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            email: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Teléfono <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedParticipante?.telefono || ''}
                                        onChange={(e) => setSelectedParticipante({
                                            ...selectedParticipante,
                                            telefono: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 -mt-2 ml-1">
                                * Debe ingresar al menos Email o Teléfono
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Contacto <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={selectedParticipante?.contacto || ''}
                                    onChange={(e) => setSelectedParticipante({
                                        ...selectedParticipante,
                                        contacto: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveParticipante}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" />
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParticipanteSelector;