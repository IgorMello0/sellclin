import type { WhatsAppTemplate } from '../types/whatsapp-template';

export function getChatTemplateTokens(template?: WhatsAppTemplate): string[] {
  return (template?.components || []).flatMap(component =>
    String(component.type).toUpperCase() === 'BODY' ? component.text?.match(/\{\{[^}]+\}\}/g) || [] : [],
  );
}

export function getChatTemplatePreview(template: WhatsAppTemplate, values: string[], contact: { name: string; phone: string }) {
  const digits = contact.phone.replace(/\D/g, '');
  const phone = digits && !digits.startsWith('55') ? `55${digits}` : digits;
  const variables: Record<string, string> = { nome: contact.name, name: contact.name, telefone: phone, phone };
  // Keep parameter order and contact substitutions consistent with whatsapp-messages.ts.
  const resolvedValues = getChatTemplateTokens(template).map((_, index) => (values[index] || '').replace(
    /\{\{\s*([^}]+)\s*\}\}/g,
    (_match, key: string) => variables[key.trim()] ?? variables[key.trim().toLowerCase()] ?? '',
  ));
  let parameterIndex = 0;
  const body = (template.components || []).filter(component => String(component.type).toUpperCase() === 'BODY')
    .map(component => (component.text || '').replace(/\{\{[^}]+\}\}/g, token => {
      const value = resolvedValues[parameterIndex++];
      return value?.trim() ? value : token;
    })).join('\n');
  return { body, resolvedValues, incomplete: resolvedValues.some(value => !value.trim()) };
}
