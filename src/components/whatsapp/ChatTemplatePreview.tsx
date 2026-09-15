import { FileText, Image as ImageIcon, Video } from 'lucide-react';
import type { WhatsAppTemplate } from '@/types/whatsapp-template';

export function ChatTemplatePreview({ template, body, incomplete, recipient }: {
  template: WhatsAppTemplate; body: string; incomplete: boolean; recipient: string;
}) {
  const header = template.components?.find(component => String(component.type).toUpperCase() === 'HEADER');
  const footer = template.components?.find(component => String(component.type).toUpperCase() === 'FOOTER');
  const buttons = template.components?.find(component => String(component.type).toUpperCase() === 'BUTTONS')?.buttons || [];
  const mediaFormat = String(header?.format || '').toUpperCase();
  return (
    <section aria-label="Prévia da mensagem" className="min-w-0 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Prévia da mensagem</h3>
        <p className="break-words text-xs text-slate-500">Para: {recipient}</p>
      </div>
      <div className="rounded-lg bg-slate-100 p-3 sm:p-4">
        <div className="min-w-0 rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 shadow-sm">
          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(mediaFormat) && <div className="mb-3 flex items-center gap-2 border-b border-emerald-200 pb-3 text-xs text-slate-600">
            {mediaFormat === 'IMAGE' ? <ImageIcon className="h-5 w-5 shrink-0" /> : mediaFormat === 'VIDEO' ? <Video className="h-5 w-5 shrink-0" /> : <FileText className="h-5 w-5 shrink-0" />}
            {mediaFormat === 'IMAGE' ? 'Imagem' : mediaFormat === 'VIDEO' ? 'Vídeo' : 'Documento'} do template
          </div>}
          {header?.text && <p className="mb-2 break-words whitespace-pre-wrap text-sm font-semibold text-slate-900">{header.text}</p>}
          <p data-chat-template-preview className="break-words whitespace-pre-wrap text-sm leading-6 text-slate-900">{body}</p>
          {footer?.text && <p className="mt-3 break-words whitespace-pre-wrap text-xs text-slate-600">{footer.text}</p>}
          {buttons.length > 0 && <div className="mt-3 border-t border-emerald-200">{buttons.map((button, index) => <p key={index} className="break-words border-b border-emerald-200 py-2 text-center text-sm text-blue-700">{button.text}</p>)}</div>}
        </div>
      </div>
      {incomplete && <p role="status" className="text-xs text-amber-800">Preencha as variáveis para completar a mensagem.</p>}
    </section>
  );
}
