
import React, { useState, useMemo } from 'react';
import { Sale, Payment, Booking } from '../types';
import { PROCEDURES_BY_SERVICE, SERVICE_DURATIONS } from '../constants';

// Declare XLSX from the script loaded in index.html
declare const XLSX: any;

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  addBulkSales: (sales: Sale[]) => void;
  addBulkBookings: (bookings: Booking[]) => void;
  specialists: string[];
}

const COLUMN_ALIASES: Record<string, string[]> = {
    date: ['fecha'],
    client: ['cliente'],
    serviceType: ['tipo_servicio'], // For 'Servicio'
    procedure: ['subservicio'],     // For 'Procedimiento'
    totalAmount: ['venta', 'monto', 'total'],
    dni: ['dni'],
    phone: ['celular', 'telefono'],
    cash: ['efectivo'],
    card: ['tarjeta', 'pos'],
    cream: ['crema'],
    // New columns for occupancy history
    time: ['hora', 'time', 'inicio'],
    specialist: ['especialista', 'personal', 'atendido_por', 'profesional'],
    duration: ['duracion', 'duration']
};

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, addBulkSales, addBulkBookings, specialists }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [generateBookings, setGenerateBookings] = useState(false);
    const [results, setResults] = useState<{ successSales: number; successBookings: number; errors: string[] } | null>(null);

    const procedureToServiceMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const serviceType in PROCEDURES_BY_SERVICE) {
            for (const procedure of PROCEDURES_BY_SERVICE[serviceType]) {
                map[procedure.toLowerCase()] = serviceType;
            }
        }
        return map;
    }, []);

    const findColumnIndex = (header: string[], aliases: string[]): number => {
        for (const alias of aliases) {
            const index = header.findIndex(h => h.toLowerCase().trim().includes(alias));
            if (index !== -1) return index;
        }
        return -1;
    };

    const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const trimmedDate = dateStr.trim();
        // Check for DD/MM/YYYY or DD-MM-YYYY
        let parts = trimmedDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (parts) {
            const d = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
            if (!isNaN(d.getTime())) return d;
        }
        // Check for YYYY/MM/DD or YYYY-MM-DD
        parts = trimmedDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (parts) {
            const d = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
            if (!isNaN(d.getTime())) return d;
        }
        // Fallback for other formats like ISO or Excel's numeric date
        const d = new Date(trimmedDate);
        if (!isNaN(d.getTime())) return d;

        // Handle Excel numeric date format
        const excelDate = parseFloat(trimmedDate);
        if (!isNaN(excelDate)) {
             const utc_days  = Math.floor(excelDate - 25569);
             const utc_value = utc_days * 86400;                                        
             const date_info = new Date(utc_value * 1000);
             if (!isNaN(date_info.getTime())) return date_info;
        }

        return null;
    };
    
    const parseTime = (timeStr: string, date: Date): Date => {
        const resultDate = new Date(date);
        // Default to 9 AM if empty or invalid
        resultDate.setHours(9, 0, 0, 0);
        
        if (!timeStr) return resultDate;

        // HH:MM format
        const parts = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (parts) {
            let h = parseInt(parts[1]);
            const m = parseInt(parts[2]);
            if (timeStr.toLowerCase().includes('pm') && h < 12) h += 12;
            if (timeStr.toLowerCase().includes('am') && h === 12) h = 0;
            resultDate.setHours(h, m);
            return resultDate;
        }
        
        // Excel fractional day (0.5 = 12:00)
        const fraction = parseFloat(timeStr);
        if (!isNaN(fraction) && fraction < 1) {
            const totalSeconds = Math.floor(fraction * 86400);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            resultDate.setHours(h, m);
        }
        
        return resultDate;
    }

    const processCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            setResults({ successSales: 0, successBookings: 0, errors: ["El archivo está vacío o no tiene filas de datos."] });
            return;
        }

        const header = lines[0].split(',').map(h => h.trim());
        const indices: Record<string, number> = {};
        for (const key in COLUMN_ALIASES) {
            indices[key] = findColumnIndex(header, COLUMN_ALIASES[key]);
        }

        if (indices.date === -1 || indices.client === -1 || indices.procedure === -1 || indices.totalAmount === -1) {
             setResults({ successSales: 0, successBookings: 0, errors: ["El archivo debe contener las columnas requeridas: Fecha, Cliente, Subservicio, VENTA."] });
             return;
        }

        const newSales: Sale[] = [];
        const newBookings: Booking[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const data = lines[i].split(',');
                
                const timestamp = parseDate(data[indices.date]);
                if (!timestamp) {
                    errors.push(`Fila ${i + 1}: Formato de fecha inválido (${data[indices.date]}).`);
                    continue;
                }
                
                const clientName = data[indices.client]?.trim();
                if (!clientName) {
                    errors.push(`Fila ${i + 1}: El nombre del cliente no puede estar vacío.`);
                    continue;
                }
                
                const client = {
                    name: clientName,
                    dni: indices.dni > -1 ? data[indices.dni]?.trim() : '',
                    phone: indices.phone > -1 ? data[indices.phone]?.trim() : '',
                    source: 'Carga masiva'
                };
                
                const procedureName = data[indices.procedure]?.trim();
                if (!procedureName) {
                    errors.push(`Fila ${i + 1}: El valor de Subservicio (Procedimiento) no puede estar vacío.`);
                    continue;
                }

                let serviceType;
                if (indices.serviceType > -1 && data[indices.serviceType]?.trim()) {
                    serviceType = data[indices.serviceType].trim();
                } else {
                    serviceType = procedureToServiceMap[procedureName.toLowerCase()] || 'Otro';
                }

                const totalAmount = parseFloat(data[indices.totalAmount]);
                 if (isNaN(totalAmount) || totalAmount < 0) {
                    errors.push(`Fila ${i + 1}: Monto de VENTA inválido.`);
                    continue;
                }
                
                const payments: Payment[] = [];
                const cashAmount = indices.cash > -1 ? parseFloat(data[indices.cash]) : 0;
                const cardAmount = indices.card > -1 ? parseFloat(data[indices.card]) : 0;

                if (!isNaN(cashAmount) && cashAmount > 0) {
                    payments.push({ method: 'Efectivo', amount: cashAmount });
                }
                if (!isNaN(cardAmount) && cardAmount > 0) {
                    payments.push({ method: 'POS', amount: cardAmount });
                }
                // If no specific payment columns, assume total amount is Efectivo
                if (payments.length === 0) {
                    payments.push({ method: 'Efectivo', amount: totalAmount });
                }
                
                const creamAmount = indices.cream > -1 ? parseFloat(data[indices.cream]) : 0;
                const creamSold = !isNaN(creamAmount) && creamAmount > 0;

                newSales.push({
                    id: `sale-bulk-${Date.now()}-${i}-main`,
                    timestamp,
                    client,
                    serviceType,
                    procedure: procedureName,
                    payments,
                    creamSold,
                });
                
                // Generate Booking Logic
                if (generateBookings) {
                    const startTime = indices.time > -1 ? parseTime(data[indices.time], timestamp) : new Date(timestamp.setHours(9,0,0,0));
                    
                    let duration = 60;
                    if (indices.duration > -1) {
                        const d = parseInt(data[indices.duration]);
                        if (!isNaN(d) && d > 0) duration = d;
                    } else {
                        // Infer duration
                        duration = SERVICE_DURATIONS[procedureName] || SERVICE_DURATIONS[serviceType] || 60;
                    }
                    
                    const endTime = new Date(startTime.getTime() + duration * 60000);
                    
                    let specialist = 'D.G.'; // Changed default from 'Consulta gratis' to 'D.G.'
                    if (indices.specialist > -1 && data[indices.specialist]?.trim()) {
                        specialist = data[indices.specialist].trim();
                    } else if (specialists.length > 0) {
                        specialist = specialists[0];
                    }
                    
                    newBookings.push({
                        id: `booking-bulk-${Date.now()}-${i}`,
                        specialist,
                        serviceType,
                        procedure: procedureName,
                        startTime,
                        endTime,
                        client,
                        comments: 'Generado desde carga histórica',
                        createdAt: timestamp // For historical bulk load, created date = appointment date is a fair assumption
                    });
                }

            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                errors.push(`Fila ${i + 1}: Error inesperado - ${error}`);
            }
        }
        
        if (newSales.length > 0) {
            addBulkSales(newSales);
        }
        if (newBookings.length > 0) {
            addBulkBookings(newBookings);
        }
        
        setResults({ successSales: newSales.length, successBookings: newBookings.length, errors });
    };

    const handleProcessFile = async () => {
        if (!file) {
            alert('Por favor, seleccione un archivo.');
            return;
        }
        setIsLoading(true);
        setResults(null);
        
        const reader = new FileReader();
        const fileType = file.name.split('.').pop()?.toLowerCase();

        reader.onerror = () => {
            setResults({ successSales: 0, successBookings: 0, errors: ["No se pudo leer el archivo."] });
            setIsLoading(false);
        };

        if (fileType === 'csv') {
            reader.onload = (event) => {
                try {
                    const text = event.target?.result as string;
                    processCSV(text);
                } catch (e) {
                    const error = e instanceof Error ? e.message : String(e);
                    setResults({ successSales: 0, successBookings: 0, errors: [`Error al procesar el archivo: ${error}`] });
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsText(file);
        } else if (fileType === 'xls' || fileType === 'xlsx') {
            reader.onload = (event) => {
                try {
                    const data = event.target?.result as ArrayBuffer;
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csvText = XLSX.utils.sheet_to_csv(worksheet);
                    processCSV(csvText);
                } catch (e) {
                    const error = e instanceof Error ? e.message : String(e);
                    setResults({ successSales: 0, successBookings: 0, errors: [`Error al procesar el archivo: ${error}`] });
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Formato de archivo no soportado. Por favor, use .csv, .xls, o .xlsx.");
            setIsLoading(false);
            return;
        }
    };

    const resetState = () => {
        setFile(null);
        setIsLoading(false);
        setResults(null);
        setGenerateBookings(false);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    };



    const handleClose = () => {
        resetState();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-title-bulk">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-6 border-b border-slate-200">
                    <h2 id="modal-title-bulk" className="text-2xl font-bold text-slate-800">Carga Masiva de Datos</h2>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="overflow-y-auto p-8 space-y-6">
                    <div className="p-4 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg">
                        <h3 className="font-bold text-sky-800">Instrucciones de Importación</h3>
                        <ul className="mt-2 list-disc list-inside text-sm text-slate-700 space-y-1">
                            <li>Formatos soportados: <strong>.xlsx, .xls, .csv</strong>.</li>
                            <li>Columnas <strong>Requeridas</strong>: <code>Fecha</code>, <code>Cliente</code>, <code>Subservicio</code> (Procedimiento), <code>VENTA</code> (Monto).</li>
                            <li>Columnas <strong>Opcionales</strong>: <code>tipo_servicio</code>, <code>DNI</code>, <code>Celular</code>, <code>Efectivo</code>, <code>Tarjeta</code>.</li>
                            <li>Para <strong>Historial de Ocupación</strong> (Opcional): incluir <code>Hora</code> (Inicio), <code>Especialista</code>, <code>Duración</code> (min).</li>
                        </ul>
                    </div>

                    {!results ? (
                        <>
                         <div className="flex flex-col items-center space-y-4">
                            <label htmlFor="file-upload" className="w-full flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">
                                <svg className="w-8 h-8" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4 4-4-4h3V3h2v8z" />
                                </svg>
                                <span className="mt-2 text-base leading-normal">{file ? file.name : "Seleccionar archivo"}</span>
                                <input id="file-upload" type="file" className="hidden" accept=".csv, .xls, .xlsx, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { setFile(e.target.files ? e.target.files[0] : null); setResults(null); }} />
                            </label>
                         </div>

                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <label className="flex items-start space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={generateBookings} 
                                    onChange={e => setGenerateBookings(e.target.checked)} 
                                    className="mt-1 h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                    <span className="font-bold text-slate-800">Generar también Reservas Históricas</span>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Si se activa, se crearán registros de "Reserva" basados en las ventas para poblar el calendario y los gráficos de ocupación. 
                                        Se intentará leer la columna <code>Hora</code> y <code>Especialista</code>. Si faltan, se usarán valores predeterminados.
                                    </p>
                                </div>
                            </label>
                         </div>
                        </>
                    ) : (
                        <div className="p-4 rounded-lg bg-slate-50">
                            <h3 className="font-bold text-slate-800">Resultados de la Importación</h3>
                            <div className="grid grid-cols-2 gap-4 my-4">
                                <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                    <p className="text-slate-500 text-xs uppercase font-bold">Ventas Generadas</p>
                                    <p className="text-2xl font-bold text-green-600">{results.successSales}</p>
                                </div>
                                <div className="bg-white p-3 rounded border border-slate-200 text-center">
                                    <p className="text-slate-500 text-xs uppercase font-bold">Reservas Generadas</p>
                                    <p className="text-2xl font-bold text-purple-600">{results.successBookings}</p>
                                </div>
                            </div>
                            
                            {results.errors.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-red-600 font-semibold">{results.errors.length} filas con errores:</p>
                                    <ul className="list-disc list-inside text-sm text-red-700 max-h-40 overflow-y-auto">
                                        {results.errors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </div>
                            )}
                             <button onClick={resetState} className="mt-4 text-sm text-sky-600 hover:underline">Cargar otro archivo</button>
                        </div>
                    )}
                </div>

                <footer className="flex flex-col sm:flex-row justify-end p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl gap-4">
                    <button type="button" onClick={handleClose} className="w-full sm:w-auto px-6 py-2 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100 order-2 sm:order-1">
                        {results ? 'Cerrar' : 'Cancelar'}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleProcessFile} 
                        disabled={!file || isLoading || !!results}
                        className="w-full sm:w-auto px-8 py-3 bg-sky-600 text-white font-bold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center order-1 sm:order-2"
                    >
                        {isLoading ? (
                            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Procesando...</>
                        ) : 'Procesar Archivo'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default BulkUploadModal;
