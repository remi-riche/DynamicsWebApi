import type { IDataverseClient } from "../../client/dataverse";
import type { CreateGlobalOptionSetRequest, CreateRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { create } from "../create";

const FUNCTION_NAME = "createGlobalOptionSet";
const REQUEST_NAME = `DynamicsWebApi.${FUNCTION_NAME}`;

export async function createGlobalOptionSet<T = any>(request: CreateGlobalOptionSetRequest, client: IDataverseClient): Promise<T> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");
    ErrorHelper.parameterCheck(request.data, REQUEST_NAME, "request.data");

    const internalRequest = copyRequest(request);
    internalRequest.collection = "GlobalOptionSetDefinitions";
    internalRequest.functionName = FUNCTION_NAME;

    return create(<CreateRequest>internalRequest, client);
}
