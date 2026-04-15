import { alertsGet, alertDismiss, alertsMarkAllRead } from './api.js';

export const getAlerts = async (params) => {
  const response = await alertsGet(params);
  return response.data;
};

export const dismissAlert = async (id) => {
  const response = await alertDismiss(id);
  return response.data;
};

export const markAllRead = async () => {
  const response = await alertsMarkAllRead();
  return response.data;
};
