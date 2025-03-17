import type { Autocomplete, Suggest, Query, SearchEntity } from "../../dynamics-web-api";
import { InternalConfig } from "../../utils/Config";

export function convertSearchQuery(query: Query | Suggest | Autocomplete, functionName: string, config: InternalConfig) {
    if (!query) return query;

    query.entities = convertEntitiesProperty(query.entities, config.searchApi?.version);
    if (functionName === "query") {
        query = convertQuery(query as Query, config.searchApi?.version);
    }

    return query;
}

function convertEntitiesProperty(entities?: string | string[] | SearchEntity[], version: string = "1.0"): string | string[] | SearchEntity[] | undefined {
    if (!entities) return entities;
    if (typeof entities === "string") {
        if (version !== "1.0") return entities;
        throw new Error(
            "The 'entities' property must be an array of strings in the Search API v1.0. It cannot be a string. Or set Search API version to v2.0.",
        );
    }

    const toStringArray = (entity: string | SearchEntity) => {
        if (typeof entity === "string") return entity;
        return entity.name;
    };

    const toSearchEntity = (entity: string | SearchEntity) => {
        if (typeof entity === "string") return { name: entity };
        return entity;
    };

    return entities.map((entity: string | SearchEntity) => (version === "1.0" ? toStringArray(entity) : toSearchEntity(entity))) as string[] | SearchEntity[];
}

function convertQuery(query: Query, version: string = "1.0") {
    const toV1 = (query: Query) => {
        if (query.count != null) {
            query.returnTotalRecordCount = query.count;
            delete query.count;
        }

        if (query.options) {
            if (!query.searchMode) {
                query.searchMode = query.options.searchmode;
            }

            if (!query.searchType) {
                query.searchType = query.options.querytype === "simple" ? "simple" : "full";
            }

            delete query.options;
        }

        return query;
    };

    const toV2 = (query: Query) => {
        if (query.returnTotalRecordCount != null) {
            query.count = query.returnTotalRecordCount;
            delete query.returnTotalRecordCount;
        }

        if (query.searchMode || query.searchType) {
            if (!query.options) query.options = {};

            if (!query.options.searchmode) {
                query.options.searchmode = query.searchMode;
            }

            if (!query.options.querytype) {
                query.options.querytype = query.searchType === "simple" ? "simple" : "lucene";
            }

            delete query.searchMode;
            delete query.searchType;
        }

        return query;
    };

    return version === "1.0" ? toV1(query) : toV2(query);
}
