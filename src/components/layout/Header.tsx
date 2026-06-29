import { LocateFixed } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { AuthAccount } from '../../types';

interface HeaderProps {
  account: AuthAccount | null;
  viewMode: 'user' | 'admin';
  onToggleView: (mode: 'user' | 'admin') => void;
}

export function Header({ account, viewMode, onToggleView }: HeaderProps) {
  const isSuperAdmin = account?.role === 'super_admin';

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark">
          <LocateFixed size={24} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">DiSini! Surabaya</p>
          <h2>Direktori Perantau</h2>
        </div>
      </div>

      <div className="topbar-actions">
        {isSuperAdmin && (
          <nav className="view-switcher" aria-label="Mode tampilan">
            <button 
              className={`switch-btn ${viewMode === 'user' ? 'active' : ''}`}
              onClick={() => onToggleView('user')}
              type="button"
            >
              Mode User
            </button>
            <button 
              className={`switch-btn ${viewMode === 'admin' ? 'active' : ''}`}
              onClick={() => onToggleView('admin')}
              type="button"
            >
              Mode Admin
            </button>
          </nav>
        )}
        <div className="session-controls">
          {account && (
            <span className="session-pill">
              {account.username || 'User'}
            </span>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
