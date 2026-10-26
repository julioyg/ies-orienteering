import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ControlDefinition } from '../data/controls';

interface PrintableCardData extends ControlDefinition {
  svgMarkup: string;
}

interface PrintableControlsViewProps {
  controls: ControlDefinition[];
}

export const PrintableControlsView: React.FC<PrintableControlsViewProps> = ({ controls }) => {
  const [cards, setCards] = useState<PrintableCardData[]>([]);

  useEffect(() => {
    let active = true;
    const generateAll = async () => {
      const generated: PrintableCardData[] = [];
      for (const ctrl of controls) {
        const svgMarkup = await QRCode.toString(ctrl.qrPayload, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        generated.push({ ...ctrl, svgMarkup });
      }
      if (active) {
        setCards(generated);
      }
    };
    generateAll();
    return () => {
      active = false;
    };
  }, [controls]);

  // Group cards into explicit pages of 6 (2 columns x 3 rows per A4 sheet)
  const CARDS_PER_PAGE = 6;
  const pages: PrintableCardData[][] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    pages.push(cards.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <div className="bg-slate-100 text-slate-950 print:bg-white">
      {/* Printable Grid Container */}
      <main className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">
        <div className="no-print mb-4 p-4 rounded-xl bg-white border-2 border-slate-300 text-slate-700 text-sm flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <strong>Instrucciones de impresión para el profesorado:</strong> Pulsa{' '}
            <span className="font-bold text-slate-950">«Imprimir Balizas (A4)»</span>, activa la
            opción <em>«Gráficos de fondo» (Background graphics)</em> en el diálogo de impresión
            para conservar el triángulo naranja oficial IOF y plastifica las tarjetas para uso
            exterior.
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-md border-2 border-orange-400 shrink-0"
          >
            🖨️ Imprimir Balizas (A4)
          </button>
        </div>

        <div className="space-y-4 print:space-y-0">
          {pages.map((pageCards, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3"
            >
              {pageCards.map((card) => {
                const isSpecial = card.type === 'START' || card.type === 'FINISH';
                return (
                  <article
                    key={card.id}
                    className="printable-card relative overflow-hidden rounded-2xl border-4 border-slate-950 bg-white shadow-sm p-4 print:p-2.5 flex flex-col justify-between"
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                      backgroundImage:
                        'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #FF5500 50%, #FF5500 100%)',
                    }}
                  >
                    {/* Top Header Banner */}
                    <div className="relative z-10 flex items-center justify-between bg-slate-950 text-white px-3.5 py-2 print:px-3 print:py-1.5 rounded-xl border-2 border-slate-950">
                      <div>
                        <span className="block text-[10px] print:text-[9px] font-extrabold uppercase tracking-widest text-orange-400">
                          IES SIERRA ALMIJARA · ORIENTACIÓN
                        </span>
                        <h2
                          className={`font-black tracking-tight leading-none ${
                            isSpecial
                              ? 'text-2xl print:text-xl text-amber-300'
                              : 'text-2xl print:text-xl text-white'
                          }`}
                        >
                          {card.cardTitle}
                        </h2>
                      </div>
                      <span className="px-2.5 py-1 print:px-2 print:py-0.5 rounded-lg bg-orange-600 text-white font-mono font-black text-lg print:text-base border border-orange-300">
                        {card.type === 'START'
                          ? `▶ #${card.id}`
                          : card.type === 'FINISH'
                          ? `🏁 #${card.id}`
                          : `#${card.id}`}
                      </span>
                    </div>

                    {/* Center QR Code Box */}
                    <div className="relative z-10 my-3 print:my-1 mx-auto bg-white p-2.5 print:p-2 rounded-2xl border-4 border-slate-950 shadow-md w-44 h-44 print:w-36 print:h-36 flex items-center justify-center shrink-0">
                      <div
                        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                        dangerouslySetInnerHTML={{ __html: card.svgMarkup }}
                      />
                    </div>

                    {/* Bottom Manual Backup Code Strip */}
                    <div className="relative z-10 bg-white/95 border-3 border-slate-950 rounded-xl px-3 py-2 print:px-2.5 print:py-1.5 text-center shadow">
                      <p className="text-[11px] print:text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                        Plan B · Si falla la cámara introduce:
                      </p>
                      <p className="text-lg print:text-base font-black text-slate-950 tracking-wide">
                        Código manual:{' '}
                        <span className="font-mono text-2xl print:text-xl bg-slate-950 text-amber-300 px-2.5 py-0.5 print:px-2 rounded-md tracking-widest">
                          {card.backupCode}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
