import type { IDataverseClient } from "../../client/dataverse";
import type { RetrieveGlobalOptionSetRequest, RetrieveRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { retrieve } from "../retrieve";

const FUNCTION_NAME = "retrieveGlobalOptionSet";
const REQUEST_NAME = `DynamicsWebApi.${FUNCTION_NAME}`;

export async function retrieveGlobalOptionSet<T = any>(request: RetrieveGlobalOptionSetRequest, client: IDataverseClient): Promise<T> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");

    if (request.castType) {
        ErrorHelper.stringParameterCheck(request.castType, REQUEST_NAME, "request.castType");
    }

    const internalRequest = copyRequest(request);
    internalRequest.collection = "GlobalOptionSetDefinitions";
    internalRequest.navigationProperty = request.castType;
    internalRequest.functionName = FUNCTION_NAME;

    return retrieve(<RetrieveRequest>internalRequest, client);
}