# TypeScript Type Generation

DynamicsWebApi now includes a powerful TypeScript type generator that creates type-safe interfaces directly from your Dataverse metadata.

## Features

- 🎯 **Full Type Safety**: Generate TypeScript interfaces for all your entities
- 🔄 **Incremental Updates**: Use delta queries to update only changed metadata (RetrieveMetadataChanges)
- 📦 **Smart Caching**: Cache metadata locally with ServerVersionStamp for faster subsequent generations
- 🎨 **Customizable**: Configure naming conventions, type mappings, and more
- 🚀 **Performance**: Optimized queries with attribute type casting and minimal API calls
- 📝 **IntelliSense**: Full IDE support with auto-completion and type checking
- 🏢 **CDM Support**: Built-in support for Common Data Model entities (systemuser, account, contact, etc.)
- 🔐 **Security**: Multiple authentication methods (MSAL client credentials, device code, custom callbacks)

## Quick Start

### 1. Install Dependencies

```bash
npm install dynamics-web-api
```

### 2. Configure Authentication

Set up environment variables:

```bash
export DYNAMICS_SERVER_URL="https://yourorg.crm.dynamics.com"
export DYNAMICS_TENANT_ID="your-tenant-id"
export DYNAMICS_CLIENT_ID="your-client-id"
export DYNAMICS_CLIENT_SECRET="your-client-secret"
```

### 3. Generate Types

```bash
npx dynamics-web-api generate-types \
  --entities account,contact,opportunity \
  --output ./src/types/dataverse.d.ts
```

### 4. Use Generated Types

```typescript
import { DynamicsWebApi } from "dynamics-web-api";
import type { Account, Contact, AccountAttributes } from "./types/dataverse";

const api = new DynamicsWebApi(config);

// Full type safety and IntelliSense
const account = await api.retrieve<Account>({
    collection: "accounts",
    key: accountId,
    select: ["name", "revenue"] as AccountAttributes[]
});

console.log(account.name); // Type-safe property access
```

## Configuration

### Configuration File

Create a `.dynamics-types.json` file in your project root:

```json
{
    "output": "./src/types/dataverse.d.ts",
    "entities": [
        "account",
        "contact",
        "opportunity",
        "lead"
    ],
    "includeOptionSets": true,
    "includeActions": true,
    "includeRelationships": false,
    "labelLanguage": 1033,
    "namingConvention": "camelCase",
    "lookupStyle": "guid",
    "deltaCache": "./.cache/metadata-cache.json",
    "customTypes": {
        "money": "number",
        "datetime": "Date",
        "decimal": "number",
        "bigint": "bigint"
    }
}
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--server-url` | Dataverse organization URL | Required |
| `--entities` | Comma-separated list of entities or '*' for all | Required |
| `--output` | Output file path | `./src/types/dataverse.d.ts` |
| `--include-option-sets` | Generate enums for option sets | `true` |
| `--include-actions` | Generate types for actions/functions | `false` |
| `--include-relationships` | Include navigation properties | `false` |
| `--label-lang` | Label language LCID (1033=English) | `1033` |
| `--naming` | Naming convention: camelCase, pascalCase, logicalName | `camelCase` |
| `--lookup-style` | Lookup style: guid, object, or both | `guid` |
| `--delta-cache` | Path to cache file for incremental updates | None |
| `--emit-runtime` | Emit runtime helpers instead of just types | `false` |

### Authentication Options

#### Client Credentials (Recommended for CI/CD)

```bash
npx dynamics-web-api generate-types \
  --auth client-credentials \
  --tenant YOUR_TENANT_ID \
  --client YOUR_CLIENT_ID \
  --secret YOUR_CLIENT_SECRET
```

#### Device Code (Interactive)

```bash
npx dynamics-web-api generate-types \
  --auth device-code \
  --tenant YOUR_TENANT_ID \
  --client YOUR_CLIENT_ID
```

#### Custom Token Callback

```bash
npx dynamics-web-api generate-types \
  --auth token-callback \
  --token-callback ./auth/getToken.js
```

