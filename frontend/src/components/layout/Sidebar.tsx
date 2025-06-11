import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Upload,
  History
} from 'lucide-react';
import { ThemeToggleCompact } from '../common/theme';
import clsx from 'clsx';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    path: '/findings',
    label: 'Findings',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    path: '/upload',
    label: 'Upload',
    icon: <Upload className="w-5 h-5" />,
  },
  {
    path: '/history',
    label: 'History',
    icon: <History className="w-5 h-5" />,
  },
];

const bottomNavItems: NavItem[] = [
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  const location = useLocation();

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        clsx(
          styles.navItem,
          isActive && styles.active,
          collapsed && styles.collapsed
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      {!collapsed && (
        <>
          <span className={styles.navLabel}>{item.label}</span>
          {item.badge && (
            <span className={styles.navBadge}>{item.badge}</span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={clsx(
        styles.sidebar,
        collapsed && styles.collapsed,
        className
      )}
    >
      {/* Logo/Brand */}
      <div className={styles.brand}>
        <img 
          src="/icon.png" 
          alt="Scanalyzer" 
          className={styles.brandIcon}
        />
        {!collapsed && (
          <span className={styles.brandText}>Scanalyzer</span>
        )}
      </div>

      {/* Main Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {navItems.map(renderNavItem)}
        </div>

        {/* Bottom Section */}
        <div className={styles.navBottom}>
          <div className={styles.navSection}>
            {bottomNavItems.map(renderNavItem)}
          </div>

          {/* Theme Toggle */}
          <div className={styles.themeToggle}>
            <ThemeToggleCompact 
              className={clsx(
                styles.themeToggleButton,
                collapsed && styles.collapsed
              )}
            />
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={onToggle}
            className={styles.collapseToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
}