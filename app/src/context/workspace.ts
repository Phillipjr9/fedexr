import { createContext, useContext } from 'react';
import type {
  AddressInput,
  PlanInput,
  PublicShipment,
  PublicShipmentInput,
  PublicShipmentUpdateInput,
  ShipmentPlan,
  WorkspaceAddress,
  WorkspaceData,
  WorkspaceRole,
  WorkspaceUser,
} from '@/lib/workspace';

type Result<T = void> = T | Promise<T>;
export interface WorkspaceContextValue {
  mode: 'browser' | 'server';
  loading: boolean;
  serviceError: string;
  data: WorkspaceData;
  user: WorkspaceUser | null;
  signIn: (email: string, passphrase: string, role?: WorkspaceRole) => Promise<void>;
  register: (
    name: string,
    email: string,
    passphrase: string,
    owner?: boolean,
  ) => Promise<void | { requiresVerification: boolean }>;
  signOut: () => Result;
  saveAddress: (input: AddressInput, id?: string) => Result<WorkspaceAddress>;
  removeAddress: (id: string) => Result;
  setDefaultAddress: (id: string) => Result;
  savePlan: (input: PlanInput, id?: string) => Result<ShipmentPlan>;
  updatePlanStatus: (id: string, status: ShipmentPlan['status']) => Result;
  removePlan: (id: string) => Result;
  savePublicShipment: (input: PublicShipmentInput, id?: string) => Result<PublicShipment>;
  importPublicShipments: (
    shipments: PublicShipment[],
  ) => Result<{ imported: number; skipped: { trackingNumber: string; reason: string }[] }>;
  addPublicShipmentUpdate: (id: string, input: PublicShipmentUpdateInput) => Result;
  updatePublicShipmentEvent: (
    id: string,
    eventId: string,
    input: PublicShipmentUpdateInput,
  ) => Result;
  removePublicShipmentEvent: (id: string, eventId: string) => Result;
  undoPublicShipmentUpdate: (id: string) => Result;
  savePublicShipmentInternalNote: (id: string, note: string) => Result;
  setPublicShipmentAutoProgress: (
    id: string,
    enabled: boolean,
    intervalMinutes: number,
  ) => Result;
  setPublicShipmentArchived: (id: string, archived: boolean) => Result;
  setPublicShipmentVisibility: (id: string, isPublic: boolean) => Result;
  duplicatePublicShipment: (id: string) => Result<PublicShipment>;
  removePublicShipment: (id: string) => Result;
  lookupPublicShipment: (trackingNumber: string) => Promise<PublicShipment | null>;
  updateProfile: (name: string, email: string) => Result<string | void>;
  changePassphrase: (current: string, next: string, confirmation: string) => Promise<void>;
  setUserStatus: (id: string, status: WorkspaceUser['status']) => Result;
  saveSettings: (name: string, announcements: string) => Result;
  clearLegacyAccess: () => void;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is required.');
  return context;
}
