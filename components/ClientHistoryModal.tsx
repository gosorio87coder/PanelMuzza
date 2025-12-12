import React, { useMemo } from 'react';
import { Sale } from '../types';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientDni: string | null;
  allSales: Sale[];
}

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ isOpen, onClose, clientDni, allSales }) => {
  const clientSales = useMemo(() => {
    if (!clientDni) return [];
    return allSales
      .filter(sale => sale.client.dni === clientDni)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [clientDni, allSales]);

  if (!isOpen || !clientDni) return null;

  const clientName = clientSales.length > 0 ? clientSales[0].client.name : 'Cliente';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-history-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 id="modal-history-title" className="text-2xl font-bold text-slate-800">
            Historial de <span className="text-purple-700">{clientName}</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="overflow-y-auto flex-grow p-6">
          {clientSales.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                  <tr>
                    <th scope="col" className="px-6 py-3">Fecha</th>
                    <th scope="col" className="px-6 py-3">Servicio</th>
                    <th scope="col" className="px-6 py-3">Procedimiento</th>
                    <th scope="col" className="px-6 py-3 text-right">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientSales.map(sale => {
                    const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <tr key={sale.id} className="bg-white border-b hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono whitespace-nowrap">{new Date(sale.timestamp).toLocaleDateString('es-ES')}</td>
                        <td className="px-6 py-4">{sale.serviceType}</td>
                        <td className="px-6 py-4">{sale.procedure}</td>
                        <td className="px-6 py-4 font-mono text-right whitespace-nowrap">S/ {totalAmount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-10 text-slate-500">No se encontró historial para este cliente.</p>
          )}
        </div>
        <footer className="flex justify-end p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ClientHistoryModal;