# Azure DevOps Integration Plan

## Overview
This document outlines the plan to integrate Azure DevOps with the accessibility scanning system, similar to the existing Jira integration. The integration will allow scan results to be automatically transferred to Azure DevOps work items in your project's backlog.

## Architecture

The integration will follow the same pattern as the Jira integration:

1. **Database Layer**: Store Azure DevOps integration credentials and work item mappings
2. **Client Layer**: Azure DevOps REST API client for authentication and API calls
3. **Mapping Layer**: Convert local issues to Azure DevOps work item format
4. **Sync Layer**: Auto-sync issues to Azure DevOps work items
5. **API Layer**: REST endpoints for settings management and work item creation
6. **UI Layer**: Settings page integration for configuration

## What We Need From You

### 1. Azure DevOps Organization Details
- **Organization Name**: Your Azure DevOps organization name (e.g., `myorg` in `https://dev.azure.com/myorg`)
- **Project Name**: The project where work items should be created
- **Area Path** (optional): The area path for work items (e.g., `MyProject\\Area\\Path`)
- **Iteration Path** (optional): The iteration/sprint path (e.g., `MyProject\\Iteration\\Sprint1`)

### 2. Authentication
- **Personal Access Token (PAT)**: 
  - Generate from: `https://dev.azure.com/{organization}/_usersSettings/tokens`
  - Required scopes:
    - `Work Items (Read & Write)` - To create and read work items
    - `Project and Team (Read)` - To access project information
  - The PAT will be encrypted and stored securely (same encryption as Jira tokens)

### 3. Work Item Configuration
- **Work Item Type**: The type of work item to create (e.g., `Bug`, `Task`, `User Story`, `Issue`)
- **Default Priority**: How to map our priority levels to Azure DevOps priority
  - Our priorities: `critical`, `high`, `medium`, `low`
  - Azure DevOps priorities: `1` (Critical), `2` (High), `3` (Medium), `4` (Low)

### 4. Field Mapping (Optional - we'll use defaults)
- **Title Field**: Will use issue rule name or description
- **Description Field**: Will include full issue details, remediation steps, screenshots
- **Tags**: Will add tags like `accessibility`, `a11y`, `wcag-{level}`
- **Custom Fields**: If you have custom fields you want populated, let us know

## Implementation Details

### Database Schema
- `azure_devops_integrations` table (similar to `jira_integrations`)
  - Stores: organization, project, PAT (encrypted), work item type, auto-sync settings
- `azure_devops_work_item_mappings` table (similar to `jira_ticket_mappings`)
  - Maps local issue IDs to Azure DevOps work item IDs
- Add columns to `issues` table:
  - `azure_devops_synced` (boolean)
  - `azure_devops_work_item_id` (string)
  - `azure_devops_sync_error` (text)

### Azure DevOps REST API Endpoints Used
- **Test Connection**: `GET https://dev.azure.com/{organization}/_apis/connectionData`
- **Get Projects**: `GET https://dev.azure.com/{organization}/_apis/projects`
- **Get Work Item Types**: `GET https://dev.azure.com/{organization}/{project}/_apis/wit/workitemtypes`
- **Create Work Item**: `POST https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/$Bug?api-version=7.1`
- **Get Work Item**: `GET https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{id}`

### Authentication
- Uses Basic Authentication with PAT
- Format: `Authorization: Basic {base64(username:token)}` or just `{base64(token)}`
- Azure DevOps accepts PAT as username with empty password, or just the token

### Work Item Format
Azure DevOps uses JSON Patch format for creating/updating work items:
```json
[
  {
    "op": "add",
    "path": "/fields/System.Title",
    "value": "Issue Title"
  },
  {
    "op": "add",
    "path": "/fields/System.Description",
    "value": "Issue description in HTML format"
  },
  {
    "op": "add",
    "path": "/fields/System.Tags",
    "value": "accessibility; a11y; wcag-aa"
  }
]
```

## Files to Create

1. **Database Migration**: `migrations/002_azure_devops_integration.sql`
2. **Client Library**: `src/lib/azure-devops-client.ts`
3. **Mapping Service**: `src/lib/azure-devops-mapping-service.ts`
4. **Sync Service**: `src/lib/azure-devops-sync-service.ts`
5. **Encryption Service**: Reuse `src/lib/jira-encryption-service.ts` (same encryption)
6. **API Routes**:
   - `src/app/api/azure-devops/settings/route.ts`
   - `src/app/api/azure-devops/settings/test/route.ts`
   - `src/app/api/azure-devops/settings/projects/route.ts`
   - `src/app/api/azure-devops/settings/work-item-types/route.ts`
   - `src/app/api/azure-devops/work-items/route.ts`
7. **UI Updates**: `src/app/settings/page.tsx` (add Azure DevOps tab)

## Integration Points

1. **After Scan Completion**: Similar to Jira, auto-sync issues to Azure DevOps if enabled
2. **Product Backlog**: Add "Sync to Azure DevOps" button for individual issues
3. **Settings Page**: Full configuration UI for Azure DevOps integration

## Next Steps

Once you provide:
1. Organization name
2. Project name
3. Personal Access Token (PAT)
4. Work item type preference
5. Any custom field requirements

We'll implement the integration following the same secure, tested pattern as the Jira integration.




