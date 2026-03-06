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
  Image as ImageIcon,
  Fingerprint,
  BarChart3,
  Store,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

/** Shown when user has no active brand or is on the brands list page */
export const globalNav: NavItem[] = [
  { label: 'Overview', path: ROUTES.DASHBOARD, icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Brands', path: ROUTES.DASHBOARD_BRANDS, icon: <Layers className="h-4 w-4" /> },
  { label: 'Create Brand', path: ROUTES.WIZARD, icon: <Palette className="h-4 w-4" /> },
];

/** Brand-scoped navigation — shown when an active brand is selected */
export function brandScopedNav(brandId: string): NavItem[] {
  return [
    { label: 'Overview', path: ROUTES.DASHBOARD, icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Identity', path: ROUTES.DASHBOARD_BRAND_IDENTITY(brandId), icon: <Fingerprint className="h-4 w-4" /> },
    { label: 'Logos', path: ROUTES.DASHBOARD_BRAND_LOGOS(brandId), icon: <ImageIcon className="h-4 w-4" /> },
    { label: 'Products', path: ROUTES.DASHBOARD_BRAND_PRODUCTS(brandId), icon: <ShoppingBag className="h-4 w-4" /> },
    { label: 'Mockups', path: ROUTES.DASHBOARD_BRAND_MOCKUPS(brandId), icon: <Package className="h-4 w-4" /> },
    { label: 'Analytics', path: ROUTES.DASHBOARD_BRAND_ANALYTICS(brandId), icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Storefront', path: ROUTES.DASHBOARD_STOREFRONT, icon: <Store className="h-4 w-4" /> },
  ];
}

/** Account-level nav items (always shown below a divider) */
export const accountNav: NavItem[] = [
  { label: 'All Brands', path: ROUTES.DASHBOARD_BRANDS, icon: <Layers className="h-4 w-4" /> },
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
