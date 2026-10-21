import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from '@/context/workspace';
import { AccountApiError, accountRequest } from '@/lib/accountApi';
import {
  emptyWorkspace,
  type WorkspaceData,
  type WorkspaceUser,
  type WorkspaceRole,
  type AddressInput,
  type PlanInput,
  type PublicShipment,
  type PublicShipmentInput,
  type PublicShipmentUpdateInput,
  type ShipmentPlan,
} from '@/lib/workspace';
import { normalizeTrackingNumber } from '@/lib/publicShipments';

type Snapshot = {
  user: WorkspaceUser;
  data: WorkspaceData;
  id?: string;
  notice?: string;
  imported?: number;
  skipped?: { trackingNumber: string; reason: string }[];
};
const channelName = 'fedexr:server-account-change';
export default function ServerWorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyWorkspace);
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const generation = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const commit = useCallback((result: Snapshot | null) => {
    setUser(result?.user || null);
    setData(result?.data || emptyWorkspace());
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const revision = ++generation.current;
      try {
        const next = await accountRequest<Snapshot>('/api/workspace', 'GET', undefined, signal);
        if (revision === generation.current) {
          commit(next);
          setServiceError('');
        }
        return next;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return null;
        if (revision !== generation.current) return null;
        commit(null);
        if (cause instanceof AccountApiError && cause.status === 401) {
          setServiceError('');
          return null;
        }
        setServiceError(
          cause instanceof Error ? cause.message : 'The account service is unavailable.',
        );
        return null;
      } finally {
        if (!signal?.aborted && revision === generation.current) setLoading(false);
      }
    },
    [commit],
  );
  function broadcast() {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage('refresh');
      channel.close();
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const update = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
    if (channel)
      channel.onmessage = () => {
        void refresh();
      };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      controller.abort();
      channel?.close();
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  async function mutate(path: string, method: string, body: unknown = {}) {
    const task = writes.current.then(async () => {
      ++generation.current;
      try {
        const next = await accountRequest<Snapshot>(`/api/workspace${path}`, method, body);
        ++generation.current;
        commit(next);
        setServiceError('');
        broadcast();
        return next;
      } catch (cause) {
        if (cause instanceof AccountApiError && cause.status === 401) {
          ++generation.current;
          commit(null);
          broadcast();
        }
        throw cause;
      }
    });
    writes.current = task.catch(() => {});
    return task;
  }

  async function signOut() {
    ++generation.current;
    await accountRequest('/api/auth/sign-out', 'POST', {});
    ++generation.current;
    commit(null);
    setServiceError('');
    broadcast();
  }
  async function signIn(email: string, passphrase: string, role?: WorkspaceRole) {
    await accountRequest('/api/auth/sign-in/email', 'POST', {
      email: email.trim().toLowerCase(),
      password: passphrase,
    });
    const next = await refresh();
    if (!next)
      throw new Error(
        'Sign-in could not be confirmed. Check the account service and email verification.',
      );
    if (role === 'admin' && next.user.role !== 'admin') {
      await signOut();
      throw new Error('This account does not have permission for that action.');
    }
    broadcast();
  }
  async function register(name: string, email: string, passphrase: string, owner = false) {
    if (owner)
      throw new Error('Elevated roles must be assigned by a trusted server operator.');
    await accountRequest('/api/auth/sign-up/email', 'POST', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: passphrase,
      callbackURL: `${window.location.origin}/login?verified=1`,
    });
    return { requiresVerification: true };
  }
  async function saveAddress(input: AddressInput, id?: string) {
    const next = await mutate(
      `/addresses${id ? `/${encodeURIComponent(id)}` : ''}`,
      id ? 'PUT' : 'POST',
      input,
    );
    const record = next.data.addresses.find((entry) => entry.id === next.id);
    if (!record)
      throw new Error('The saved address could not be read back. Refresh your workspace.');
    return record;
  }
  async function savePlan(input: PlanInput, id?: string) {
    const next = await mutate(
      `/plans${id ? `/${encodeURIComponent(id)}` : ''}`,
      id ? 'PUT' : 'POST',
      input,
    );
    const record = next.data.plans.find((entry) => entry.id === next.id);
    if (!record) throw new Error('The saved plan could not be read back. Refresh your workspace.');
    return record;
  }
  async function savePublicShipment(input: PublicShipmentInput, id?: string) {
    const next = await mutate(
      `/shipments${id ? `/${encodeURIComponent(id)}` : ''}`,
      id ? 'PUT' : 'POST',
      input,
    );
    const record = next.data.shipments.find((entry) => entry.id === next.id);
    if (!record)
      throw new Error('The public shipment could not be read back. Refresh your workspace.');
    return record;
  }
  async function importPublicShipments(shipments: PublicShipment[]) {
    const next = await mutate('/shipments/import', 'POST', { shipments });
    return {
      imported: Number(next.imported) || 0,
      skipped: Array.isArray(next.skipped) ? next.skipped : [],
    };
  }
  async function lookupPublicShipment(trackingNumber: string) {
    const normalized = normalizeTrackingNumber(trackingNumber);
    if (!normalized) return null;
    try {
      const result = await accountRequest<{ shipment: PublicShipment }>(
        `/api/tracking/${encodeURIComponent(normalized)}`,
        'GET',
      );
      return result.shipment;
    } catch (cause) {
      if (cause instanceof AccountApiError && cause.status === 404) return null;
      throw cause;
    }
  }
  async function changePassphrase(current: string, next: string, confirmation: string) {
    if (next !== confirmation || next.length < 10 || next.length > 128)
      throw new Error('Use matching workspace passphrases from 10 to 128 characters.');
    await accountRequest('/api/workspace/passphrase', 'PUT', { current, next, confirmation });
    await refresh();
    broadcast();
  }
  const value: WorkspaceContextValue = {
    mode: 'server',
    loading,
    serviceError,
    data,
    user,
    signIn,
    signOut,
    register,
    saveAddress,
    savePlan,
    savePublicShipment,
    importPublicShipments,
    addPublicShipmentUpdate: async (id: string, input: PublicShipmentUpdateInput) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/updates`, 'POST', input);
    },
    updatePublicShipmentEvent: async (
      id: string,
      eventId: string,
      input: PublicShipmentUpdateInput,
    ) => {
      await mutate(
        `/shipments/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
        'PUT',
        input,
      );
    },
    removePublicShipmentEvent: async (id: string, eventId: string) => {
      await mutate(
        `/shipments/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
        'DELETE',
      );
    },
    undoPublicShipmentUpdate: async (id: string) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/undo`, 'POST');
    },
    savePublicShipmentInternalNote: async (id: string, note: string) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/internal-note`, 'PATCH', { note });
    },
    setPublicShipmentAutoProgress: async (
      id: string,
      enabled: boolean,
      intervalMinutes: number,
    ) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/auto-progress`, 'PATCH', {
        enabled,
        intervalMinutes,
      });
    },
    setPublicShipmentArchived: async (id: string, archived: boolean) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/archive`, 'PATCH', { archived });
    },
    setPublicShipmentVisibility: async (id: string, isPublic: boolean) => {
      await mutate(`/shipments/${encodeURIComponent(id)}/visibility`, 'PATCH', { isPublic });
    },
    duplicatePublicShipment: async (id: string) => {
      const next = await mutate(`/shipments/${encodeURIComponent(id)}/duplicate`, 'POST');
      const record = next.data.shipments.find((entry) => entry.id === next.id);
      if (!record)
        throw new Error('The duplicated shipment could not be read back. Refresh your workspace.');
      return record;
    },
    removePublicShipment: async (id) => {
      await mutate(`/shipments/${encodeURIComponent(id)}`, 'DELETE');
    },
    lookupPublicShipment,
    changePassphrase,
    removeAddress: async (id) => {
      await mutate(`/addresses/${encodeURIComponent(id)}`, 'DELETE');
    },
    setDefaultAddress: async (id) => {
      await mutate(`/addresses/${encodeURIComponent(id)}/default`, 'PATCH');
    },
    updatePlanStatus: async (id: string, status: ShipmentPlan['status']) => {
      await mutate(`/plans/${encodeURIComponent(id)}/status`, 'PATCH', { status });
    },
    removePlan: async (id) => {
      await mutate(`/plans/${encodeURIComponent(id)}`, 'DELETE');
    },
    updateProfile: async (name, email) => {
      const next = await mutate('/profile', 'PUT', { name, email });
      return next.notice;
    },
    setUserStatus: async (id, status) => {
      await mutate(`/members/${encodeURIComponent(id)}/status`, 'PATCH', { status });
    },
    saveSettings: async (name, announcements) => {
      await mutate('/settings', 'PUT', { name, announcements });
    },
    clearLegacyAccess: () => {
      ['isAdmin', 'isLoggedIn', 'adminPassword'].forEach((key) => localStorage.removeItem(key));
    },
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
