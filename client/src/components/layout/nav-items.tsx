import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Palette,
  Settings,
  ShieldCheck,
  Users,
  Package,
  ShoppingBag,
  Activity,
  Building2,
  Layers,
  Crown,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

export const dashboardNav: NavItem[] = [
  { label: 'My Brands', path: ROUTES.DASHBOARD_BRANDS, icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Create Brand', path: ROUTES.WIZARD, icon: <Palette className="h-4 w-4" /> },
  { label: 'Products', path: ROUTES.DASHBOARD_PRODUCTS, icon: <ShoppingBag className="h-4 w-4" /> },
  { label: 'Organization', path: ROUTES.DASHBOARD_ORGANIZATION, icon: <Building2 className="h-4 w-4" /> },
  { label: 'Settings', path: ROUTES.DASHBOARD_SETTINGS, icon: <Settings className="h-4 w-4" /> },
];

export const adminNav: NavItem[] = [
  { label: 'Users', path: ROUTES.ADMIN_USERS, icon: <Users className="h-4 w-4" /> },
  { label: 'Products', path: ROUTES.ADMIN_PRODUCTS, icon: <Package className="h-4 w-4" /> },
  { label: 'Product Tiers', path: ROUTES.ADMIN_PRODUCT_TIERS, icon: <Crown className="h-4 w-4" /> },
  { label: 'Templates', path: ROUTES.ADMIN_TEMPLATES, icon: <Layers className="h-4 w-4" /> },
  { label: 'Jobs', path: ROUTES.ADMIN_JOBS, icon: <Activity className="h-4 w-4" /> },
];

export const adminLinkItem: NavItem = {
  label: 'Admin Panel',
  path: ROUTES.ADMIN,
  icon: <ShieldCheck className="h-4 w-4" />,
};