Token callback module example:

```javascript
// auth/getToken.js
module.exports = async function getToken() {
    // Your custom token acquisition logic
    return "Bearer eyJ0eXAiOiJKV1QiLCJhbGc...";
};
```

## Generated Types

### Entity Interfaces

For each entity, three interfaces are generated:

```typescript
// Read interface (all properties optional)
export interface Account {
    accountid?: string;
    name?: string;
    revenue?: number;
    numberofemployees?: number;
    primarycontactid?: string;
    // ... all other attributes
}

// Create interface (required properties enforced)
export interface AccountCreate {
    name: string; // Required
    revenue?: number; // Optional
    // ... based on RequiredLevel metadata
}

// Update interface (all properties optional)
export interface AccountUpdate {
    name?: string;
    revenue?: number;
    // ... only updatable attributes
}

// Attribute names union type for type-safe select
export type AccountAttributes = 
    | "accountid"
    | "name"
    | "revenue"
    | "numberofemployees"
    | "primarycontactid";
```

### Option Set Enums

```typescript
export enum AccountIndustryCode {
    Accounting = 1,
    Agriculture = 2,
    Broadcasting = 3,
    // ... all options
}

export const AccountIndustryCodeLabels: Record<AccountIndustryCode, string> = {
    [AccountIndustryCode.Accounting]: "Accounting",
    [AccountIndustryCode.Agriculture]: "Agriculture and Non-petrol Natural Resource Extraction",
    // ... all labels
};
```

### Actions and Functions

```typescript
export interface QualifyLeadRequest {
    createAccount: boolean;
    createContact: boolean;
    createOpportunity: boolean;
    status: number;
}

export interface QualifyLeadResponse {
    // Response properties based on CSDL metadata
}
```

## Build Integration

### Package.json Scripts

```json
{
    "scripts": {
        "generate-types": "dynamics-web-api generate-types",
        "prebuild": "npm run generate-types",
        "build": "tsc"
    }
}
```

### Programmatic API

```typescript
import { generateTypes } from "dynamics-web-api/types-generator";

async function generateDataverseTypes() {
    const result = await generateTypes({
        serverUrl: "https://yourorg.crm.dynamics.com",
        entities: ["account", "contact", "opportunity"],
        output: "./src/types/dataverse.d.ts",
        includeOptionSets: true,
        auth: {
            type: "token-callback",
            tokenCallback: async () => getAccessToken()
        }
    });

    console.log(`Generated types for ${result.entityCount} entities`);
}
```

## Advanced Usage

### Custom Type Mappings

Map Dataverse types to custom TypeScript types:

```json
{
    "customTypes": {
        "money": "Decimal", // Use custom Decimal type
        "datetime": "moment.Moment", // Use Moment.js
        "decimal": "string", // Store as string for precision
        "bigint": "string" // Store as string for compatibility
    }
}
```

### Lookup Styles

Configure how lookup properties are typed:

```typescript
// "guid" style (default)
primarycontactid?: string;

// "object" style
primarycontactid?: Contact;

// "both" style
primarycontactid?: string | Contact;

// Multi-table lookup (Customer)
customerid?: string | { id: string; logicalName: "account" | "contact" };
```

### Incremental Updates with Delta Cache

Use delta queries for faster subsequent generations:

```bash
# First run - full metadata fetch
npx dynamics-web-api generate-types \
  --entities account,contact \
  --delta-cache ./.cache/metadata.json

# Subsequent runs - only fetch changes
npx dynamics-web-api generate-types \
  --entities account,contact \
  --delta-cache ./.cache/metadata.json
```

### Runtime Helpers

Generate runtime helper functions:

```bash
npx dynamics-web-api generate-types \
  --entities account \
  --emit-runtime
```

This generates helper functions like:

```typescript
export namespace Helpers {
    function createReference(collection: string, id: string): string;
    function extractId(reference: string): string | null;
    function formatFilterValue(value: any): string;
    function buildQuery(params: QueryParams): string;
}
```

## Performance Optimization

### 1. Use Delta Cache

