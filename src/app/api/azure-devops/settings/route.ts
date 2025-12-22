import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { encryptTokenForStorage, decryptTokenFromStorage } from '@/lib/jira-encryption-service'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'

/**
 * GET /api/azure-devops/settings
 * Get user's Azure DevOps integration settings (without decrypted PAT)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    const integration = await queryOne(
      `SELECT 
        id, user_id, organization, project, work_item_type, area_path, iteration_path,
        auto_sync_enabled, is_active, last_verified_at, created_at, updated_at
      FROM azure_devops_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json({
        success: true,
        integration: null
      })
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        organization: integration.organization,
        project: integration.project,
        workItemType: integration.work_item_type,
        areaPath: integration.area_path,
        iterationPath: integration.iteration_path,
        autoSyncEnabled: integration.auto_sync_enabled,
        isActive: integration.is_active,
        lastVerifiedAt: integration.last_verified_at,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at
      }
    })
  } catch (error) {
    console.error('Error fetching Azure DevOps settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Azure DevOps settings'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/azure-devops/settings
 * Save or update Azure DevOps integration settings
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { organization, project, pat, workItemType, areaPath, iterationPath, autoSyncEnabled } = body

    // Check if integration already exists FIRST (before validation)
    const existing = await queryOne(
      'SELECT id, encrypted_pat FROM azure_devops_integrations WHERE user_id = $1',
      [user.userId]
    )

    // Validate required fields - pat only required for new integrations
    if (!organization || !project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: organization, project'
        },
        { status: 400 }
      )
    }

    // PAT is required for new integrations, but optional for updates
    if (!existing && !pat) {
      return NextResponse.json(
        {
          success: false,
          error: 'Personal Access Token is required for new integrations'
        },
        { status: 400 }
      )
    }

    let encryptedPat: string
    
    if (existing && !pat) {
      // If updating existing integration and no new PAT provided, keep existing encrypted PAT
      encryptedPat = existing.encrypted_pat
    } else if (pat) {
      // Encrypt new PAT
      encryptedPat = encryptTokenForStorage(pat)
    } else {
      // This should not happen due to validation above, but just in case
      return NextResponse.json(
        {
          success: false,
          error: 'Personal Access Token is required for new integrations'
        },
        { status: 400 }
      )
    }

    if (existing) {
      // Update existing integration - ensure is_active is set to true
      await query(
        `UPDATE azure_devops_integrations 
        SET organization = $1, project = $2, encrypted_pat = $3,
            work_item_type = $4, area_path = $5, iteration_path = $6, auto_sync_enabled = $7,
            is_active = true, updated_at = NOW()
        WHERE user_id = $8`,
        [
          organization, 
          project, 
          encryptedPat, 
          workItemType || 'Bug', 
          areaPath || null, 
          iterationPath || null, 
          autoSyncEnabled ?? false, 
          user.userId
        ]
      )
    } else {
      // Create new integration - set is_active to true
      await query(
        `INSERT INTO azure_devops_integrations 
        (user_id, organization, project, encrypted_pat, work_item_type, area_path, iteration_path, auto_sync_enabled, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [
          user.userId, 
          organization, 
          project, 
          encryptedPat, 
          workItemType || 'Bug', 
          areaPath || null, 
          iterationPath || null, 
          autoSyncEnabled ?? false
        ]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Azure DevOps integration saved successfully'
    })
  } catch (error) {
    console.error('Error saving Azure DevOps settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Azure DevOps settings'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/azure-devops/settings
 * Remove Azure DevOps integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    await query(
      'UPDATE azure_devops_integrations SET is_active = false, updated_at = NOW() WHERE user_id = $1',
      [user.userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Azure DevOps integration removed successfully'
    })
  } catch (error) {
    console.error('Error removing Azure DevOps integration:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove Azure DevOps integration'
      },
      { status: 500 }
    )
  }
}

