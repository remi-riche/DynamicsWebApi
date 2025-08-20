# Type Generation Programmatic API

## EntityTypeManager

The `EntityTypeManager` class provides a programmatic API for managing entity type generation dynamically. This is useful for CI/CD pipelines, build scripts, and applications that need to manage types at runtime.

## Installation

```typescript
import { createEntityTypeManager, EntityTypeManager } from "dynamics-web-api/types-generator";
```

## Basic Usage

### Initialize the Manager

```typescript
const manager = await createEntityTypeManager({
    serverUrl: "https://org.crm.dynamics.com",
    output: "./src/types/dataverse.d.ts",
    auth: {
        type: "client-credentials",
        tenantId: "your-tenant",
        clientId: "your-client",
        clientSecret: "your-secret"
    }
});
```

### Add Entities

```typescript
// Add a single entity
await manager.addEntity("account");

// Add multiple entities
await manager.addEntities(["contact", "lead", "opportunity"]);

// Add common CDM entities
await manager.addCDMEntities("recommended"); // Adds systemuser, account, contact, etc.
await manager.addCDMEntities("system");      // Adds system entities only
await manager.addCDMEntities("all-common");  // Adds all standard CDM entities
```

### Remove Entities

```typescript
// Remove a single entity
await manager.removeEntity("obsoleteentity");

// Clear all entities
await manager.clear();
```

### Discover Entities

```typescript
// Discover all entities in the environment
const allEntities = await manager.discoverEntities();

// Discover with filter
const customEntities = await manager.discoverEntities(/^cr[a-z0-9]+_/);
```

### Update and Regenerate

```typescript
// Update metadata for existing entities (uses delta queries)
const updatedCount = await manager.updateEntities(true);

// Force full metadata refresh
const refreshedCount = await manager.updateEntities(false);

// Regenerate TypeScript definitions
await manager.regenerate();
```

## Advanced Configuration

### Auto-Save Mode

```typescript
const manager = new EntityTypeManager({
    serverUrl: "https://org.crm.dynamics.com",
    autoSave: true,  // Automatically save and regenerate after each operation
    incremental: true, // Append to existing types
    registryPath: "./.cache/entity-registry.json",
    deltaCache: "./.cache/metadata-cache.json",
    auth: { /* ... */ }
});
```

### Custom Metadata

```typescript
// Add entity with custom metadata
await manager.addEntity("customentity", {
    category: "custom",
    description: "Custom entity for special purpose",
    tags: ["important", "v2"]
});

// Retrieve entity metadata
const metadata = manager.getEntityMetadata("customentity");
```

### Batch Operations

```typescript
// Efficient batch processing
const entitiesToAdd = [
    "account", "contact", "lead", "opportunity",
    "incident", "task", "appointment", "email"
];

// Process in batches (internal batching for efficiency)
const results = await manager.addEntities(entitiesToAdd);

// Check results
for (const [entity, success] of results) {
    if (!success) {
        console.error(`Failed to add ${entity}`);
    }
}
```

## Build Integration

### Webpack Plugin Example

```javascript
class DataverseTypesPlugin {
    constructor(options) {
        this.options = options;
    }

    apply(compiler) {
        compiler.hooks.beforeCompile.tapAsync(
            'DataverseTypesPlugin',
            async (params, callback) => {
                const manager = await createEntityTypeManager(this.options);
                await manager.updateEntities(true);
                await manager.regenerate();
                callback();
            }
        );
    }
}

// webpack.config.js
module.exports = {
    plugins: [
        new DataverseTypesPlugin({
            serverUrl: process.env.DATAVERSE_URL,
            entities: ["account", "contact"],
            auth: { /* ... */ }
        })
    ]
};
```

### Vite Plugin Example

```typescript
import { Plugin } from "vite";
import { createEntityTypeManager } from "dynamics-web-api/types-generator";

export function dataverseTypes(options): Plugin {
    let manager: EntityTypeManager;

    return {
        name: "vite-plugin-dataverse-types",
        
        async buildStart() {
            manager = await createEntityTypeManager(options);
            await manager.updateEntities(true);
            await manager.regenerate();
        },
        
        async watchChange(id) {
            if (id.endsWith(".dynamics-types.json")) {
                await manager.updateEntities(true);
                await manager.regenerate();
            }
        }
    };
}
```