Always use `--delta-cache` for incremental updates:

```json
{
    "deltaCache": "./.cache/metadata-cache.json"
}
```

### 2. Limit Label Languages

Reduce payload by specifying only needed languages:

```bash
--label-lang 1033  # English only
```

### 3. Selective Entity Generation

Generate types only for entities you use:

```bash
--entities account,contact,opportunity
```

### 4. Exclude Unused Features

```bash
--no-include-actions      # Skip action/function types
--no-include-relationships # Skip navigation properties
```

## WebStorm / IntelliJ IDEA Setup

1. **Configure TypeScript**:
   - Settings → Languages & Frameworks → TypeScript
   - Enable TypeScript service

2. **JSON Schema Mapping**:
   - Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings
   - Add mapping for `.dynamics-types.json` to schema

3. **File Watchers** (optional):
   - Settings → Tools → File Watchers
   - Add watcher for automatic type regeneration

## Troubleshooting

### Authentication Issues

```bash
# Test authentication
npx dynamics-web-api generate-types \
  --entities account \
  --dry-run \
  --verbose
```

### Metadata Fetch Errors

1. Check entity logical names are correct
2. Verify user has metadata read permissions
3. Use `--verbose` for detailed error messages

### Type Conflicts

1. Ensure unique entity names
2. Check for reserved TypeScript keywords
3. Review naming convention settings

## Common Data Model (CDM) Entities

The generator includes built-in support for standard Dataverse entities:

### List Available Entities

```bash
# List all common entities
npx dynamics-web-api list-entities

# Filter by category
npx dynamics-web-api list-entities --category system
npx dynamics-web-api list-entities --category activity
```

### Generate Types for Common Entity Sets

```bash
# Recommended entities for typical CRM
npx dynamics-web-api generate-types --entities recommended
# Includes: systemuser, team, account, contact, lead, opportunity, etc.

# System entities only
npx dynamics-web-api generate-types --entities system
# Includes: systemuser, team, businessunit, role, organization

# All standard CDM entities
npx dynamics-web-api generate-types --entities all-common
```

### SystemUser Entity Specifics

The `systemuser` entity has unique characteristics:

```typescript
// Special attributes for SystemUser
interface SystemUser {
    // Identity & AAD Integration
    systemuserid: string;                    // Primary key (GUID)
    fullname: string;                       // Primary name
    domainname?: string;                    // UPN from AAD
    azureactivedirectoryobjectid?: string;  // AAD Object ID
    
    // Access Control
    accessmode?: AccessMode;                // 0=Read-Write, 1=Admin, etc.
    isdisabled?: boolean;                   // Account enabled/disabled
    islicensed?: boolean;                   // Has valid license
    
    // Licensing (Online vs On-Premise)
    userlicensetype?: UserLicenseType;      // Online licensing
    caltype?: CalType;                      // On-premise CAL type
    
    // Hierarchical Relationships
    businessunitid?: string;                // Business unit reference
    parentsystemuserid?: string;            // Manager (self-referential)
    
    // DateTime fields (UTC in API, UserLocal in UI)
    createdon?: Date;                       // Creation timestamp
    modifiedon?: Date;                      // Last modification
}

// Access Mode enum (important for security)
enum AccessMode {
    ReadWrite = 0,
    Administrative = 1,
    Read = 2,
    SupportUser = 3,
    NonInteractive = 4,      // For application users
    DelegatedAdmin = 5
}
```

## Technical Subtleties & Best Practices

### DateTime Handling

**⚠️ Critical**: Dataverse DateTime fields have different behaviors:

```typescript
// DateTimeBehavior affects how dates are stored/retrieved
interface DateTimeBehaviors {
    UserLocal: "Converted to user's timezone",     // Most common
    DateOnly: "Date without time component",        // Birth dates, etc.
    TimeZoneIndependent: "Stored as-is"            // Absolute timestamps
}

// API returns UTC, but UI shows UserLocal
const account = await api.retrieve<Account>({
    collection: "accounts",
    key: accountId
});

// ⚠️ For DateOnly fields, avoid timezone issues
// BAD: new Date('2024-01-15') can shift dates
// GOOD: Use ISO format with time
const birthDate = new Date('2024-01-15T00:00:00');
```

