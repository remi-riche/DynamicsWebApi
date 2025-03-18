import { isRunningWithinPortals, getClientUrl } from "./Utility";
import { ErrorHelper } from "../helpers/ErrorHelper";
import { ApiConfig, Config, SearchApiOptions } from "../dynamics-web-api";
import { LIBRARY_NAME } from "../requests/constants";

type ApiType = "dataApi" | "searchApi";

const FUNCTION_NAME = `${LIBRARY_NAME}.setConfig`;

export interface InternalApiConfig extends ApiConfig {
    url: string;
    escapeSpecialCharacters?: boolean;
}

export interface InternalConfig extends Config {
    dataApi: InternalApiConfig;
    searchApi: InternalApiConfig;
}

const getApiUrl = (serverUrl: string | undefined | null, apiConfig: ApiConfig): string => {
    if (isRunningWithinPortals()) {
        return new URL("_api", global.window.location.origin).toString() + "/";
    } else {
        if (!serverUrl) serverUrl = getClientUrl();
        return new URL(`api/${apiConfig.path}/v${apiConfig.version}`, serverUrl).toString() + "/";
    }
};

const mergeApiConfigs = (apiConfig: ApiConfig | undefined, apiType: ApiType, internalConfig: InternalConfig): void => {
    const internalApiConfig = internalConfig[apiType] as InternalApiConfig;

    if (apiConfig?.version) {
        ErrorHelper.stringParameterCheck(apiConfig.version, FUNCTION_NAME, `config.${apiType}.version`);
        internalApiConfig.version = apiConfig.version;
    }

    if (apiConfig?.path) {
        ErrorHelper.stringParameterCheck(apiConfig.path, FUNCTION_NAME, `config.${apiType}.path`);
        internalApiConfig.path = apiConfig.path;
    }

    if (apiType === "searchApi") {
        mergeSearchApiOptions(apiConfig?.options, internalApiConfig);
    }

    internalApiConfig.url = getApiUrl(internalConfig.serverUrl, internalApiConfig);
};

const mergeSearchApiOptions = (options: SearchApiOptions | undefined, internalApiConfig: InternalApiConfig): void => {
    if (!options) return;

    if (internalApiConfig.escapeSpecialCharacters != null) {
        ErrorHelper.boolParameterCheck(options.escapeSpecialCharacters, FUNCTION_NAME, `config.searchApi.options.escapeSpecialCharacters`);
        internalApiConfig.escapeSpecialCharacters = options.escapeSpecialCharacters;
    }
}

export class ConfigurationUtility {
    static mergeApiConfigs = mergeApiConfigs;

    static merge(internalConfig: InternalConfig, config?: Config): void {
        if (config?.serverUrl) {
            ErrorHelper.stringParameterCheck(config.serverUrl, FUNCTION_NAME, "config.serverUrl");
            internalConfig.serverUrl = config.serverUrl;
        }

        mergeApiConfigs(config?.dataApi, "dataApi", internalConfig);
        mergeApiConfigs(config?.searchApi, "searchApi", internalConfig);

        if (config?.impersonate) {
            internalConfig.impersonate = ErrorHelper.guidParameterCheck(config.impersonate, FUNCTION_NAME, "config.impersonate");
        }

        if (config?.impersonateAAD) {
            internalConfig.impersonateAAD = ErrorHelper.guidParameterCheck(config.impersonateAAD, FUNCTION_NAME, "config.impersonateAAD");
        }

        if (config?.onTokenRefresh) {
            ErrorHelper.callbackParameterCheck(config.onTokenRefresh, FUNCTION_NAME, "config.onTokenRefresh");
            internalConfig.onTokenRefresh = config.onTokenRefresh;
        }

        if (config?.includeAnnotations) {
            ErrorHelper.stringParameterCheck(config.includeAnnotations, FUNCTION_NAME, "config.includeAnnotations");
            internalConfig.includeAnnotations = config.includeAnnotations;
        }

        if (config?.timeout) {
            ErrorHelper.numberParameterCheck(config.timeout, FUNCTION_NAME, "config.timeout");
            internalConfig.timeout = config.timeout;
        }

        if (config?.maxPageSize) {
            ErrorHelper.numberParameterCheck(config.maxPageSize, FUNCTION_NAME, "config.maxPageSize");
            internalConfig.maxPageSize = config.maxPageSize;
        }

        if (config?.returnRepresentation) {
            ErrorHelper.boolParameterCheck(config.returnRepresentation, FUNCTION_NAME, "config.returnRepresentation");
            internalConfig.returnRepresentation = config.returnRepresentation;
        }

        if (config?.useEntityNames) {
            ErrorHelper.boolParameterCheck(config.useEntityNames, FUNCTION_NAME, "config.useEntityNames");
            internalConfig.useEntityNames = config.useEntityNames;
        }

        if (config?.headers) {
            internalConfig.headers = config.headers;
        }

        if (!global.DWA_BROWSER && config?.proxy) {
            ErrorHelper.parameterCheck(config.proxy, FUNCTION_NAME, "config.proxy");

            if (config.proxy.url) {
                ErrorHelper.stringParameterCheck(config.proxy.url, FUNCTION_NAME, "config.proxy.url");

                if (config.proxy.auth) {
                    ErrorHelper.parameterCheck(config.proxy.auth, FUNCTION_NAME, "config.proxy.auth");
                    ErrorHelper.stringParameterCheck(config.proxy.auth.username, FUNCTION_NAME, "config.proxy.auth.username");
                    ErrorHelper.stringParameterCheck(config.proxy.auth.password, FUNCTION_NAME, "config.proxy.auth.password");
                }
            }

            internalConfig.proxy = config.proxy;
        }
    }

    static default(): InternalConfig {
        return {
            serverUrl: null,
            impersonate: null,
            impersonateAAD: null,
            onTokenRefresh: null,
            includeAnnotations: null,
            maxPageSize: null,
            returnRepresentation: null,
            proxy: null,
            dataApi: {
                path: "data",
                version: "9.2",
                url: "",
            },
            searchApi: {
                path: "search",
                version: "1.0",
                url: "",
            },
        };
    }
}
