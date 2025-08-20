/**
 * @fileoverview Metadata fetcher for Dataverse Web API
 * @module types-generator/fetcher
 * 
 * This module handles all interactions with the Dataverse Web API to retrieve
 * entity metadata, attributes, relationships, and option sets. It implements
 * intelligent caching using RetrieveMetadataChanges for incremental updates.
 * 
 * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api}
 */

import { ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";
import * as fs from "node:fs";
import * as path from "node:path";
import {
    AuthConfig,
    EntityMetadataCache,
    AttributeMetadata,
    RelationshipMetadata,
    OptionSetMetadata,
    MetadataCache,
    GeneratorOptions,
    ActionMetadata,
    FunctionMetadata,
} from "../types";

/**
 * MetadataFetcher class responsible for retrieving Dataverse metadata
 * 
 * Key features:
 * - Multiple authentication methods (MSAL client credentials, device code, custom callback)
 * - Intelligent caching with delta queries using RetrieveMetadataChanges
 * - Optimized API calls with attribute type casting for specific metadata
 * - Support for global option sets and relationship metadata
 * 
 * @class
 */
export class MetadataFetcher {
    private serverUrl: string;
    private token?: string;
    private authConfig: AuthConfig;
    private labelLanguage: number;
    private cache?: MetadataCache;
    private cachePath?: string;

    /**
     * @constructor
     * @param {GeneratorOptions} options - Configuration options for the fetcher
     * 
     * Note: The server URL is normalized to remove trailing slashes to prevent
     * double slashes in API calls. Cache is loaded synchronously on initialization
     * for immediate availability in delta queries.
     */
    constructor(options: GeneratorOptions) {
        // Normalize server URL to prevent double slashes in API paths
        this.serverUrl = options.serverUrl.replace(/\/$/, "");
        this.authConfig = options.auth || { type: "token-callback" };
        // Default to English (1033) if not specified. Common LCIDs:
        // 1033 = English, 1036 = French, 1040 = Italian, 1041 = Japanese, 1031 = German
        this.labelLanguage = options.labelLanguage || 1033;
        this.cachePath = options.deltaCache;
        
        // Load existing cache if available for delta queries
        if (this.cachePath && fs.existsSync(this.cachePath)) {
            try {
                this.cache = JSON.parse(fs.readFileSync(this.cachePath, "utf-8"));
            } catch (error) {
                console.warn(`Failed to load metadata cache from ${this.cachePath}:`, error);
                // Continue without cache - will perform full fetch
            }
        }
    }

    async initialize(): Promise<void> {
        this.token = await this.getAccessToken();
    }

    private async getAccessToken(): Promise<string> {
        if (this.authConfig.type === "token-callback" && this.authConfig.tokenCallback) {
            return await this.authConfig.tokenCallback();
        }

        const scope = `${this.serverUrl}/.default`;

        if (this.authConfig.type === "client-credentials") {
            const app = new ConfidentialClientApplication({
                auth: {
                    clientId: this.authConfig.clientId!,
                    authority: `https://login.microsoftonline.com/${this.authConfig.tenantId}`,
                    clientSecret: this.authConfig.clientSecret!,
                },
            });

            const result = await app.acquireTokenByClientCredential({ scopes: [scope] });
            if (!result?.accessToken) {
                throw new Error("Failed to acquire access token");
            }
            return result.accessToken;
        }

        if (this.authConfig.type === "device-code") {
            const app = new PublicClientApplication({
                auth: {
                    clientId: this.authConfig.clientId!,
                    authority: `https://login.microsoftonline.com/${this.authConfig.tenantId}`,
                },
            });

            const result = await app.acquireTokenByDeviceCode({
                scopes: [scope],
                deviceCodeCallback: (response) => {
                    console.log(response.message);
                },
            });

            if (!result?.accessToken) {
                throw new Error("Failed to acquire access token");
            }
            return result.accessToken;
        }

        throw new Error(`Unsupported authentication type: ${this.authConfig.type}`);
    }

    private async fetchApi(path: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.serverUrl}/api/data/v9.2/${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Accept": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Content-Type": "application/json; charset=utf-8",
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
        }

        return response.json();
    }

    async fetchEntityMetadata(entityName: string): Promise<EntityMetadataCache> {
        const baseQuery = `EntityDefinitions(LogicalName='${entityName}')?` +
            `$select=LogicalName,SchemaName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute` +
            `&LabelLanguages=${this.labelLanguage}`;

        const baseMetadata = await this.fetchApi(baseQuery);

        const attributesQuery = `EntityDefinitions(LogicalName='${entityName}')/Attributes?` +
            `$select=LogicalName,SchemaName,AttributeType,RequiredLevel,` +
            `IsPrimaryId,IsPrimaryName,IsValidForCreate,IsValidForUpdate,IsValidForRead` +
            `&LabelLanguages=${this.labelLanguage}`;

        const attributesResponse = await this.fetchApi(attributesQuery);
        const attributes = await this.processAttributes(entityName, attributesResponse.value);

        const relationships = await this.fetchRelationships(entityName);

        return {
            logicalName: baseMetadata.LogicalName,
            schemaName: baseMetadata.SchemaName,
            entitySetName: baseMetadata.EntitySetName,
            primaryIdAttribute: baseMetadata.PrimaryIdAttribute,
            primaryNameAttribute: baseMetadata.PrimaryNameAttribute,
            attributes,
            relationships,
        };
    }

    private async processAttributes(entityName: string, attributes: any[]): Promise<AttributeMetadata[]> {
        const processed: AttributeMetadata[] = [];

        for (const attr of attributes) {
            const metadata: AttributeMetadata = {
                logicalName: attr.LogicalName,
                schemaName: attr.SchemaName,
                attributeType: attr.AttributeType,
                requiredLevel: attr.RequiredLevel,
                isValidForCreate: attr.IsValidForCreate,
                isValidForUpdate: attr.IsValidForUpdate,
                isValidForRead: attr.IsValidForRead,
                isPrimaryId: attr.IsPrimaryId,
                isPrimaryName: attr.IsPrimaryName,
            };

            if (["String", "Memo"].includes(attr.AttributeType)) {
                const stringAttr = await this.fetchStringAttribute(entityName, attr.LogicalName);
                metadata.maxLength = stringAttr.MaxLength;
            }

            if (["Picklist", "State", "Status"].includes(attr.AttributeType)) {
                const picklistAttr = await this.fetchPicklistAttribute(entityName, attr.LogicalName);
                if (picklistAttr.OptionSet) {
                    metadata.optionSet = this.mapOptionSet(picklistAttr.OptionSet);
                }
                if (picklistAttr.GlobalOptionSet) {
                    metadata.globalOptionSet = picklistAttr.GlobalOptionSet.Name;
                }
            }

            if (attr.AttributeType === "MultiSelectPicklist") {
                const multiSelectAttr = await this.fetchMultiSelectAttribute(entityName, attr.LogicalName);
                if (multiSelectAttr.OptionSet) {
                    metadata.optionSet = this.mapOptionSet(multiSelectAttr.OptionSet);
                }
                if (multiSelectAttr.GlobalOptionSet) {
                    metadata.globalOptionSet = multiSelectAttr.GlobalOptionSet.Name;
                }
            }

            if (["Lookup", "Customer", "Owner"].includes(attr.AttributeType)) {
                const lookupAttr = await this.fetchLookupAttribute(entityName, attr.LogicalName);
                metadata.targets = lookupAttr.Targets;
            }

            if (["Decimal", "Money"].includes(attr.AttributeType)) {
                const decimalAttr = await this.fetchDecimalAttribute(entityName, attr.LogicalName);
                metadata.precision = decimalAttr.Precision;
                metadata.minValue = decimalAttr.MinValue;
                metadata.maxValue = decimalAttr.MaxValue;
            }

            if (attr.AttributeType === "DateTime") {
                const dateTimeAttr = await this.fetchDateTimeAttribute(entityName, attr.LogicalName);
                metadata.dateTimeBehavior = dateTimeAttr.DateTimeBehavior;
            }

            processed.push(metadata);
        }

        return processed;
    }

    private async fetchStringAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.StringAttributeMetadata?$select=MaxLength`;
        return this.fetchApi(query);
    }

    private async fetchPicklistAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet,GlobalOptionSet`;
        return this.fetchApi(query);
    }

    private async fetchMultiSelectAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata?$expand=OptionSet,GlobalOptionSet`;
        return this.fetchApi(query);
    }

    private async fetchLookupAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`;
        return this.fetchApi(query);
    }

    private async fetchDecimalAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=Precision,MinValue,MaxValue`;
        return this.fetchApi(query);
    }

    private async fetchDateTimeAttribute(entityName: string, attributeName: string): Promise<any> {
        const query = `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/` +
            `Microsoft.Dynamics.CRM.DateTimeAttributeMetadata?$select=DateTimeBehavior`;
        return this.fetchApi(query);
    }

    private async fetchRelationships(entityName: string): Promise<RelationshipMetadata[]> {
        const relationships: RelationshipMetadata[] = [];

        const oneToManyQuery = `EntityDefinitions(LogicalName='${entityName}')/OneToManyRelationships?` +
            `$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute`;
        const oneToMany = await this.fetchApi(oneToManyQuery);
        
        for (const rel of oneToMany.value) {
            relationships.push({
                schemaName: rel.SchemaName,
                relationshipType: "OneToMany",
                referencedEntity: rel.ReferencedEntity,
                referencedAttribute: rel.ReferencedAttribute,
                referencingEntity: rel.ReferencingEntity,
                referencingAttribute: rel.ReferencingAttribute,
            });
        }

        const manyToOneQuery = `EntityDefinitions(LogicalName='${entityName}')/ManyToOneRelationships?` +
            `$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute`;
        const manyToOne = await this.fetchApi(manyToOneQuery);
        
        for (const rel of manyToOne.value) {
            relationships.push({
                schemaName: rel.SchemaName,
                relationshipType: "ManyToOne",
                referencedEntity: rel.ReferencedEntity,
                referencedAttribute: rel.ReferencedAttribute,
                referencingEntity: rel.ReferencingEntity,
                referencingAttribute: rel.ReferencingAttribute,
            });
        }

        const manyToManyQuery = `EntityDefinitions(LogicalName='${entityName}')/ManyToManyRelationships?` +
            `$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`;
        const manyToMany = await this.fetchApi(manyToManyQuery);
        
        for (const rel of manyToMany.value) {
            relationships.push({
                schemaName: rel.SchemaName,
                relationshipType: "ManyToMany",
                entity1LogicalName: rel.Entity1LogicalName,
                entity2LogicalName: rel.Entity2LogicalName,
                intersectEntityName: rel.IntersectEntityName,
            });
        }

        return relationships;
    }

    private mapOptionSet(optionSet: any): OptionSetMetadata {
        return {
            name: optionSet.Name,
            metadataId: optionSet.MetadataId,
            isGlobal: optionSet.IsGlobal || false,
            options: (optionSet.Options || []).map((opt: any) => ({
                value: opt.Value,
                label: {
                    label: opt.Label?.UserLocalizedLabel?.Label || opt.Label?.LocalizedLabels?.[0]?.Label || "",
                    languageCode: this.labelLanguage,
                },
                color: opt.Color,
            })),
        };
    }

    async fetchGlobalOptionSet(name: string): Promise<OptionSetMetadata> {
        const query = `GlobalOptionSetDefinitions(Name='${name}')?$expand=Options`;
        const result = await this.fetchApi(query);
        return this.mapOptionSet(result);
    }

    async fetchAllEntities(): Promise<string[]> {
        const query = `EntityDefinitions?$select=LogicalName&$filter=IsCustomizable/Value eq true`;
        const result = await this.fetchApi(query);
        return result.value.map((e: any) => e.LogicalName);
    }

    async fetchCSDLMetadata(): Promise<string> {
        const response = await fetch(`${this.serverUrl}/api/data/v9.2/$metadata`, {
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Accept": "application/xml",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch CSDL metadata: ${response.status}`);
        }

        return response.text();
    }

    async fetchWithDelta(entities: string[]): Promise<{
        entities: EntityMetadataCache[];
        serverVersionStamp?: string;
    }> {
        if (!this.cache?.serverVersionStamp) {
            const results: EntityMetadataCache[] = [];
            for (const entity of entities) {
                results.push(await this.fetchEntityMetadata(entity));
            }
            return { entities: results };
        }

        const requestBody = {
            Query: {
                EntityQueryExpression: {
                    Properties: {
                        PropertyNames: [
                            "LogicalName",
                            "SchemaName",
                            "EntitySetName",
                            "PrimaryIdAttribute",
                            "PrimaryNameAttribute",
                            "Attributes"
                        ]
                    },
                    AttributeQuery: {
                        Properties: {
                            PropertyNames: [
                                "LogicalName",
                                "SchemaName",
                                "AttributeType",
                                "RequiredLevel"
                            ]
                        }
                    },
                    LabelQuery: {
                        FilterLanguages: [this.labelLanguage]
                    }
                }
            },
            ClientVersionStamp: this.cache.serverVersionStamp
        };

        const result = await this.fetchApi("RetrieveMetadataChanges", {
            method: "POST",
            body: JSON.stringify(requestBody),
        });

        const updatedEntities: EntityMetadataCache[] = [];
        
        if (result.EntityMetadata) {
            for (const entityData of result.EntityMetadata) {
                if (entities.includes(entityData.LogicalName)) {
                    updatedEntities.push(await this.fetchEntityMetadata(entityData.LogicalName));
                }
            }
        }

        const existingEntities = entities
            .filter(e => !updatedEntities.find(u => u.logicalName === e))
            .map(e => this.cache!.entities[e])
            .filter(Boolean);

        return {
            entities: [...updatedEntities, ...existingEntities],
            serverVersionStamp: result.ServerVersionStamp,
        };
    }

    saveCache(cache: MetadataCache): void {
        if (this.cachePath) {
            const dir = path.dirname(this.cachePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2));
        }
    }
}