### Lookup Fields & Polymorphic References

```typescript
// Single-type lookup
interface Contact {
    parentcustomerid?: string;              // Just the GUID
    _parentcustomerid_value?: string;       // Alternate GUID format
}

// Polymorphic lookup (Customer can be Account OR Contact)
interface Opportunity {
    customerid?: string | {
        id: string;
        logicalName: "account" | "contact";
    };
}

// Owner field (can be User OR Team)
interface Account {
    ownerid?: string | {
        id: string;
        logicalName: "systemuser" | "team";
    };
}
```

### Option Set Subtleties

```typescript
// Local option sets are entity-specific
enum AccountIndustryCode { /* ... */ }

// Global option sets are shared across entities
enum BudgetStatus {  // Used by Lead, Opportunity, etc.
    NoCommittedBudget = 0,
    MayBuy = 1,
    CanBuy = 2,
    WillBuy = 3
}

// ⚠️ Option set values can have gaps
enum LeadSource {
    Advertisement = 1,
    EmployeeReferral = 2,
    // 3-5 might not exist!
    Web = 6,
    TradeShow = 7
}
```

### Read-Only vs Required Fields

```typescript
// Different interfaces for different operations
interface AccountCreate {
    name: string;           // Required on create
    revenue?: number;       // Optional
    // accountid not here - system generates it
}

interface AccountUpdate {
    name?: string;          // All optional on update
    revenue?: number;
    // accountid not here - can't update primary key
}

interface Account {
    accountid?: string;     // All optional on read (partial select)
    name?: string;
    revenue?: number;
    createdon?: Date;       // Read-only, system-managed
}
```

### Metadata Query Optimization

The generator uses attribute type casting for efficient metadata retrieval:

```typescript
// Instead of fetching all attribute metadata...
GET /EntityDefinitions(LogicalName='account')/Attributes

// We cast to specific types for relevant properties
GET /EntityDefinitions(LogicalName='account')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata
    ?$select=LogicalName&$expand=OptionSet,GlobalOptionSet

GET /EntityDefinitions(LogicalName='account')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata
    ?$select=LogicalName,Targets
```

### Cache & Delta Strategies

```typescript
// First run: Full metadata fetch
{
    "version": "1.0.0",
    "serverVersionStamp": null,  // No stamp yet
    "entities": { /* full metadata */ }
}

// Subsequent runs: Delta only
POST /RetrieveMetadataChanges
{
    "Query": { /* ... */ },
    "ClientVersionStamp": "12345"  // From previous run
}

// Only changed entities are fetched
// Unchanged entities use cached metadata
```

## Type Safety Best Practices

### 1. Use Attribute Arrays with Type Assertions

```typescript
// ✅ Type-safe with const assertion
const attributes = ["name", "revenue"] as const satisfies AccountAttributes[];

// ✅ Or use the type directly
const attributes: AccountAttributes[] = ["name", "revenue"];

// ❌ Not type-safe
const attributes = ["name", "revenue"];
```

### 2. Leverage Create/Update Interfaces

```typescript
// ✅ Enforces required fields
const newAccount: AccountCreate = {
    name: "Contoso Ltd", // Required
    // revenue is optional
};

// ✅ All fields optional for updates
const update: AccountUpdate = {
    revenue: 1000000
};
```

### 3. Use Enums for Option Sets

```typescript
// ✅ Type-safe and readable
account.industrycode = AccountIndustryCode.Technology;

// ❌ Magic numbers
account.industrycode = 33;
```

## Migration from Manual Types

### Before (Manual)

```typescript
interface IAccount {
    accountid?: string;
    name?: string;
    // Manually maintained, often incomplete
}
```

### After (Generated)

```typescript
import type { Account } from "./types/dataverse";
// Complete, always up-to-date with schema
```

## Contributing

To contribute to the type generator:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT - See LICENSE file for details