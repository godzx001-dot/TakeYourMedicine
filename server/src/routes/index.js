import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createMedicineEvent, fetchTodayDoseSlots } from '../controllers/medicineController.js';
import { fetchNotificationEmail, updateNotificationEmail } from '../controllers/userController.js';
import { wechatLogin, verifyWechatProfile } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.post('/api/v1/auth/wechat-login', asyncHandler(wechatLogin));
router.post('/api/v1/auth/wechat-verify-profile', asyncHandler(verifyWechatProfile));

router.use(authMiddleware);

router.post('/api/v1/medicine-events', asyncHandler(createMedicineEvent));
router.get('/api/v1/dose-slots/today', asyncHandler(fetchTodayDoseSlots));
router.get('/api/v1/users/me/notification-email', asyncHandler(fetchNotificationEmail));
router.put('/api/v1/users/me/notification-email', asyncHandler(updateNotificationEmail));

export default router;
