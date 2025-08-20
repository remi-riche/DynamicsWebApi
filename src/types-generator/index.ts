/**
 * DynamicsWebApi Type Generator
 * Generates TypeScript type definitions from Dataverse metadata
 */

export { generateTypes } from "./generator";
export { TypeGeneratorConfig, GeneratorOptions } from "./types";
export { MetadataFetcher } from "./fetcher/MetadataFetcher";
export { TypeTranspiler } from "./transpiler/TypeTranspiler";
export { EntityTypeManager, createEntityTypeManager, EntityTypeManagerConfig } from "./entity-manager";
export { 
    COMMON_DATAVERSE_ENTITIES,
    SYSTEMUSER_METADATA,
    getRecommendedEntities,
    getSystemEntities,
    getActivityEntities,
    EntityCategory 
} from "./cdm/common-entities";