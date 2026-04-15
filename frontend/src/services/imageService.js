import { imageAnalyse, imageHistoryGet } from './api.js';

export const analyseImage = async (formData) => {
  const response = await imageAnalyse(formData);
  return response.data;
};

export const getImageHistory = async (params) => {
  const response = await imageHistoryGet(params);
  return response.data;
};
