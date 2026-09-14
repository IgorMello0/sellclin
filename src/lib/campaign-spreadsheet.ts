import Papa from 'papaparse';

export const SPREADSHEET_CONTACT_LIMIT = 5000;
export type SpreadsheetContact = { name: string; phone: string; date?: string; time?: string; specialist?: string };
export type SpreadsheetStats = {
  totalImported: number; validRows: number; duplicateRows: number; invalidRows: number;
  truncated: boolean; missingPhoneColumn?: boolean;
};
export const SPREADSHEET_FIELDS = [
  { key: 'name', label: 'Nome', aliases: ['nome', 'name', 'cliente', 'contato'] },
  { key: 'phone', label: 'Telefone', aliases: ['telefone', 'phone', 'whatsapp', 'celular', 'numero'] },
  { key: 'date', label: 'Data', aliases: ['data', 'date', 'dia', 'data_agendamento', 'data_consulta', 'consulta_data'] },
  { key: 'time', label: 'Hora', aliases: ['hora', 'horario', 'time', 'hora_agendamento', 'hora_consulta', 'consulta_hora'] },
  { key: 'specialist', label: 'Profissional', aliases: ['especialista', 'profissional', 'dr', 'dra', 'doutor', 'doutora', 'medico', 'medica', 'doctor'] },
] as const;
export type SpreadsheetField = keyof SpreadsheetContact;
export type SpreadsheetColumn = { header: string; field: SpreadsheetField | null };
export type SpreadsheetRow = { record: number; values: string[] };
export type SpreadsheetImport = {
  contacts: SpreadsheetContact[]; stats: SpreadsheetStats;
  columns: SpreadsheetColumn[]; rows: SpreadsheetRow[];
};

export function parseSpreadsheetContacts(text: string): SpreadsheetImport {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimitersToGuess: [',', ';', '\t'] });
  if (parsed.errors.some(error => error.type === 'Quotes')) throw new Error('Aspas inválidas na planilha. Exporte o arquivo novamente como CSV.');
  const [headers = [], ...data] = parsed.data;
  const normalized = headers.map(header => header.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const indexes = SPREADSHEET_FIELDS.map(field => normalized.findIndex(header => (field.aliases as readonly string[]).includes(header)));
  const columns = headers.map((header, index) => ({ header: header.trim(), field: SPREADSHEET_FIELDS[indexes.indexOf(index)]?.key || null }));
  const stats: SpreadsheetStats = { totalImported: data.length, validRows: 0, duplicateRows: 0, invalidRows: 0, truncated: data.length > SPREADSHEET_CONTACT_LIMIT };
  const contacts: SpreadsheetContact[] = [];
  const rows: SpreadsheetRow[] = [];
  if (indexes[1] < 0) return { contacts, rows, columns, stats: { ...stats, missingPhoneColumn: true } };
  const seen = new Set<string>();
  data.slice(0, SPREADSHEET_CONTACT_LIMIT).forEach((values, index) => {
    const [name, rawPhone, date, time, specialist] = indexes.map(column => (values[column] || '').trim());
    const phone = rawPhone.replace(/\D/g, '');
    if (!phone) { stats.invalidRows++; return; }
    if (seen.has(phone)) { stats.duplicateRows++; return; }
    seen.add(phone);
    contacts.push({ name: name || 'Contato', phone, date, time, specialist });
    rows.push({ record: index + 2, values });
  });
  stats.validRows = contacts.length;
  return { contacts, rows, columns, stats };
}

export const VARIABLE_FIELDS: Record<string, SpreadsheetField> = {
  nome: 'name', primeiro_nome: 'name', telefone: 'phone', data: 'date', hora: 'time', especialista: 'specialist', dr: 'specialist',
};

export function renderSpreadsheetMessage(text: string, contact: SpreadsheetContact): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (token, key: string) => {
    const field = VARIABLE_FIELDS[key.toLowerCase()];
    if (!field) return token;
    return key.toLowerCase() === 'primeiro_nome' ? contact.name.split(' ')[0] : contact[field] || '';
  });
}

export function missingSpreadsheetVariables(text: string, contact: SpreadsheetContact): string[] {
  return [...new Set(text.match(/\{\{[^}]+\}\}/g) || [])].filter(token => {
    const field = VARIABLE_FIELDS[token.slice(2, -2).toLowerCase()];
    return !field || !contact[field];
  });
}
