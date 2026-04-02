import { success } from '../middleware/response.js';
import { createMedicineEvent as createMedicineEventService, getTodayDoseSlots } from '../services/medicineService.js';

export async function createMedicineEvent(req, res) {
  const result = await createMedicineEventService(req.user.openid, req.body, req.traceId);
  return success(res, result);
}

export async function fetchTodayDoseSlots(req, res) {
  const result = await getTodayDoseSlots(req.user.openid, req.query);
  return success(res, result);
}
