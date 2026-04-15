import {
  farmsGet,
  farmsCreate,
  farmGet,
  farmUpdate,
  farmDelete,
  flocksGet,
  flockCreate,
  flockUpdate,
  flockDelete,
} from './api.js';

export const getFarms = async () => {
  const response = await farmsGet();
  return response.data;
};

export const createFarm = async (data) => {
  const response = await farmsCreate(data);
  return response.data;
};

export const getFarm = async (id) => {
  const response = await farmGet(id);
  return response.data;
};

export const updateFarm = async (id, data) => {
  const response = await farmUpdate(id, data);
  return response.data;
};

export const deleteFarm = async (id) => {
  const response = await farmDelete(id);
  return response.data;
};

export const getFlocks = async (farmId) => {
  const response = await flocksGet(farmId);
  return response.data;
};

export const createFlock = async (farmId, data) => {
  const response = await flockCreate(farmId, data);
  return response.data;
};

export const updateFlock = async (id, data) => {
  const response = await flockUpdate(id, data);
  return response.data;
};

export const deleteFlock = async (id) => {
  const response = await flockDelete(id);
  return response.data;
};
