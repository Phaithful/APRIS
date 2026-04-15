import {
  analyticsRiskTrend,
  analyticsMortalityTrend,
  analyticsDiseaseFrequency,
  analyticsSummary,
} from './api.js';

export const getRiskTrend = async (farmId, days) => {
  const response = await analyticsRiskTrend(farmId, days);
  return response.data;
};

export const getMortalityTrend = async (params) => {
  const response = await analyticsMortalityTrend(params);
  return response.data;
};

export const getDiseaseFrequency = async (farmId, days) => {
  const response = await analyticsDiseaseFrequency(farmId, days);
  return response.data;
};

export const getSummary = async (farmId) => {
  const response = await analyticsSummary(farmId);
  return response.data;
};
