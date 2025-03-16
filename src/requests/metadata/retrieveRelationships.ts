import type { IDataverseClient } from "../../client/dataverse";
import type { RetrieveRelationshipsRequest, RetrieveMultipleRequest, RetrieveMultipleResponse } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { retrieveMultiple } from "../retrieveMultiple";
import { InternalRequest } from "../../types";

const FUNCTION_NAME = "retrieveRelationships";
const REQUEST_NAME = `DynamicsWebApi.${FUNCTION_NAME}`;

export async function retrieveRelationships<T = any>(request: RetrieveRelationshipsRequest | undefined, client: IDataverseClient): Promise<RetrieveMultipleResponse<T>> {
    const internalRequest: InternalRequest = !request ? {} : copyRequest(request);

    internalRequest.collection = "RelationshipDefinitions";
    internalRequest.functionName = FUNCTION_NAME;

    if (request) {
        if (request.castType) {
            ErrorHelper.stringParameterCheck(request.castType, REQUEST_NAME, "request.castType");
            internalRequest.navigationProperty = request.castType;
        }
    }

    return retrieveMultiple(<RetrieveMultipleRequest>internalRequest, client);
}