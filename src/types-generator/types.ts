/**
 * Type definitions for the TypeScript generator
 */

export interface GeneratorOptions {
    serverUrl: string;
    entities?: string[] | "*";
    output?: string;
    includeOptionSets?: boolean;
    includeActions?: boolean;
    includeRelationships?: boolean;
    labelLanguage?: number;
    namingConvention?: "camelCase" | "pascalCase" | "logicalName";
    deltaCache?: string;
    auth?: AuthConfig;
    customTypes?: CustomTypeMapping;
    lookupStyle?: "guid" | "object" | "both";
    emitRuntime?: boolean;
}

export interface AuthConfig {
    type: "client-credentials" | "device-code" | "token-callback";
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    tokenCallback?: () => Promise<string>;
}

export interface CustomTypeMapping {
    money?: "number" | "string" | "Decimal";
    datetime?: "Date" | "string" | "moment";
    decimal?: "number" | "string" | "Decimal";
    bigint?: "bigint" | "string" | "number";
}

export interface TypeGeneratorConfig {
    output: string;
    entities: string[];
    includeOptionSets: boolean;
    includeActions: boolean;
    includeRelationships: boolean;
    customTypes: CustomTypeMapping;
    namingConvention: "camelCase" | "pascalCase" | "logicalName";
    lookupStyle: "guid" | "object" | "both";
}

export interface MetadataCache {
    version: string;
    serverVersionStamp?: string;
    entities: Record<string, EntityMetadataCache>;
    globalOptionSets: Record<string, OptionSetMetadata>;
    actions?: Record<string, ActionMetadata>;
    functions?: Record<string, FunctionMetadata>;
    lastUpdated: string;
}

export interface EntityMetadataCache {
    logicalName: string;
    schemaName: string;
    entitySetName: string;
    primaryIdAttribute: string;
    primaryNameAttribute: string;
    attributes: AttributeMetadata[];
    relationships?: RelationshipMetadata[];
    versionStamp?: string;
}

export interface AttributeMetadata {
    logicalName: string;
    schemaName: string;
    attributeType: AttributeType;
    requiredLevel: RequiredLevel;
    isValidForCreate: boolean;
    isValidForUpdate: boolean;
    isValidForRead: boolean;
    isPrimaryId: boolean;
    isPrimaryName: boolean;
    maxLength?: number;
    precision?: number;
    minValue?: number;
    maxValue?: number;
    dateTimeBehavior?: DateTimeBehavior;
    targets?: string[];
    optionSet?: OptionSetMetadata;
    globalOptionSet?: string;
}

export type AttributeType = 
    | "String"
    | "Memo"
    | "Boolean"
    | "Integer"
    | "BigInt"
    | "Double"
    | "Decimal"
    | "Money"
    | "DateTime"
    | "Uniqueidentifier"
    | "Picklist"
    | "State"
    | "Status"
    | "MultiSelectPicklist"
    | "Lookup"
    | "Customer"
    | "Owner"
    | "PartyList"
    | "Image"
    | "File"
    | "Virtual"
    | "ManagedProperty"
    | "CalendarRules"
    | "EntityName";

export interface RequiredLevel {
    value: "None" | "SystemRequired" | "ApplicationRequired" | "Recommended";
    canBeChanged: boolean;
    managedPropertyLogicalName?: string;
}

export interface DateTimeBehavior {
    value: "UserLocal" | "DateOnly" | "TimeZoneIndependent";
}

export interface OptionSetMetadata {
    name?: string;
    metadataId?: string;
    isGlobal: boolean;
    options: OptionMetadata[];
}

export interface OptionMetadata {
    value: number;
    label: LocalizedLabel;
    color?: string;
    isManaged?: boolean;
}

export interface LocalizedLabel {
    label: string;
    languageCode: number;
}

export interface RelationshipMetadata {
    schemaName: string;
    relationshipType: "OneToMany" | "ManyToOne" | "ManyToMany";
    referencedEntity?: string;
    referencedAttribute?: string;
    referencingEntity?: string;
    referencingAttribute?: string;
    navigationPropertyName?: string;
    isManaged?: boolean;
    entity1LogicalName?: string;
    entity2LogicalName?: string;
    intersectEntityName?: string;
}

export interface ActionMetadata {
    name: string;
    isBound: boolean;
    bindingEntityType?: string;
    parameters: ParameterMetadata[];
    returnType?: TypeReference;
}

export interface FunctionMetadata {
    name: string;
    isBound: boolean;
    bindingEntityType?: string;
    isComposable: boolean;
    parameters: ParameterMetadata[];
    returnType?: TypeReference;
}

export interface ParameterMetadata {
    name: string;
    type: TypeReference;
    nullable: boolean;
}

export interface TypeReference {
    type: string;
    isCollection: boolean;
    namespace?: string;
}

export interface GeneratedTypes {
    interfaces: Map<string, InterfaceDefinition>;
    enums: Map<string, EnumDefinition>;
    types: Map<string, TypeAliasDefinition>;
    actions?: Map<string, ActionDefinition>;
    functions?: Map<string, FunctionDefinition>;
}

export interface InterfaceDefinition {
    name: string;
    properties: PropertyDefinition[];
    extends?: string[];
    description?: string;
}

export interface PropertyDefinition {
    name: string;
    type: string;
    optional: boolean;
    description?: string;
    deprecated?: boolean;
}

export interface EnumDefinition {
    name: string;
    members: EnumMember[];
    description?: string;
}

export interface EnumMember {
    name: string;
    value: number | string;
    description?: string;
}

export interface TypeAliasDefinition {
    name: string;
    type: string;
    description?: string;
}

export interface ActionDefinition {
    name: string;
    requestType: string;
    responseType?: string;
    isBound: boolean;
}

export interface FunctionDefinition {
    name: string;
    parameterTypes: Record<string, string>;
    returnType?: string;
    isBound: boolean;
    isComposable: boolean;
}