import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  getCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany
} from '../controllers/companyController';

const router = Router();

// All company routes require authentication
router.use(authenticateUser);

// GET /companies - Get all companies for authenticated user
router.get('/', getCompanies);

// POST /companies - Create a new company
router.post('/', createCompany);

// GET /companies/:id - Get a specific company
router.get('/:id', getCompanyById);

// PATCH /companies/:id - Update a company
router.patch('/:id', updateCompany);

// DELETE /companies/:id - Delete a company
router.delete('/:id', deleteCompany);

export default router;
