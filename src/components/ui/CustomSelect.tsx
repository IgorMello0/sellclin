import React, { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
}

export const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  icon,
}: CustomSelectProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const selected = options.find((o) => o.value === value);

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
          !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Render outside animated/scrollable ancestors so navigation cannot cover the menu.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const below = Math.max(0, window.innerHeight - rect.bottom - margin * 2);
      const above = Math.max(0, rect.top - margin * 2);
      const desiredHeight = Math.min(224, menuRef.current?.scrollHeight || 224);
      const opensAbove = below < desiredHeight && above > below;
      const width = Math.min(rect.width, window.innerWidth - margin * 2);
      setPosition({
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        width,
        maxHeight: Math.min(224, opensAbove ? above : below),
        ...(opensAbove
          ? { bottom: window.innerHeight - rect.top + margin }
          : { top: rect.bottom + margin }),
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`
          w-full h-11 flex items-center gap-3 px-4 rounded-xl border text-sm font-medium
          transition-all duration-200 cursor-pointer text-left
          ${open
            ? 'border-accent ring-2 ring-accent/20 bg-background'
            : 'border-border bg-background hover:border-accent/50 hover:bg-muted/30'
          }
          ${selected ? 'text-foreground' : 'text-muted-foreground'}
        `}
      >
        {icon && (
          <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        )}
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      {/* Dropdown panel */}
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            style={position}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="
              fixed z-[1000]
              bg-card border border-border rounded-2xl shadow-xl shadow-black/10
              overflow-y-auto overscroll-contain
            "
          >
            <div className="py-1.5">
              {/* Placeholder option */}
              <button
                type="button"
                onClick={() => selectOption('')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <span className="w-4" />
                {placeholder}
              </button>

              {/* Divider */}
              <div className="h-px bg-border mx-3 my-1" />

              {options.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectOption(opt.value)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${isSelected
                        ? 'bg-primary/8 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted/60'
                      }
                    `}
                  >
                    <span className="w-4 flex-shrink-0">
                      {isSelected && <Check className="w-3.5 h-3.5 text-secondary" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
};
