import type { IDataverseClient } from "../../client/dataverse";
import type { SuggestRequest, SuggestResponse } from "../../dynamics-web-api";
import { copyObject } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { InternalRequest } from "../../types";
import { LIBRARY_NAME } from "../constants";
import { convertSearchQuery } from "./convertSearchQuery";

const FUNCTION_NAME = "suggest";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;

export async function suggest<TValueDocument = any>(request: string | SuggestRequest, client: IDataverseClient): Promise<SuggestResponse<TValueDocument>> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");

    const _isObject = typeof request !== "string";
    const parameterName = _isObject ? "request.query.search" : "term";
    const internalRequest: InternalRequest = _isObject ? copyObject(request) : { query: { search: request } };

    ErrorHelper.parameterCheck(internalRequest.query, REQUEST_NAME, "request.query");
    ErrorHelper.stringParameterCheck(internalRequest.query.search, REQUEST_NAME, parameterName);
    ErrorHelper.maxLengthStringParameterCheck(internalRequest.query.search, REQUEST_NAME, parameterName, 100);

    internalRequest.functionName = internalRequest.collection = FUNCTION_NAME;
    internalRequest.method = "POST";
    internalRequest.data = convertSearchQuery(internalRequest.query, FUNCTION_NAME, client.config.searchApi);
    internalRequest.apiConfig = client.config.searchApi;

    delete internalRequest.query;

    const response = await client.makeRequest(internalRequest);
    return response?.data;
}