### Gulp Task Example

```javascript
const gulp = require("gulp");
const { createEntityTypeManager } = require("dynamics-web-api/types-generator");

gulp.task("generate-types", async () => {
    const manager = await createEntityTypeManager({
        serverUrl: process.env.DATAVERSE_URL,
        output: "./src/types/dataverse.d.ts",
        auth: {
            type: "token-callback",
            tokenCallback: async () => getAccessToken()
        }
    });

    // Add recommended entities
    await manager.addCDMEntities("recommended");
    
    // Discover and add custom entities
    const customEntities = await manager.discoverEntities(/^cr[a-z0-9]+_/);
    await manager.addEntities(customEntities);
    
    // Generate types
    await manager.regenerate();
});
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Generate Dataverse Types

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  generate-types:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      
      - name: Generate Types
        env:
          DATAVERSE_URL: ${{ secrets.DATAVERSE_URL }}
          AAD_TENANT_ID: ${{ secrets.AAD_TENANT_ID }}
          AAD_CLIENT_ID: ${{ secrets.AAD_CLIENT_ID }}
          AAD_CLIENT_SECRET: ${{ secrets.AAD_CLIENT_SECRET }}
        run: |
          node -e "
          const { createEntityTypeManager } = require('dynamics-web-api/types-generator');
          
          (async () => {
              const manager = await createEntityTypeManager({
                  serverUrl: process.env.DATAVERSE_URL,
                  output: './src/types/dataverse.d.ts',
                  deltaCache: './.cache/metadata-cache.json',
                  auth: {
                      type: 'client-credentials',
                      tenantId: process.env.AAD_TENANT_ID,
                      clientId: process.env.AAD_CLIENT_ID,
                      clientSecret: process.env.AAD_CLIENT_SECRET
                  }
              });
              
              // Load existing entities from cache
              const entities = manager.getEntities();
              if (entities.length === 0) {
                  // First run - add recommended entities
                  await manager.addCDMEntities('recommended');
              }
              
              // Update with delta
              const updated = await manager.updateEntities(true);
              console.log(\`Updated \${updated} entities\`);
              
              // Regenerate types
              await manager.regenerate();
          })();
          "
          
      - name: Commit Changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/types/dataverse.d.ts .cache/
          git diff --quiet && git diff --staged --quiet || git commit -m "chore: update Dataverse types [skip ci]"
          git push
```

### Azure DevOps Pipeline

```yaml
trigger:
  schedule:
    - cron: "0 2 * * *"
      displayName: Daily types generation
      branches:
        include:
          - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'
      
  - script: npm ci
    displayName: 'Install dependencies'
    
  - script: |
      node scripts/generate-types.js
    displayName: 'Generate Dataverse Types'
    env:
      DATAVERSE_URL: $(DataverseUrl)
      AAD_TENANT_ID: $(AadTenantId)
      AAD_CLIENT_ID: $(AadClientId)
      AAD_CLIENT_SECRET: $(AadClientSecret)
      
  - script: |
      git config user.email "azure-pipeline@dev.azure.com"
      git config user.name "Azure Pipeline"
      git add src/types/dataverse.d.ts .cache/
      git diff --quiet && git diff --staged --quiet || (
        git commit -m "chore: update Dataverse types [skip ci]" &&
        git push origin HEAD:$(Build.SourceBranchName)
      )
    displayName: 'Commit changes'
```

## Registry Management

The EntityTypeManager maintains a registry of managed entities with metadata:

```typescript
// Get all registered entities
const entities = manager.getEntities();

// Entity registry entry structure
interface EntityRegistryEntry {
    logicalName: string;
    addedAt: string;           // ISO timestamp
    lastUpdated: string;       // ISO timestamp
    source: "manual" | "cdm" | "discovered" | "custom";
    category?: string;
    customMetadata?: Record<string, any>;
}

// Filter entities by source
const cdmEntities = entities.filter(e => e.source === "cdm");
const customEntities = entities.filter(e => e.source === "custom");
```

