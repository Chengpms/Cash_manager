import {
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Home,
  ShoppingCart,
  Car,
  Utensils,
  Heart,
  Gift,
  Briefcase,
  Zap,
  Film,
  Plane,
  BookOpen,
  Coffee,
  Tag,
  Landmark,
  Banknote,
  GraduationCap,
  Dumbbell,
  Shirt,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { AccountType } from "../types";

export const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
  "trending-up": TrendingUp,
  home: Home,
  "shopping-cart": ShoppingCart,
  car: Car,
  utensils: Utensils,
  heart: Heart,
  gift: Gift,
  briefcase: Briefcase,
  zap: Zap,
  film: Film,
  plane: Plane,
  book: BookOpen,
  coffee: Coffee,
  tag: Tag,
  landmark: Landmark,
  banknote: Banknote,
  graduation: GraduationCap,
  fitness: Dumbbell,
  clothing: Shirt,
  tech: Smartphone,
};

export function getIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Tag;
  return ICON_MAP[name] || Tag;
}

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export const ACCOUNT_ICON_OPTIONS = [
  "wallet",
  "piggy-bank",
  "credit-card",
  "landmark",
  "trending-up",
  "banknote",
];

export const COLOR_OPTIONS = [
  "#E8703A",
  "#C1503A",
  "#D3A048",
  "#5B7F5E",
  "#8A6B4F",
  "#B4846B",
  "#6E8B74",
  "#2B1B12",
];

export const CATEGORY_CHART_PALETTE = [
  "#E8703A",
  "#D3A048",
  "#5B7F5E",
  "#C1503A",
  "#8A6B4F",
  "#6E8B74",
  "#B4846B",
  "#A87A2E",
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Cuenta corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  credit: "Tarjeta de crédito",
  investment: "Inversión",
};

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Ahorros" },
  { value: "cash", label: "Efectivo" },
  { value: "credit", label: "Tarjeta de crédito" },
  { value: "investment", label: "Inversión" },
];

export const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "MXN", "ARS", "COP"];
