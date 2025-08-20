/**
 * @fileoverview Entity Manager for dynamic entity type generation
 * @module types-generator/entity-manager
 * 
 * This module provides an API for dynamically managing entity type generation,
 * allowing programmatic addition of entities, batch processing, and incremental
 * updates without regenerating the entire type file.
 * 
 * @example
 * ```typescript
 * const manager = new EntityTypeManager(config);
 * await manager.addEntity('customentity');
 * await manager.addEntities(['entity1', 'entity2']);
 * await manager.removeEntity('obsoleteentity');
 * await manager.regenerate();
 * ```
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { MetadataFetcher } from "./fetcher/MetadataFetcher";
import { TypeTranspiler } from "./transpiler/TypeTranspiler";
import { TypeScriptRenderer } from "./renderer/TypeScriptRenderer";
import { CSDLParser } from "./parser/CSDLParser";
import { 
    GeneratorOptions,
    MetadataCache,
    EntityMetadataCache,
    GeneratedTypes,
    InterfaceDefinition,
} from "./types";
import { 
    COMMON_DATAVERSE_ENTITIES,
    getRecommendedEntities,
    getSystemEntities,
} from "./cdm/common-entities";

/**
 * Configuration for the EntityTypeManager
 */
export interface EntityTypeManagerConfig extends GeneratorOptions {
    /**
     * Enable auto-save after each operation
     * @default true
     */
    autoSave?: boolean;
    
    /**
     * Enable incremental mode (append to existing types)
     * @default true
     */
    incremental?: boolean;
    
    /**
     * Path to store entity registry
     * @default "./.cache/entity-registry.json"
     */
    registryPath?: string;
}

/**
 * Entity registry entry
 */
interface EntityRegistryEntry {
    logicalName: string;
    addedAt: string;
    lastUpdated: string;
    source: "manual" | "cdm" | "discovered" | "custom";
    category?: string;
    customMetadata?: Record<string, any>;
}

/**
 * EntityTypeManager provides dynamic management of entity type generation
 * 
 * Key features:
 * - Add/remove entities without full regeneration
 * - Batch operations for efficiency
 * - Entity discovery from environment
 * - CDM entity preset support
 * - Incremental updates with caching
 * 
 * @class
 */
export class EntityTypeManager {
    private config: EntityTypeManagerConfig;
    private fetcher: MetadataFetcher;
    private transpiler: TypeTranspiler;
    private renderer: TypeScriptRenderer;
    private parser: CSDLParser;
    private cache: MetadataCache | null = null;
    private registry: Map<string, EntityRegistryEntry> = new Map();
    private registryPath: string;
    private isInitialized = false;

    /**
     * @constructor
     * @param {EntityTypeManagerConfig} config - Configuration options
     */
    constructor(config: EntityTypeManagerConfig) {
        this.config = {
            autoSave: true,
            incremental: true,
            ...config,
        };
        
        this.registryPath = config.registryPath || "./.cache/entity-registry.json";
        
        this.fetcher = new MetadataFetcher(config);
        this.transpiler = new TypeTranspiler({
            customTypes: config.customTypes,
            namingConvention: config.namingConvention,
            lookupStyle: config.lookupStyle,
            includeOptionSets: config.includeOptionSets,
            includeRelationships: config.includeRelationships,
        });
        this.renderer = new TypeScriptRenderer({
            emitRuntime: config.emitRuntime,
        });
        this.parser = new CSDLParser();
    }

