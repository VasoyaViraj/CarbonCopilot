import { apiClient, type ApiSuccess } from './apiClient';

export interface Factory {
  id: number;
  organization_id: number;
  name: string;
  industry_type?: string;
  location?: string;
  production_capacity?: number;
  production_unit?: string;
}

export interface Process {
  id: number;
  factory_id: number;
  name: string;
  process_type?: string;
  description?: string;
}

export const factoryService = {
  getFactories: async () => {
    const res = await apiClient.get<ApiSuccess<Factory[]>>('/factories');
    return res.data;
  },
  getFactory: async (id: number) => {
    const res = await apiClient.get<ApiSuccess<Factory>>(`/factories/${id}`);
    return res.data;
  },
  createFactory: async (data: Partial<Factory>) => {
    const res = await apiClient.post<ApiSuccess<Factory>>('/factories', data);
    return res.data;
  },
  updateFactory: async (id: number, data: Partial<Factory>) => {
    const res = await apiClient.put<ApiSuccess<Factory>>(`/factories/${id}`, data);
    return res.data;
  },
  deleteFactory: async (id: number) => {
    const res = await apiClient.delete<ApiSuccess<{ deleted: boolean }>>(`/factories/${id}`);
    return res.data;
  },

  getProcesses: async (factoryId: number) => {
    const res = await apiClient.get<ApiSuccess<Process[]>>(`/factories/${factoryId}/processes`);
    return res.data;
  },
  createProcess: async (factoryId: number, data: Partial<Process>) => {
    const res = await apiClient.post<ApiSuccess<Process>>(`/factories/${factoryId}/processes`, data);
    return res.data;
  },
  updateProcess: async (factoryId: number, processId: number, data: Partial<Process>) => {
    const res = await apiClient.put<ApiSuccess<Process>>(`/factories/${factoryId}/processes/${processId}`, data);
    return res.data;
  },
  deleteProcess: async (factoryId: number, processId: number) => {
    const res = await apiClient.delete<ApiSuccess<{ deleted: boolean }>>(`/factories/${factoryId}/processes/${processId}`);
    return res.data;
  },
};