## Error Handling

```typescript
try {
    const manager = await createEntityTypeManager(config);
    
    // Handle individual entity failures
    const results = await manager.addEntities(["entity1", "entity2", "invalid"]);
    
    for (const [entity, success] of results) {
        if (!success) {
            console.warn(`Failed to add entity: ${entity}`);
        }
    }
    
    // Regenerate only if we have entities
    if (manager.getEntities().length > 0) {
        await manager.regenerate();
    }
    
} catch (error) {
    if (error.message.includes("401")) {
        console.error("Authentication failed. Check credentials.");
    } else if (error.message.includes("No entities")) {
        console.error("No entities to generate types for.");
    } else {
        console.error("Unexpected error:", error);
    }
}
```

## Performance Optimization

### Delta Updates

```typescript
// Use delta queries for incremental updates
const manager = new EntityTypeManager({
    deltaCache: "./.cache/metadata-cache.json",
    // ... other config
});

// First run: Full fetch
await manager.addEntities(["account", "contact"]);

// Subsequent runs: Delta only
const updatedCount = await manager.updateEntities(true);
console.log(`Updated ${updatedCount} entities with changes`);
```

### Parallel Processing

```typescript
// The manager automatically batches operations
// Default batch size is 5 concurrent requests

// Custom batch processing
const entities = ["entity1", "entity2", /* ... many more ... */];
const batchSize = 10;

for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    await manager.addEntities(batch);
    console.log(`Processed batch ${i / batchSize + 1}`);
}
```

## Custom Type Mappings

```typescript
const manager = new EntityTypeManager({
    customTypes: {
        money: "Decimal",        // Use custom Decimal type
        datetime: "moment.Moment", // Use Moment.js
        decimal: "string",       // Store as string for precision
        bigint: "string"        // Store as string for compatibility
    },
    namingConvention: "camelCase",
    lookupStyle: "both",        // string | EntityReference
    // ... other config
});
```

## Testing

```typescript
import { createEntityTypeManager } from "dynamics-web-api/types-generator";
import { describe, it, expect, beforeEach } from "@jest/globals";

describe("EntityTypeManager", () => {
    let manager: EntityTypeManager;
    
    beforeEach(async () => {
        manager = await createEntityTypeManager({
            serverUrl: "https://test.crm.dynamics.com",
            auth: {
                type: "token-callback",
                tokenCallback: async () => "mock-token"
            }
        });
    });
    
    it("should add entities", async () => {
        const success = await manager.addEntity("account");
        expect(success).toBe(true);
        
        const entities = manager.getEntities();
        expect(entities).toHaveLength(1);
        expect(entities[0].logicalName).toBe("account");
    });
    
    it("should handle CDM presets", async () => {
        await manager.addCDMEntities("system");
        
        const entities = manager.getEntities();
        const systemUserEntity = entities.find(e => e.logicalName === "systemuser");
        
        expect(systemUserEntity).toBeDefined();
        expect(systemUserEntity?.source).toBe("cdm");
    });
});
```

## Migration from Static Generation

If you're migrating from static CLI generation to programmatic API:

```typescript
// Before: package.json script
{
    "scripts": {
        "generate-types": "dynamics-web-api generate-types --entities account,contact"
    }
}

// After: build script
// scripts/generate-types.js
const { createEntityTypeManager } = require("dynamics-web-api/types-generator");

(async () => {
    const manager = await createEntityTypeManager({
        serverUrl: process.env.DATAVERSE_URL,
        output: "./src/types/dataverse.d.ts",
        auth: { /* ... */ }
    });
    
    // Migrate existing entities
    await manager.addEntities(["account", "contact"]);
    
    // Add new entities dynamically
    const customEntities = await manager.discoverEntities(/^custom_/);
    await manager.addEntities(customEntities);
    
    // Generate
    await manager.regenerate();
})();
```