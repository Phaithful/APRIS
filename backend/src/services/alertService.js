const pool = require('../db/db');

async function createAlert({ userId, farmId, flockId, assessmentId, imageId, type, severity, title, message }) {
  await pool.query(
    `INSERT INTO alerts (user_id, farm_id, flock_id, assessment_id, image_id, type, severity, title, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [userId, farmId, flockId, assessmentId, imageId, type, severity, title, message]
  );
}

async function generateAssessmentAlert({ userId, farmId, flockId, assessmentId, riskLevel, farmName, flockName }) {
  if (riskLevel === 'critical') {
    await createAlert({
      userId, farmId, flockId, assessmentId,
      type: 'critical_risk',
      severity: 'critical',
      title: 'Critical Risk Detected',
      message: `Farm "${farmName}" — Flock "${flockName || 'Unknown'}" has been assessed at CRITICAL risk level. Immediate action required.`,
    });
  } else if (riskLevel === 'high') {
    await createAlert({
      userId, farmId, flockId, assessmentId,
      type: 'high_risk',
      severity: 'high',
      title: 'High Risk Detected',
      message: `Farm "${farmName}" — Flock "${flockName || 'Unknown'}" has been assessed at HIGH risk level. Review mitigation actions.`,
    });
  }
}

async function generateImageAlert({ userId, farmId, flockId, imageId, predictedDisease, farmName }) {
  const diseaseAlerts = {
    ncd: {
      type: 'image_disease',
      severity: 'critical',
      title: 'Newcastle Disease Detected — Critical',
      message: `Dropping image analysis detected Newcastle Disease on farm "${farmName}". Quarantine the flock immediately.`,
    },
    coccidiosis: {
      type: 'image_disease',
      severity: 'high',
      title: 'Coccidiosis Detected',
      message: `Dropping image analysis detected Coccidiosis on farm "${farmName}". Administer anticoccidial medication.`,
    },
    salmonella: {
      type: 'image_disease',
      severity: 'high',
      title: 'Salmonella Detected',
      message: `Dropping image analysis detected Salmonella on farm "${farmName}". Isolate affected birds and contact your vet.`,
    },
  };

  const alertData = diseaseAlerts[predictedDisease];
  if (alertData) {
    await createAlert({ userId, farmId, flockId, imageId, ...alertData });
  }
}

async function generateMortalityAlert({ userId, farmId, flockId, farmName, flockName, rate }) {
  await createAlert({
    userId, farmId, flockId,
    type: 'mortality',
    severity: 'warning',
    title: 'Mortality Rate Increase',
    message: `Farm "${farmName}" — Flock "${flockName || 'Unknown'}" mortality rate is ${rate.toFixed(1)}%, exceeding the 2% threshold.`,
  });
}

module.exports = {
  createAlert,
  generateAssessmentAlert,
  generateImageAlert,
  generateMortalityAlert,
};
