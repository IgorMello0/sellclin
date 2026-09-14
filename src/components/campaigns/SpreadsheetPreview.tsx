import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SPREADSHEET_FIELDS, type SpreadsheetImport } from '@/lib/campaign-spreadsheet';

type Props = { data: SpreadsheetImport; index: number; onSelect: (index: number) => void; fileName: string };

export function SpreadsheetContactPicker({ data, index, onSelect }: Omit<Props, 'fileName'>) {
  const contact = data.contacts[index];
  if (!contact) return null;
  return (
    <div className="min-w-0 space-y-2" data-contact-picker>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Contato anterior" aria-label="Contato anterior" disabled={index === 0} onClick={() => onSelect(index - 1)}><ArrowLeft className="h-4 w-4" /></Button>
        <label className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1 text-xs text-slate-600">
          Contato
          <input aria-label="Número do contato" type="number" min={1} max={data.contacts.length} value={index + 1} onChange={event => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next >= 1 && next <= data.contacts.length) onSelect(next - 1);
          }} className="h-8 w-16 rounded border border-slate-200 bg-white px-1 text-center text-slate-900" />
          de {data.contacts.length}
        </label>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Próximo contato" aria-label="Próximo contato" disabled={index === data.contacts.length - 1} onClick={() => onSelect(index + 1)}><ArrowRight className="h-4 w-4" /></Button>
      </div>
      <p className="break-words text-xs text-slate-700"><strong>{contact.name}</strong> · {contact.phone}</p>
    </div>
  );
}

export function SpreadsheetPreview({ data, index, onSelect, fileName }: Props) {
  const pageStart = Math.floor(index / 5) * 5;
  const missing = SPREADSHEET_FIELDS.filter(field => !data.columns.some(column => column.field === field.key));
  return (
    <section className="min-w-0 border-y border-slate-200 py-4" aria-label="Dados importados">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Dados da planilha</h3>
          <p className="break-all text-xs text-slate-500">{fileName}</p>
        </div>
        <span className="text-xs text-slate-500">{data.contacts.length} contatos importados</span>
      </div>
      <SpreadsheetContactPicker data={data} index={index} onSelect={onSelect} />
      <div className="mt-3 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Colunas importadas">
        <table className="w-full border-collapse text-left text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            <th className="p-2 font-medium">Registro</th>
            {data.columns.map((column, columnIndex) => (
              <th key={columnIndex} className="min-w-32 max-w-52 p-2 align-top">
                <span className="block break-words text-slate-800">{column.header || '(sem título)'}</span>
                <span className={`block font-normal ${column.field ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {SPREADSHEET_FIELDS.find(field => field.key === column.field)?.label || 'Não utilizada'}
                </span>
              </th>
            ))}
          </tr></thead>
          <tbody>{data.rows.slice(pageStart, pageStart + 5).map((row, offset) => {
            const rowIndex = pageStart + offset;
            return <tr key={row.record} className={`border-b border-slate-100 ${index === rowIndex ? 'bg-blue-50' : ''}`}>
              <td className="p-2"><button type="button" aria-label={`Visualizar registro ${row.record}`} aria-pressed={index === rowIndex} onClick={() => onSelect(rowIndex)} className="rounded px-2 py-1 font-semibold text-blue-700 underline">{row.record}</button></td>
              {data.columns.map((column, columnIndex) => <td key={columnIndex} className="max-w-52 break-words p-2 align-top text-slate-700">{row.values[columnIndex]?.trim() || <span className="text-amber-700">Vazio</span>}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {missing.length > 0 && <p className="mt-2 text-xs text-amber-800">Colunas não encontradas: {missing.map(field => field.label).join(', ')}.{missing.some(field => field.key === 'name') ? ' Nome de envio: Contato.' : ''}</p>}
    </section>
  );
}
