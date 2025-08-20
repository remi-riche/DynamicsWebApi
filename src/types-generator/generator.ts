import * as fs from "fs";
import * as path from "path";
import { MetadataFetcher } from "./fetcher/MetadataFetcher";
import { TypeTranspiler } from "./transpiler/TypeTranspiler";
import { TypeScriptRenderer } from "./renderer/TypeScriptRenderer";
import { CSDLParser } from "./parser/CSDLParser";
import { 
    GeneratorOptions, 
    MetadataCache,
    EntityMetadataCache,
} from "./types";

export interface GenerateResult {
    entityCount: number;
    enumCount: number;
    actionCount: number;
    relationshipCount: number;
    cacheUpdated: boolean;
    preview?: string;
}

export async function generateTypes(options: GeneratorOptions): Promise<GenerateResult> {
    const fetcher = new MetadataFetcher(options);
    await fetcher.initialize();

    let entities: string[] = [];
    if (options.entities === "*") {
        entities = await fetcher.fetchAllEntities();
    } else if (Array.isArray(options.entities)) {
        entities = options.entities;
    } else {
        throw new Error("Invalid entities configuration");
    }

    let entityMetadata: EntityMetadataCache[];
    let serverVersionStamp: string | undefined;

    if (options.deltaCache) {
        const deltaResult = await fetcher.fetchWithDelta(entities);
        entityMetadata = deltaResult.entities;
        serverVersionStamp = deltaResult.serverVersionStamp;
    } else {
        entityMetadata = [];
        for (const entity of entities) {
            const metadata = await fetcher.fetchEntityMetadata(entity);
            entityMetadata.push(metadata);
        }
    }

    const globalOptionSets = new Map<string, any>();
    const referencedGlobalOptionSets = new Set<string>();

    for (const entity of entityMetadata) {
        for (const attr of entity.attributes) {
            if (attr.globalOptionSet) {
                referencedGlobalOptionSets.add(attr.globalOptionSet);
            }
        }
    }

    if (options.includeOptionSets) {
        for (const globalOptionSetName of referencedGlobalOptionSets) {
            try {
                const optionSet = await fetcher.fetchGlobalOptionSet(globalOptionSetName);
                globalOptionSets.set(globalOptionSetName, optionSet);
            } catch (error) {
                console.warn(`Failed to fetch global option set ${globalOptionSetName}:`, error);
            }
        }
    }

    let actions: any[] = [];
    let functions: any[] = [];

    if (options.includeActions) {
        const csdl = await fetcher.fetchCSDLMetadata();
        const parser = new CSDLParser();
        const parsedMetadata = parser.parse(csdl);
        actions = parsedMetadata.actions;
        functions = parsedMetadata.functions;
    }

    const transpiler = new TypeTranspiler({
        customTypes: options.customTypes,
        namingConvention: options.namingConvention,
        lookupStyle: options.lookupStyle,
        includeOptionSets: options.includeOptionSets,
        includeRelationships: options.includeRelationships,
    });

    const generatedTypes = transpiler.transpile(entityMetadata, globalOptionSets);

    if (actions.length > 0) {
        const actionInterfaces = transpiler.transpileActions(actions);
        for (const [name, def] of actionInterfaces) {
            generatedTypes.interfaces.set(name, def);
        }
    }

    const renderer = new TypeScriptRenderer({
        emitRuntime: options.emitRuntime,
    });

    const output = renderer.render(generatedTypes);

    const outputPath = options.output || "./src/types/dataverse.d.ts";
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, output);

    if (options.deltaCache && serverVersionStamp) {
        const cache: MetadataCache = {
            version: "1.0.0",
            serverVersionStamp,
            entities: entityMetadata.reduce((acc, entity) => {
                acc[entity.logicalName] = entity;
                return acc;
            }, {} as Record<string, EntityMetadataCache>),
            globalOptionSets: Object.fromEntries(globalOptionSets),
            actions: actions.reduce((acc, action) => {
                acc[action.name] = action;
                return acc;
            }, {}),
            functions: functions.reduce((acc, func) => {
                acc[func.name] = func;
                return acc;
            }, {}),
            lastUpdated: new Date().toISOString(),
        };
        fetcher.saveCache(cache);
    }

    const relationshipCount = entityMetadata.reduce((count, entity) => {
        return count + (entity.relationships?.length || 0);
    }, 0);

    return {
        entityCount: entityMetadata.length,
        enumCount: generatedTypes.enums.size,
        actionCount: actions.length + functions.length,
        relationshipCount,
        cacheUpdated: !!serverVersionStamp,
        preview: output.substring(0, 1000),
    };
}