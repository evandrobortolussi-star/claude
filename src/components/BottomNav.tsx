'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

// Each item owns a set of route prefixes beyond its own landing page — the
// active tab is whichever item has the LONGEST matching prefix, so e.g.
// /import/review resolves to Movimentações while /import and /import/rules
// resolve to Configurações, even though all three start with "/import".
const items = [
  { href: '/dashboard', label: 'Início', icon: '🏠', prefixes: ['/dashboard'] },
  {
    href: '/movimentacoes',
    label: 'Movimentações',
    icon: '📋',
    prefixes: ['/movimentacoes', '/transactions', '/import/review'],
  },
  {
    href: '/contas',
    label: 'Contas',
    icon: '🏦',
    prefixes: ['/contas', '/accounts', '/cards', '/investments', '/loans', '/transfers'],
  },
  { href: '/relatorios', label: 'Relatórios', icon: '📊', prefixes: ['/relatorios'] },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: '⚙️',
    prefixes: ['/configuracoes', '/profile', '/import'],
  },
];

function bestMatchIndex(pathname: string): number {
  let bestIndex = -1;
  let bestLength = -1;
  items.forEach((item, index) => {
    for (const prefix of item.prefixes) {
      if ((pathname === prefix || pathname.startsWith(prefix + '/')) && prefix.length > bestLength) {
        bestLength = prefix.length;
        bestIndex = index;
      }
    }
  });
  return bestIndex;
}

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = bestMatchIndex(pathname);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 md:max-w-2xl lg:max-w-3xl">
        {items.map((item, index) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-0.5 py-2.5 text-center text-[10px] font-medium leading-tight',
                index === activeIndex ? 'text-brand-600' : 'text-slate-400',
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
