'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const items = [
  { href: '/dashboard', label: 'Início', icon: '🏠' },
  { href: '/transactions', label: 'Lançamentos', icon: '📋' },
  { href: '/import', label: 'Importar', icon: '📥' },
  { href: '/investments', label: 'Investir', icon: '📈' },
  { href: '/profile', label: 'Perfil', icon: '👤' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 md:max-w-2xl lg:max-w-3xl">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                  active ? 'text-brand-600' : 'text-slate-400',
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
