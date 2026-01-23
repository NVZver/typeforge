'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <Link href="/" className="logo">
        Type<span>Forge</span>
      </Link>
      <nav className="nav">
        <Link
          href="/"
          className={clsx('nav-link', pathname === '/' && 'active')}
        >
          Practice
        </Link>
        <Link
          href="/coach"
          className={clsx('nav-link', pathname === '/coach' && 'active')}
        >
          Coach
        </Link>
        <Link
          href="/settings"
          className={clsx('nav-link', pathname === '/settings' && 'active')}
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}
