import { escapeSearchSpecialCharacters } from "../../helpers/Regex";
import type { Autocomplete, Suggest, Query, SearchEntity, SearchOptions } from "../../dynamics-web-api";
import type { InternalApiConfig } from "../../utils/Config";
import type { SearchApiFunction } from "./search.types";

export function convertSearchQuery(query: Query | Suggest | Autocomplete, functionName: SearchApiFunction, config: InternalApiConfig) {
    if (!query) return query;

    //escape special characters in a search query only if the option is set to true
    if (config?.escapeSpecialCharacters === true) {
        query.search = escapeSearchSpecialCharacters(query.search);
    }

    if (query.entities?.length) {
        query.entities = convertEntitiesProperty(query.entities, config?.version);
    }

    if (functionName === "query") {
        convertQuery(query as Query, config?.version);
    }

    return query;
}

export function convertEntitiesProperty(entities?: string | string[] | SearchEntity[], version: string = "1.0"): string | string[] | undefined {
    if (!entities) return entities;
    if (typeof entities === "string") {
        if (version !== "1.0") return entities;
        try {
            entities = JSON.parse(entities) as SearchEntity[];
        } catch {
            throw new Error("The 'query.entities' property must be a valid JSON string.");
        }

        if (!Array.isArray(entities)) {
            throw new Error("The 'query.entities' property must be an array of strings or objects.");
        }
    }

    const toStringArray = (entity: string | SearchEntity) => {
        if (typeof entity === "string") return entity;
        return entity.name;
    };

    const toSearchEntity = (entity: string | SearchEntity) => {
        if (typeof entity === "string") return { name: entity };
        return entity;
    };

    const toReturn = entities.map((entity: string | SearchEntity) => (version === "1.0" ? toStringArray(entity) : toSearchEntity(entity)));

    if (version !== "1.0") return JSON.stringify(toReturn);
    return toReturn as string[];
}

export function convertQuery(query: Query, version: string = "1.0"): void {
    const toV1 = (query: Query) => {
        if (query.count != null) {
            if (query.returnTotalRecordCount == null) {
                query.returnTotalRecordCount = query.count;
            }
            delete query.count;
        }

        if (query.options) {
            if (typeof query.options === "string") {
                try {
                    query.options = JSON.parse(query.options) as SearchOptions;
                } catch {
                    throw new Error("The 'query.options' property must be a valid JSON string.");
                }
            }

            if (!query.searchMode) {
                query.searchMode = query.options.searchmode;
            }

            if (!query.searchType) {
                query.searchType = query.options.querytype === "lucene" ? "full" : query.options.querytype;
            }

            delete query.options;
        }
    };

    const toV2 = (query: Query) => {
        if (query.returnTotalRecordCount != null) {
            if (query.count == null) {
                query.count = query.returnTotalRecordCount;
            }
            delete query.returnTotalRecordCount;
        }

        if (query.searchMode || query.searchType) {
            //only set the options property if it's not a string
            if (typeof query.options !== "string") {
                if (!query.options) query.options = {};

                if (!query.options.searchmode) {
                    query.options.searchmode = query.searchMode;
                }

                if (!query.options.querytype) {
                    query.options.querytype = query.searchType === "full" ? "lucene" : query.searchType;
                }
            }

            delete query.searchMode;
            delete query.searchType;
        }

        //convert options to string if it's an object
        if (query.options && typeof query.options !== "string") {
            query.options = JSON.stringify(query.options);
        }
    };

    version === "1.0" ? toV1(query) : toV2(query);
}
