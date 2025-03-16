import type { IDataverseClient } from "../../client/dataverse";
import type { UpdateGlobalOptionSetRequest, UpdateRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { update } from "../update";

const FUNCTION_NAME = "updateGlobalOptionSet";
const REQUEST_NAME = `DynamicsWebApi.${FUNCTION_NAME}`;

export async function updateGlobalOptionSet<T = any>(request: UpdateGlobalOptionSetRequest, client: IDataverseClient): Promise<T> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");
    ErrorHelper.parameterCheck(request.data, REQUEST_NAME, "request.data");
    ErrorHelper.guidParameterCheck(request.data.MetadataId, REQUEST_NAME, "request.data.MetadataId");

    if (request.castType) {
        ErrorHelper.stringParameterCheck(request.castType, REQUEST_NAME, "request.castType");
    }

    const internalRequest = copyRequest(request);
    internalRequest.collection = "GlobalOptionSetDefinitions";
    internalRequest.key = request.data.MetadataId;
    internalRequest.functionName = FUNCTION_NAME;
    internalRequest.method = "PUT";

    return update(<UpdateRequest>internalRequest, client);
}