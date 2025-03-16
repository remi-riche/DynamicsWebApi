import type { IDataverseClient } from "../../client/dataverse";
import type { DeleteRelationshipRequest, DeleteRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { LIBRARY_NAME } from "../constants";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { deleteRecord } from "../delete";

const FUNCTION_NAME = "deleteRelationship";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;

export async function deleteRelationship(request: DeleteRelationshipRequest, client: IDataverseClient): Promise<any> {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");
    ErrorHelper.keyParameterCheck(request.key, REQUEST_NAME, "request.key");

    const internalRequest = copyRequest(request);
    internalRequest.collection = "RelationshipDefinitions";
    internalRequest.functionName = FUNCTION_NAME;

    return deleteRecord(internalRequest as DeleteRequest, client);
}