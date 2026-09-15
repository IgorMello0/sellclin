import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChatTemplatePreview, getChatTemplateTokens } from './chat-template-preview';
import type { WhatsAppTemplate } from '../types/whatsapp-template';

const template: WhatsAppTemplate = { id: 1, name: 'lembrete', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED', components: [
  { type: 'BODY', text: 'Olá {{1}}, consulta com {{2}} em {{3}}.' },
] };
const contact = { name: 'Ana Silva', phone: '(11) 99999-8888' };

test('renders the exact entered values without fictitious data', () => {
  const preview = getChatTemplatePreview(template, ['Ana', 'Dra. Bia', '15/09/2026'], contact);
  assert.equal(preview.body, 'Olá Ana, consulta com Dra. Bia em 15/09/2026.');
  assert.equal(preview.incomplete, false);
});
test('keeps unfilled placeholders visible and marks the preview incomplete', () => {
  const preview = getChatTemplatePreview(template, ['Ana', ' ', ''], contact);
  assert.equal(preview.body, 'Olá Ana, consulta com {{2}} em {{3}}.');
  assert.equal(preview.incomplete, true);
});
test('resolves contact aliases as the chat send endpoint does', () => {
  const preview = getChatTemplatePreview(template, ['{{nome}}', '{{ PHONE }}', '$& $$ <texto>'], contact);
  assert.deepEqual(preview.resolvedValues, ['Ana Silva', '5511999998888', '$& $$ <texto>']);
  assert.equal(preview.body, 'Olá Ana Silva, consulta com 5511999998888 em $& $$ <texto>.');
  assert.equal(getChatTemplatePreview(template, ['{{unknown}}'], contact).incomplete, true);
});
test('supports named variables in the same order as the send payload', () => {
  const named = { ...template, components: [{ type: 'BODY' as const, text: '{{ cliente }}, {{data}}' }] };
  assert.deepEqual(getChatTemplateTokens(named), ['{{ cliente }}', '{{data}}']);
  assert.equal(getChatTemplatePreview(named, ['Ana', '16/09'], contact).body, 'Ana, 16/09');
});
test('static templates need no parameters', () => {
  const staticTemplate = { ...template, components: [{ type: 'BODY' as const, text: 'Sua consulta foi confirmada.' }] };
  assert.deepEqual(getChatTemplateTokens(staticTemplate), []);
  assert.equal(getChatTemplatePreview(staticTemplate, [], contact).incomplete, false);
  assert.equal(getChatTemplatePreview(staticTemplate, [], contact).body, 'Sua consulta foi confirmada.');
});
