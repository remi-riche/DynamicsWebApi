import type { IDataverseClient } from "../../client/dataverse";
import type { UpdateRelationshipRequest, UpdateRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { update } from "../update";
import { LIBRARY_NAME } from "../constants";
import { ErrorHelper } from "../../helpers/ErrorHelper";

const FUNCTION_NAME = "updateRelationship";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;


export function updateRelationship<T = any>(request: UpdateRelationshipRequest, client: IDataverseClient): Promise<T> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");
    ErrorHelper.parameterCheck(request.data, REQUEST_NAME, "request.data");
    ErrorHelper.guidParameterCheck(request.data.MetadataId, REQUEST_NAME, "request.data.MetadataId");

    if (request.castType) {
        ErrorHelper.stringParameterCheck(request.castType, REQUEST_NAME, "request.castType");
    }

    const internalRequest = copyRequest(request);
    internalRequest.collection = "RelationshipDefinitions";
    internalRequest.key = request.data.MetadataId;
    internalRequest.navigationProperty = request.castType;
    internalRequest.functionName = FUNCTION_NAME;
    internalRequest.method = "PUT";

    return update(internalRequest as UpdateRequest, client);
}