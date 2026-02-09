// src/components/CrearPuertoModal.jsx
import { useState } from 'react';

export default function CrearPuertoModal({ isOpen, onClose, onPuertoCreado }) {
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:4000/api/mantenedores/puertos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    codigo: formData.codigo.trim().toUpperCase(),
                    nombre: formData.nombre.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al crear puerto');
            }

            const nuevoPuerto = await response.json();

            // Notificar al padre
            onPuertoCreado(nuevoPuerto);

            // Limpiar y cerrar
            setFormData({ codigo: '', nombre: '' });
            onClose();

        } catch (err) {
            setError(err.message || 'Error al crear el puerto');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ codigo: '', nombre: '' });
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800">
                            Crear Nuevo Puerto
                        </h2>
                        <button
                            onClick={handleClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Código Puerto */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Código Puerto (UNLOCODE) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.codigo}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    codigo: e.target.value.toUpperCase()
                                }))}
                                maxLength={5}
                                placeholder="ej: CLVAP"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 uppercase"
                                required
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                5 caracteres: 2 letras país + 3 letras ciudad
                            </p>
                        </div>

                        {/* Nombre Puerto */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nombre Puerto <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.nombre}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    nombre: e.target.value
                                }))}
                                placeholder="ej: Valparaíso"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={loading}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !formData.codigo || !formData.nombre}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Creando...
                                    </>
                                ) : (
                                    'Crear Puerto'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}