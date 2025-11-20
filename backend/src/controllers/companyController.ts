import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateCompanyRequest } from '../types';
import * as companyService from '../services/companyService';

/**
 * GET /companies
 * Returns all companies belonging to the authenticated user
 */
export const getCompanies = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const companies = await companyService.getCompaniesByOwner(req.user.id);

    res.json({
      data: companies,
      count: companies.length
    });
  } catch (error) {
    console.error('Error in getCompanies:', error);
    res.status(500).json({
      error: 'Failed to fetch companies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST /companies
 * Creates a new company owned by the authenticated user
 */
export const createCompany = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name, logo_url }: CreateCompanyRequest = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Company name is required'
      });
    }

    const company = await companyService.createCompany(
      { name: name.trim(), logo_url },
      req.user.id
    );

    res.status(201).json({
      data: company,
      message: 'Company created successfully'
    });
  } catch (error) {
    console.error('Error in createCompany:', error);
    res.status(500).json({
      error: 'Failed to create company',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /companies/:id
 * Returns a specific company if owned by the authenticated user
 */
export const getCompanyById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    const company = await companyService.getCompanyById(id, req.user.id);

    if (!company) {
      return res.status(404).json({
        error: 'Company not found or access denied'
      });
    }

    res.json({ data: company });
  } catch (error) {
    console.error('Error in getCompanyById:', error);
    res.status(500).json({
      error: 'Failed to fetch company',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * PATCH /companies/:id
 * Updates a company if owned by the authenticated user
 */
export const updateCompany = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    const updates: Partial<CreateCompanyRequest> = req.body;

    // Validate at least one field is being updated
    if (!updates.name && updates.logo_url === undefined) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'At least one field (name or logo_url) must be provided'
      });
    }

    const company = await companyService.updateCompany(id, req.user.id, updates);

    res.json({
      data: company,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Error in updateCompany:', error);
    res.status(500).json({
      error: 'Failed to update company',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * DELETE /companies/:id
 * Deletes a company if owned by the authenticated user
 */
export const deleteCompany = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    await companyService.deleteCompany(id, req.user.id);

    res.json({
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCompany:', error);
    res.status(500).json({
      error: 'Failed to delete company',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
