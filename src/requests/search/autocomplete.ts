import type { IDataverseClient } from "../../client/dataverse";
import type { AutocompleteRequest, AutocompleteResponse } from "../../dynamics-web-api";
import { copyObject, isObject } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { InternalRequest } from "../../types";
import { LIBRARY_NAME } from "../constants";

const FUNCTION_NAME = "autocomplete";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;

export async function autocomplete(request: string | AutocompleteRequest, client: IDataverseClient): Promise<AutocompleteResponse> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");

    const _isObject = isObject(request);
    const parameterName = _isObject ? "request.query.search" : "term";
    const internalRequest: InternalRequest = _isObject ? copyObject(request) : { query: { search: request as string } };

    if (_isObject) ErrorHelper.parameterCheck(internalRequest.query, REQUEST_NAME, "request.query");
    ErrorHelper.stringParameterCheck(internalRequest.query.search, REQUEST_NAME, parameterName);
    ErrorHelper.maxLengthStringParameterCheck(internalRequest.query.search, REQUEST_NAME, parameterName, 100);

    internalRequest.functionName = internalRequest.collection = "autocomplete";
    internalRequest.method = "POST";
    internalRequest.data = internalRequest.query;
    internalRequest.apiConfig = client.config.searchApi;

    delete internalRequest.query;

    const response = await client.makeRequest(internalRequest);
    return response?.data;
}