import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Users,
  Search,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  X
} from 'lucide-react';
import auxiliarService from '../services/auxiliarService';
import AgregarAuxiliar from './AgregarAuxiliar';

const DEPARTAMENTOS = {
  admisiones: 'Admisiones',
  academico: 'Académico',
  finanzas: 'Finanzas',
  becas: 'Becas',
  internacional: 'Internacional'
};

const formatFecha = (valor, conHora = false) => {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return null;
  return conHora
    ? fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : fecha.toLocaleDateString('es-ES');
};

const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

const Avatar = ({ aux, size = 'w-12 h-12', text = 'text-sm' }) => {
  const [error, setError] = useState(false);
  if (aux.foto_perfil && !error) {
    return (
      <img
        src={aux.foto_perfil}
        alt={aux.nombre}
        onError={() => setError(true)}
        className={`${size} rounded-2xl object-cover shadow-sm flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${size} rounded-2xl bg-gradient-to-br from-[#967292] to-[#614B59] text-white font-black ${text} flex items-center justify-center flex-shrink-0`}>
      {iniciales(aux.nombre)}
    </div>
  );
};

const Dato = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2 min-w-0">
    <Icon className="w-4 h-4 text-[#967292] mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 break-words">{children || <span className="text-gray-300">—</span>}</p>
    </div>
  </div>
);

const Auxiliares = () => {
  const [auxiliares, setAuxiliares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('lista'); // 'lista' | 'nuevo' | 'editar'
  const [seleccionado, setSeleccionado] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await auxiliarService.getAll();
      setAuxiliares(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista de auxiliares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return auxiliares;
    return auxiliares.filter(a =>
      [a.nombre, a.email, a.telefono, DEPARTAMENTOS[a.departamento] || a.departamento]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q))
    );
  }, [auxiliares, busqueda]);

  const volverALista = (mensaje) => {
    setVista('lista');
    setSeleccionado(null);
    if (mensaje) setAviso({ tipo: 'ok', texto: mensaje });
    cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      const res = await auxiliarService.delete(aEliminar.id);
      const n = res?.becasTransferidas || 0;
      setAviso({
        tipo: 'ok',
        texto: n > 0
          ? `Se eliminó a ${aEliminar.nombre}. Sus ${n} becas quedaron a tu nombre.`
          : `Se eliminó a ${aEliminar.nombre} y ya no tiene acceso.`
      });
      setAEliminar(null);
      cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message || 'No se pudo eliminar al auxiliar' });
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  // Formulario (nuevo o editar)
  if (vista !== 'lista') {
    return (
      <div className="min-h-screen page-surface pt-8 pb-10 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => volverALista()}
            className="mb-4 inline-flex items-center gap-2 text-[#967292] font-black uppercase text-[10px] tracking-widest hover:text-[#614B59] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a la lista
          </button>
          <AgregarAuxiliar
            key={seleccionado?.id || 'nuevo'}
            auxiliar={vista === 'editar' ? seleccionado : null}
            onDone={volverALista}
            onCancel={() => volverALista()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-surface pt-8 pb-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-black italic text-[#967292] mb-2">Auxiliares</h1>
            <p className="text-gray-500 text-sm">
              Registra, edita o elimina a los auxiliares que administran las becas
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setSeleccionado(null); setVista('nuevo'); }}
            className="self-start md:self-auto bg-gradient-to-r from-[#967292] to-[#9C7A98] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Nuevo auxiliar
          </motion.button>
        </motion.div>

        {/* Aviso */}
        <AnimatePresence>
          {aviso && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              role="status"
              className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${
                aviso.tipo === 'ok'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}
            >
              {aviso.tipo === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span className="flex-1">{aviso.texto}</span>
              <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buscador */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono o departamento..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-[#967292] outline-none transition-all"
            />
          </div>
          <div className="mt-4 text-sm text-gray-500">
            {filtrados.length} {filtrados.length === 1 ? 'auxiliar' : 'auxiliares'} en total
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#967292] mx-auto mb-4" />
            <p className="text-gray-500">Cargando auxiliares...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-bold mb-4">{error}</p>
            <button onClick={cargar} className="bg-[#967292] text-white px-4 py-2 rounded-xl text-sm font-bold">
              Reintentar
            </button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">
              {auxiliares.length === 0 ? 'Todavía no hay auxiliares registrados' : 'Ningún auxiliar coincide con la búsqueda'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtrados.map((aux, i) => (
              <motion.div
                key={aux.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
              >
                <div className="flex items-center gap-4 p-5 border-b border-gray-100">
                  <Avatar aux={aux} size="w-14 h-14" text="text-base" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-gray-800 truncate">{aux.nombre}</h3>
                    <p className="text-xs text-gray-500 truncate">{aux.email}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                    aux.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {aux.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                  <Dato icon={Mail} label="Email">{aux.email}</Dato>
                  <Dato icon={Phone} label="Teléfono">{aux.telefono}</Dato>
                  <Dato icon={Building2} label="Departamento">
                    {DEPARTAMENTOS[aux.departamento] || aux.departamento}
                  </Dato>
                  <Dato icon={FileText} label="Becas registradas">{String(aux.becas_creadas ?? 0)}</Dato>
                  <Dato icon={CalendarDays} label="Registrado">{formatFecha(aux.created_at)}</Dato>
                  <Dato icon={Clock} label="Último acceso">
                    {formatFecha(aux.ultimo_acceso, true) || 'Nunca ingresó'}
                  </Dato>
                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => { setSeleccionado(aux); setVista('editar'); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-[#614B59] bg-[#B59BB2]/25 hover:bg-[#B59BB2]/45 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAEliminar(aux)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmación de eliminación */}
      <AnimatePresence>
        {aEliminar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
            onClick={() => !eliminando && setAEliminar(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-eliminar"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h2 id="titulo-eliminar" className="text-lg font-black text-gray-800">¿Eliminar auxiliar?</h2>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-4">
                <Avatar aux={aEliminar} size="w-10 h-10" text="text-xs" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{aEliminar.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">{aEliminar.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Perderá el acceso al sistema de inmediato. Esta acción no se puede deshacer.
              </p>
              {Number(aEliminar.becas_creadas) > 0 && (
                <p className="text-sm text-gray-600 mb-2">
                  Las <b>{aEliminar.becas_creadas}</b> becas que registró <b>no se borran</b>: quedarán a tu nombre.
                </p>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={eliminando}
                  onClick={() => setAEliminar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={eliminando}
                  onClick={confirmarEliminar}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auxiliares;
