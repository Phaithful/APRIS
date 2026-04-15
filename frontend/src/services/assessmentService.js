import { assessmentsCreate, assessmentsGet, assessmentGet, mitigationComplete } from './api.js';

export const createAssessment = async (data) => {
  const response = await assessmentsCreate(data);
  return response.data;
};

export const getAssessments = async (params) => {
  const response = await assessmentsGet(params);
  return response.data;
};

export const getAssessment = async (id) => {
  const response = await assessmentGet(id);
  return response.data;
};

export const completeMitigation = async (id) => {
  const response = await mitigationComplete(id);
  return response.data;
};