    /**
     * Initialize the manager and load existing registry
     * 
     * @returns {Promise<void>}
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        await this.fetcher.initialize();
        await this.loadRegistry();
        await this.loadCache();
        
        this.isInitialized = true;
    }

    /**
     * Add a single entity to the type generation
     * 
     * @param {string} entityName - Logical name of the entity
     * @param {Record<string, any>} customMetadata - Optional custom metadata
     * @returns {Promise<boolean>} Success status
     */
    async addEntity(entityName: string, customMetadata?: Record<string, any>): Promise<boolean> {
        await this.ensureInitialized();
        
        try {
            // Check if already exists
            if (this.registry.has(entityName)) {
                console.log(`Entity ${entityName} already exists in registry`);
                return false;
            }
            
            // Fetch metadata
            const metadata = await this.fetcher.fetchEntityMetadata(entityName);
            
            // Add to registry
            this.registry.set(entityName, {
                logicalName: entityName,
                addedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                source: "manual",
                customMetadata,
            });
            
            // Update cache
            if (!this.cache) {
                this.cache = this.createEmptyCache();
            }
            this.cache.entities[entityName] = metadata;
            
            // Auto-save if enabled
            if (this.config.autoSave) {
                await this.save();
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to add entity ${entityName}:`, error);
            return false;
        }
    }

    /**
     * Add multiple entities in batch
     * 
     * @param {string[]} entityNames - Array of entity logical names
     * @returns {Promise<Map<string, boolean>>} Map of entity names to success status
     */
    async addEntities(entityNames: string[]): Promise<Map<string, boolean>> {
        await this.ensureInitialized();
        
        const results = new Map<string, boolean>();
        
        // Process in batches for efficiency
        const batchSize = 5;
        for (let i = 0; i < entityNames.length; i += batchSize) {
            const batch = entityNames.slice(i, i + batchSize);
            const promises = batch.map(async (name) => {
                const success = await this.addEntity(name, undefined);
                results.set(name, success);
            });
            await Promise.all(promises);
        }
        
        return results;
    }

    /**
     * Add entities from CDM presets
     * 
     * @param {"recommended" | "system" | "all-common"} preset - Preset name
     * @returns {Promise<Map<string, boolean>>} Map of entity names to success status
     */
    async addCDMEntities(preset: "recommended" | "system" | "all-common"): Promise<Map<string, boolean>> {
        let entities: string[];
        
        switch (preset) {
            case "recommended":
                entities = getRecommendedEntities();
                break;
            case "system":
                entities = getSystemEntities();
                break;
            case "all-common":
                entities = Object.keys(COMMON_DATAVERSE_ENTITIES);
                break;
            default:
                throw new Error(`Unknown preset: ${preset}`);
        }
        
        // Mark source as CDM
        for (const entity of entities) {
            const metadata = COMMON_DATAVERSE_ENTITIES[entity as keyof typeof COMMON_DATAVERSE_ENTITIES];
            if (metadata) {
                this.registry.set(entity, {
                    logicalName: entity,
                    addedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    source: "cdm",
                    category: metadata.category,
                });
            }
        }
        
        return this.addEntities(entities);
    }

    /**
     * Remove an entity from type generation
     * 
     * @param {string} entityName - Logical name of the entity
     * @returns {Promise<boolean>} Success status
     */
    async removeEntity(entityName: string): Promise<boolean> {
        await this.ensureInitialized();
        
        if (!this.registry.has(entityName)) {
            console.log(`Entity ${entityName} not found in registry`);
            return false;
        }
        
        // Remove from registry
        this.registry.delete(entityName);
        
        // Remove from cache
        if (this.cache?.entities) {
            delete this.cache.entities[entityName];
        }
        
        // Auto-save if enabled
        if (this.config.autoSave) {
            await this.save();
        }
        
        return true;
    }

    /**
     * Discover entities from the environment
     * 
     * @param {RegExp} filter - Optional filter pattern
     * @returns {Promise<string[]>} List of discovered entities
     */
    async discoverEntities(filter?: RegExp): Promise<string[]> {
        await this.ensureInitialized();
        
        const allEntities = await this.fetcher.fetchAllEntities();
        
        let filtered = allEntities;
        if (filter) {
            filtered = allEntities.filter(e => filter.test(e));
        }
        
        // Add discovered entities to registry
        for (const entity of filtered) {
            if (!this.registry.has(entity)) {
                this.registry.set(entity, {
                    logicalName: entity,
                    addedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    source: "discovered",
                });
            }
        }
        
        return filtered;
    }

    /**
     * Update metadata for existing entities
     * 
     * @param {boolean} deltaOnly - Use delta queries for updates
     * @returns {Promise<number>} Number of entities updated
     */
    async updateEntities(deltaOnly = true): Promise<number> {
        await this.ensureInitialized();
        
        const entities = Array.from(this.registry.keys());
        let updatedCount = 0;
        
        if (deltaOnly && this.cache?.serverVersionStamp) {
            const deltaResult = await this.fetcher.fetchWithDelta(entities);
            
            for (const entity of deltaResult.entities) {
                if (this.cache.entities[entity.logicalName]) {
                    this.cache.entities[entity.logicalName] = entity;
                    updatedCount++;
                }
            }
            
            if (deltaResult.serverVersionStamp) {
                this.cache.serverVersionStamp = deltaResult.serverVersionStamp;
            }
        } else {
            // Full refresh
            for (const entityName of entities) {
                try {
                    const metadata = await this.fetcher.fetchEntityMetadata(entityName);
                    if (!this.cache) {
                        this.cache = this.createEmptyCache();
                    }
                    this.cache.entities[entityName] = metadata;
                    updatedCount++;
                } catch (error) {
                    console.error(`Failed to update entity ${entityName}:`, error);
                }
            }
        }
        
        // Auto-save if enabled
        if (this.config.autoSave && updatedCount > 0) {
            await this.save();
        }
        
        return updatedCount;
    }

    /**
     * Generate or regenerate the TypeScript definitions
     * 
     * @returns {Promise<void>}
     */
    async regenerate(): Promise<void> {
        await this.ensureInitialized();
        
        if (!this.cache || Object.keys(this.cache.entities).length === 0) {
            throw new Error("No entities in cache. Add entities first.");
        }
        
        // Convert cache to array
        const entities = Object.values(this.cache.entities);
        
        // Handle global option sets
        const globalOptionSets = new Map<string, any>();
        if (this.cache.globalOptionSets) {
            Object.entries(this.cache.globalOptionSets).forEach(([name, optionSet]) => {
                globalOptionSets.set(name, optionSet);
            });
        }
        
        // Transpile to TypeScript
        const generatedTypes = this.transpiler.transpile(entities, globalOptionSets);
        
        // Handle actions/functions if enabled
        if (this.config.includeActions && this.cache.actions) {
            const actionInterfaces = this.transpiler.transpileActions(Object.values(this.cache.actions));
            for (const [name, def] of actionInterfaces) {
                generatedTypes.interfaces.set(name, def);
            }
        }
        
        // Render TypeScript
        const output = this.renderer.render(generatedTypes);
        
        // Write to file
        const outputPath = this.config.output || "./src/types/dataverse.d.ts";
        const outputDir = path.dirname(outputPath);
        
        try {
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputPath, output, "utf-8");
        } catch (error) {
            throw new Error(`Failed to write output file: ${error}`);
        }
    }

    /**
     * Save current state to disk
     * 
     * @returns {Promise<void>}
     */
    async save(): Promise<void> {
        // Save registry
        await this.saveRegistry();
        
        // Save cache
        if (this.cache && this.config.deltaCache) {
            this.fetcher.saveCache(this.cache);
        }
        
        // Regenerate types
        if (this.cache && Object.keys(this.cache.entities).length > 0) {
            await this.regenerate();
        }
    }

    /**
     * Get list of managed entities
     * 
     * @returns {EntityRegistryEntry[]} Array of registry entries
     */
    getEntities(): EntityRegistryEntry[] {
        return Array.from(this.registry.values());
    }

    /**
     * Get entity metadata
     * 
     * @param {string} entityName - Logical name of the entity
     * @returns {EntityMetadataCache | null} Entity metadata or null
     */
    getEntityMetadata(entityName: string): EntityMetadataCache | null {
        return this.cache?.entities[entityName] || null;
    }

    /**
     * Clear all entities and reset
     * 
     * @returns {Promise<void>}
     */
    async clear(): Promise<void> {
        this.registry.clear();
        this.cache = this.createEmptyCache();
        
        if (this.config.autoSave) {
            await this.save();
        }
    }

    // Private helper methods

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    private async loadRegistry(): Promise<void> {
        try {
            const data = await fs.readFile(this.registryPath, "utf-8");
            const entries: EntityRegistryEntry[] = JSON.parse(data);
            this.registry = new Map(entries.map(e => [e.logicalName, e]));
        } catch (error) {
            // Registry doesn't exist yet, start fresh
            this.registry = new Map();
        }
    }

    private async saveRegistry(): Promise<void> {
        const entries = Array.from(this.registry.values());
        const dir = path.dirname(this.registryPath);
        
        try {
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.registryPath, JSON.stringify(entries, null, 2), "utf-8");
        } catch (error) {
            console.error("Failed to save registry:", error);
        }
    }

    private async loadCache(): Promise<void> {
        if (this.config.deltaCache) {
            try {
                const data = await fs.readFile(this.config.deltaCache, "utf-8");
                this.cache = JSON.parse(data);
            } catch (error) {
                this.cache = this.createEmptyCache();
            }
        } else {
            this.cache = this.createEmptyCache();
        }
    }

    private createEmptyCache(): MetadataCache {
        return {
            version: "1.0.0",
            entities: {},
            globalOptionSets: {},
            lastUpdated: new Date().toISOString(),
        };
    }
}

/**
 * Convenience function to create and initialize an EntityTypeManager
 * 
 * @param {EntityTypeManagerConfig} config - Configuration options
 * @returns {Promise<EntityTypeManager>} Initialized manager
 */
export async function createEntityTypeManager(config: EntityTypeManagerConfig): Promise<EntityTypeManager> {
    const manager = new EntityTypeManager(config);
    await manager.initialize();
    return manager;
}