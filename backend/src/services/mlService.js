const axios = require('axios');
const FormData = require('form-data');

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function checkMLService() {
  try {
    const { data } = await axios.get(`${ML_URL()}/health`, { timeout: 3000 });
    return data.status === 'ok';
  } catch {
    return false;
  }
}

async function callRiskPredict(featureVector) {
  const { data } = await axios.post(`${ML_URL()}/predict/risk`, featureVector, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return data;
}

async function callImagePredict(imageBuffer, mimetype, originalname) {
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: originalname || 'image.jpg',
    contentType: mimetype,
  });

  const { data } = await axios.post(`${ML_URL()}/predict/image`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  return data;
}

module.exports = { checkMLService, callRiskPredict, callImagePredict };
