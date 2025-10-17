import { Router } from 'express';
import { kelly, coverProbability } from '../controllers/calcController';
import { addTokens, getUserInfo } from '../controllers/tokenController';
import authenticateUser from '../middleware/auth';
import checkTokens from '../middleware/checkTokens';

const router = Router();

router.post('/kelly', authenticateUser, checkTokens, kelly);
router.post('/cover', authenticateUser, checkTokens, coverProbability);
router.post('/token/add', authenticateUser, addTokens);
router.get('/user', authenticateUser, getUserInfo);

export default router;
