import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  createShareLink,
  getDocumentByLink,
  logLinkView,
  getLinkStats
} from '../controllers/linkController';

const router = Router();

// POST /links - Generate a new share link (requires authentication)
router.post('/', authenticateUser, createShareLink);

// GET /links/:linkId - Get document by link ID (public access)
router.get('/:linkId', getDocumentByLink);

// POST /links/:linkId/log - Log a view/open (public access)
router.post('/:linkId/log', logLinkView);

// GET /links/:linkId/stats - Get view count and last opened stats (public for now)
router.get('/:linkId/stats', getLinkStats);

export default router;
