import { supabaseAdmin } from '../config/supabase';
import { Company, CreateCompanyRequest } from '../types';

/**
 * Get all companies owned by a specific user
 */
export const getCompaniesByOwner = async (ownerUserId: string): Promise<Company[]> => {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  return data || [];
};

/**
 * Create a new company
 */
export const createCompany = async (
  companyData: CreateCompanyRequest,
  ownerUserId: string
): Promise<Company> => {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .insert({
      name: companyData.name,
      logo_url: companyData.logo_url || null,
      owner_user_id: ownerUserId
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`);
  }

  return data;
};

/**
 * Get a specific company by ID (with ownership validation)
 */
export const getCompanyById = async (
  companyId: string,
  ownerUserId: string
): Promise<Company | null> => {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_user_id', ownerUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch company: ${error.message}`);
  }

  return data;
};

/**
 * Update a company (with ownership validation)
 */
export const updateCompany = async (
  companyId: string,
  ownerUserId: string,
  updates: Partial<CreateCompanyRequest>
): Promise<Company> => {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.logo_url !== undefined && { logo_url: updates.logo_url })
    })
    .eq('id', companyId)
    .eq('owner_user_id', ownerUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update company: ${error.message}`);
  }

  return data;
};

/**
 * Delete a company (with ownership validation)
 */
export const deleteCompany = async (
  companyId: string,
  ownerUserId: string
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('companies')
    .delete()
    .eq('id', companyId)
    .eq('owner_user_id', ownerUserId);

  if (error) {
    throw new Error(`Failed to delete company: ${error.message}`);
  }
};
