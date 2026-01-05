
import React from 'react';

interface MonthlyReportViewProps {
  aiAnalysis: any;
}

const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ aiAnalysis }) => {
  const report = aiAnalysis?.monthlyReport;

  if (!report) return (
    <div className="text-center py-20 text-gray-400">
      Le rapport sera disponible après la synchronisation des données.
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <header className="border-b border-gray-100 pb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Rapport Mensuel</h1>
        <p className="text-gray-400 font-medium">Analyse consolidée du 30 du mois</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-3xl border border-gray-100">
          <h3 className="text-sm font-semibold text-green-600 uppercase tracking-widest mb-6">Points Forts</h3>
          <ul className="space-y-4">
            {report.pointsForts.map((pt: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-green-500 shrink-0"></span>
                <span className="font-medium">{pt}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white p-8 rounded-3xl border border-gray-100">
          <h3 className="text-sm font-semibold text-red-600 uppercase tracking-widest mb-6">Axes d'Amélioration</h3>
          <ul className="space-y-4">
            {report.pointsFaibles.map((pt: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0"></span>
                <span className="font-medium">{pt}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-gray-50 p-8 rounded-3xl border border-dashed border-gray-300">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">Suggestions de Progression</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {report.suggestions.map((s: string, i: number) => (
            <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 font-medium text-gray-800">
              {s}
            </div>
          ))}
        </div>
      </section>

      <div className="pt-12 text-center">
        <p className="text-xs text-gray-300 uppercase tracking-widest font-bold">Généré par Athletica Intelligence</p>
      </div>
    </div>
  );
};

export default MonthlyReportView;
