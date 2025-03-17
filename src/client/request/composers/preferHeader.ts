import type { Config } from "../../../dynamics-web-api";
import type { InternalRequest } from "../../../types";
import { ErrorHelper } from "../../../helpers/ErrorHelper";
import { removeDoubleQuotes } from "../../../helpers/Regex";

export const composePreferHeader = (request: InternalRequest, config: Config): string => {
    let { returnRepresentation, includeAnnotations, maxPageSize, trackChanges, continueOnError } = request;

    if (request.prefer && request.prefer.length) {
        ErrorHelper.stringOrArrayParameterCheck(request.prefer, `DynamicsWebApi.${request.functionName}`, "request.prefer");
        const preferArray = typeof request.prefer === "string" ? request.prefer.split(",") : request.prefer;

        preferArray.forEach((item) => {
            const trimmedItem = item.trim();
            if (trimmedItem === "return=representation") {
                returnRepresentation = true;
            } else if (trimmedItem.includes("odata.include-annotations=")) {
                includeAnnotations = removeDoubleQuotes(trimmedItem.replace("odata.include-annotations=", ""));
            } else if (trimmedItem.startsWith("odata.maxpagesize=")) {
                maxPageSize = Number(removeDoubleQuotes(trimmedItem.replace("odata.maxpagesize=", ""))) || 0;
            } else if (trimmedItem.includes("odata.track-changes")) {
                trackChanges = true;
            } else if (trimmedItem.includes("odata.continue-on-error")) {
                continueOnError = true;
            }
        });
    }

    //clear array
    const prefer: string[] = [];

    if (config) {
        if (returnRepresentation == null) {
            returnRepresentation = config.returnRepresentation;
        }
        includeAnnotations = includeAnnotations ?? config.includeAnnotations;
        maxPageSize = maxPageSize ?? config.maxPageSize;
    }

    if (returnRepresentation) {
        ErrorHelper.boolParameterCheck(returnRepresentation, `DynamicsWebApi.${request.functionName}`, "request.returnRepresentation");
        prefer.push("return=representation");
    }

    if (includeAnnotations) {
        ErrorHelper.stringParameterCheck(includeAnnotations, `DynamicsWebApi.${request.functionName}`, "request.includeAnnotations");
        prefer.push(`odata.include-annotations="${includeAnnotations}"`);
    }

    if (maxPageSize && maxPageSize > 0) {
        ErrorHelper.numberParameterCheck(maxPageSize, `DynamicsWebApi.${request.functionName}`, "request.maxPageSize");
        prefer.push("odata.maxpagesize=" + maxPageSize);
    }

    if (trackChanges) {
        ErrorHelper.boolParameterCheck(trackChanges, `DynamicsWebApi.${request.functionName}`, "request.trackChanges");
        prefer.push("odata.track-changes");
    }

    if (continueOnError) {
        ErrorHelper.boolParameterCheck(continueOnError, `DynamicsWebApi.${request.functionName}`, "request.continueOnError");
        prefer.push("odata.continue-on-error");
    }

    return prefer.join(",");
};