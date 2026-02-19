// server/src/controllers/wizard.js

/**
 * POST /api/v1/wizard/start
 * Start a new wizard session and create a draft brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function startWizard(req, res) {
  // TODO: Implement -- create brand in draft status, return brand + wizard state
  res.status(201).json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * GET /api/v1/wizard/:brandId/state
 * Get the current wizard state for a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getWizardState(req, res) {
  // TODO: Implement -- fetch wizard state from brands table
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * PATCH /api/v1/wizard/:brandId/step
 * Save wizard step data (partial save).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function saveStepData(req, res) {
  // TODO: Implement -- update wizard_state JSONB column
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/wizard/:brandId/analyze-social
 * Queue social media analysis via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function analyzeSocial(req, res) {
  // TODO: Implement -- queue social analysis BullMQ job
  res.status(202).json({
    success: true,
    data: { message: 'Not implemented yet' },
  });
}

/**
 * POST /api/v1/wizard/:brandId/generate-identity
 * Queue brand identity generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function generateIdentity(req, res) {
  // TODO: Implement -- queue brand identity generation BullMQ job
  res.status(202).json({
    success: true,
    data: { message: 'Not implemented yet' },
  });
}

/**
 * POST /api/v1/wizard/resume
 * Resume a wizard session from an HMAC-signed token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function resumeWizard(req, res) {
  // TODO: Implement -- verify HMAC token, return wizard state
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}

/**
 * POST /api/v1/wizard/:brandId/complete
 * Mark the wizard as complete, finalize the brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function completeWizard(req, res) {
  // TODO: Implement -- update brand status to active, send confirmation email
  res.json({ success: true, data: { message: 'Not implemented yet' } });
}
