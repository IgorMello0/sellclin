import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpreadsheetContacts, renderSpreadsheetMessage, missingSpreadsheetVariables, SPREADSHEET_CONTACT_LIMIT } from './campaign-spreadsheet';

test('preserves original columns, aliases and recipient data', () => {
  const result = parseSpreadsheetContacts('\uFEFFCliente;Número;data_consulta;Horário;Médica;Observação\nAna Silva;(11) 99999-8888;14/09/2026;09:30;Dra. Bia;Retorno');
  assert.deepEqual(result.columns.map(column => column.field), ['name', 'phone', 'date', 'time', 'specialist', null]);
  assert.equal(result.columns[4].header, 'Médica');
  assert.equal(result.rows[0].record, 2);
  assert.equal(result.rows[0].values[1], '(11) 99999-8888');
  assert.equal(renderSpreadsheetMessage('Olá {{primeiro_nome}}, {{especialista}}, {{data}} {{hora}}: {{telefone}}', result.contacts[0]), 'Olá Ana, Dra. Bia, 14/09/2026 09:30: 11999998888');
});

test('preview changes with the recipient, preserves literal replacement characters', () => {
  const { contacts } = parseSpreadsheetContacts('nome,telefone,data\nAna,11999998888,14/09\n"Bia $&",11988887777,15/09');
  assert.equal(renderSpreadsheetMessage('{{nome}} {{data}}', contacts[0]), 'Ana 14/09');
  assert.equal(renderSpreadsheetMessage('{{nome}} {{data}}', contacts[1]), 'Bia $& 15/09');
});

test('handles CSV quoting, delimiters within cells and multiline records', () => {
  const result = parseSpreadsheetContacts('nome,telefone,especialista\n"Ana, Maria",11999998888,"Dra. ""Bia""\nEquipe"');
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].name, 'Ana, Maria');
  assert.equal(result.contacts[0].specialist, 'Dra. "Bia"\nEquipe');
  assert.equal(result.stats.totalImported, 1);
});

test('TSV, duplicates and missing phones retain correct record references', () => {
  const result = parseSpreadsheetContacts('nome\ttelefone\nAna\t11999998888\nRepetido\t(11) 99999-8888\nInválido\tabc\nBia\t11988887777');
  assert.deepEqual(result.rows.map(row => row.record), [2, 5]);
  assert.equal(result.stats.duplicateRows, 1);
  assert.equal(result.stats.invalidRows, 1);
});

test('missing columns and empty cells never use fictional samples', () => {
  const result = parseSpreadsheetContacts('nome;telefone;data\n;11999998888;');
  assert.equal(result.contacts[0].name, 'Contato');
  assert.equal(renderSpreadsheetMessage('{{data}} {{especialista}}', result.contacts[0]), ' ');
  assert.deepEqual(missingSpreadsheetVariables('{{data}} {{data}} {{especialista}}', result.contacts[0]), ['{{data}}', '{{especialista}}']);
  assert.equal(parseSpreadsheetContacts('nome,email\nAna,a@exemplo.com').stats.missingPhoneColumn, true);
});

test('only the first recognized alias is used, matching dispatch normalization', () => {
  const result = parseSpreadsheetContacts('nome;telefone;celular\nAna;11999998888;11988887777');
  assert.equal(result.contacts[0].phone, '11999998888');
  assert.deepEqual(result.columns.map(column => column.field), ['name', 'phone', null]);
});

test('truncates at the existing recipient limit', () => {
  const result = parseSpreadsheetContacts('nome,telefone\n' + Array.from({ length: SPREADSHEET_CONTACT_LIMIT + 1 }, (_, index) => `Contato ${index},5511${100000000 + index}`).join('\n'));
  assert.equal(result.contacts.length, SPREADSHEET_CONTACT_LIMIT);
  assert.equal(result.stats.truncated, true);
});

test('rejects broken quoted CSV instead of silently previewing wrong columns', () => {
  assert.throws(() => parseSpreadsheetContacts('nome,telefone\n"Ana,11999998888'), /Aspas/);
});
