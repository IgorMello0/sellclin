import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, X, BarChart2, Calendar, Target, Zap } from 'lucide-react';

const produtoLinks = [
  {
    to: '/funcionalidades/funil',
    label: 'Funil de Vendas',
    desc: 'Gestão visual do seu pipeline em tempo real.',
  },
  {
    to: '/funcionalidades/agenda',
    label: 'Agenda Inteligente',
    desc: 'Controle total de consultas e confirmações.',
  },
  {
    to: '/funcionalidades/metas',
    label: 'Engenharia de Metas',
    desc: 'Cálculo reverso para previsibilidade de lucro.',
  },
  {
    to: '/funcionalidades/campanhas',
    label: 'Campanhas & Disparos',
    desc: 'Envios em massa via WhatsApp.',
  },
];

export const SiteNavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProdutoOpen, setIsProdutoOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Páginas com fundo escuro no hero — logo e links ficam brancos no topo
  const darkHeroPages = ['/funcionalidades/funil', '/funcionalidades/metas', '/funcionalidades/campanhas'];
  const isDarkHero = darkHeroPages.includes(location.pathname);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProdutoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fecha o menu mobile ao mudar de rota
  useEffect(() => {
    setIsMenuOpen(false);
    setIsProdutoOpen(false);
  }, [location.pathname]);

  const isLight = scrolled || (!isDarkHero);
  const textColor = isLight ? 'text-[#0F172A]/70 hover:text-[#0F172A]' : 'text-white/70 hover:text-white';
  const activeTextColor = isLight ? 'text-[#0F172A]' : 'text-white';
  const logoFilter = isLight ? '' : 'brightness-0 invert';

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'py-3 bg-white/95 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_1px_20px_rgba(15,23,42,0.06)]'
            : isDarkHero
            ? 'py-7 bg-transparent'
            : 'py-7 bg-white/0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          
          {/* LEFT — Logo */}
          <Link to="/" className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity">
            <img
              src="/logo-site.png"
              alt="SellClin"
              className={`h-7 w-auto object-contain translate-y-0.5 transition-all duration-300 ${logoFilter}`}
            />
          </Link>

          {/* CENTER — Navigation links (desktop) */}
          <div className="hidden lg:flex items-center gap-1">
            
            {/* Produto dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProdutoOpen(!isProdutoOpen)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${textColor} ${isProdutoOpen ? (isLight ? 'bg-slate-50 text-[#0F172A]' : 'bg-white/10 text-white') : 'hover:bg-slate-50/60'}`}
              >
                Produto
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-300 ${isProdutoOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown panel */}
              {isProdutoOpen && (
                <div className="absolute top-full left-0 mt-3 w-[280px] bg-white rounded-lg border border-slate-100 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1.5 space-y-0.5">
                    {produtoLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setIsProdutoOpen(false)}
                        className="block px-4 py-3 rounded-md hover:bg-slate-50 group transition-all"
                      >
                        <div className="text-[13px] font-bold text-[#0F172A] group-hover:text-[#F97316] transition-colors mb-0.5">{link.label}</div>
                        <div className="text-[11px] text-slate-400 font-medium leading-tight group-hover:text-slate-500 transition-colors">{link.desc}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Static links */}
            <Link to="/precos" className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50/60 ${location.pathname === '/precos' ? activeTextColor + ' font-bold' : textColor}`}>
              Preços
            </Link>
            <Link to="/clientes" className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50/60 ${location.pathname === '/clientes' ? activeTextColor + ' font-bold' : textColor}`}>
              Clientes
            </Link>
            <Link to="/sobre" className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50/60 ${location.pathname === '/sobre' ? activeTextColor + ' font-bold' : textColor}`}>
              Sobre
            </Link>
            <Link to="/perguntas-frequentes" className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50/60 ${location.pathname === '/perguntas-frequentes' ? activeTextColor + ' font-bold' : textColor}`}>
              FAQ
            </Link>
          </div>

          {/* RIGHT — CTA buttons (desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/entrar"
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all ${textColor}`}
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="group relative overflow-hidden bg-[#0F172A] text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-500 flex items-center gap-2.5 hover:scale-105 active:scale-95 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.5)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]"
            >
              <span className="absolute -inset-[1px] bg-[#F97316] translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-500 ease-out z-0 rounded-full" />
              <span className="relative flex items-center gap-2 z-10">
                Começar Grátis
                <ArrowRight size={13} className="text-[#F97316] group-hover:text-white group-hover:translate-x-0.5 transition-all duration-500" />
              </span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`lg:hidden p-2 rounded-xl transition-colors ${isLight ? 'text-[#0F172A] hover:bg-slate-50' : 'text-white hover:bg-white/10'}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          
          {/* Panel */}
          <div className="absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <img src="/logo-site.png" alt="SellClin" className="h-6 w-auto" />
              <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] px-3 mb-3">Produto</p>
              {produtoLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3.5 py-4 rounded-lg hover:bg-slate-50 group transition-colors"
                >
                  <div className="text-sm font-bold text-[#0F172A]/80 group-hover:text-[#F97316] transition-colors mb-0.5">
                    {link.label}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium leading-tight">
                    {link.desc}
                  </div>
                </Link>
              ))}

              <div className="h-px bg-slate-100 my-4" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] px-3 mb-3">Empresa</p>
              {[
                { to: '/precos', label: 'Preços' },
                { to: '/clientes', label: 'Clientes' },
                { to: '/sobre', label: 'Sobre' },
                { to: '/perguntas-frequentes', label: 'FAQ' },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="block px-3 py-3 text-sm font-semibold text-[#0F172A]/70 hover:text-[#0F172A] hover:bg-slate-50 rounded-xl transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="px-4 pb-8 pt-4 border-t border-slate-100 space-y-3">
              <Link to="/entrar" className="block w-full text-center py-3 rounded-full text-sm font-bold text-[#0F172A] border border-slate-200 hover:border-slate-300 transition-colors">
                Entrar
              </Link>
              <Link to="/cadastro" className="block w-full text-center py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] bg-[#F97316] text-white hover:bg-orange-500 transition-colors shadow-lg shadow-orange-200">
                Começar Grátis
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SiteNavbar;
