import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle } from 'lucide-react';

export const SiteFooter = () => {
  return (
    <footer className="py-8 bg-white border-t border-slate-100 relative overflow-hidden w-full">
      <div className="max-w-7xl mx-auto px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-4">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <img src="/logo-site.png" alt="SellClin" className="h-8 w-auto opacity-90" />
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xs">
              A infraestrutura comercial definitiva para a sua clínica. Transformamos leads em faturamento com inteligência e precisão.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#F97316] hover:border-[#F97316] transition-all cursor-pointer">
                <Instagram size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#F97316] hover:border-[#F97316] transition-all cursor-pointer">
                <MessageCircle size={14} />
              </a>
            </div>
          </div>

          {/* Column 2: Produto */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-[#0F172A] uppercase tracking-[0.3em]">Produto</h4>
            <ul className="space-y-2">
              <li><Link to="/funcionalidades/funil" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Funil de Vendas</Link></li>
              <li><Link to="/funcionalidades/agenda" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Agenda Inteligente</Link></li>
              <li><Link to="/funcionalidades/metas" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Engenharia de Metas</Link></li>
              <li><Link to="/precos" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Planos e Preços</Link></li>
            </ul>
          </div>

          {/* Column 3: Institucional */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-[#0F172A] uppercase tracking-[0.3em]">Institucional</h4>
            <ul className="space-y-2">
              <li><Link to="/sobre" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Sobre a SellClin</Link></li>
              <li><Link to="/clientes" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Nossos Clientes</Link></li>
              <li><Link to="/perguntas-frequentes" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">FAQ & Ajuda</Link></li>
              <li><a href="#" className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">Falar com Consultor</a></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-[#0F172A] uppercase tracking-[0.3em]">Legal</h4>
            <ul className="space-y-2">
              {[
                { label: "Termos de Uso", to: "/termos-de-uso" },
                { label: "Privacidade", to: "/politica-de-privacidade" },
                { label: "Cookies", to: "/politica-de-cookies" },
                { label: "Segurança", to: "/seguranca" },
              ].map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-slate-500 font-medium hover:text-[#F97316] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-50 flex flex-col md:flex-row items-center justify-center">
          <div className="text-[10px] font-black text-[#64748B] uppercase tracking-[0.3em]">
            © 2026 SellClin · CRM Especializado em Alto Ticket
          </div>
        </div>
      </div>
    </footer>
  );
};
