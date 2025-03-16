import type { IDataverseClient } from "../../client/dataverse";
import type { CreateRequest, CreateRelationshipRequest } from "../../dynamics-web-api";
import { copyRequest } from "../../utils/Utility";
import { create } from "../create";
import { LIBRARY_NAME } from "../constants";
import { ErrorHelper } from "../../helpers/ErrorHelper";

const FUNCTION_NAME = "createRelationship";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;

export const createRelationship = <T = any>(request: CreateRelationshipRequest, client: IDataverseClient): Promise<T> => {
    ErrorHelper.parameterCheck(request, REQUEST_NAME, "request");
    ErrorHelper.parameterCheck(request.data, REQUEST_NAME, "request.data");

    const internalRequest = copyRequest(request);
    internalRequest.collection = "RelationshipDefinitions";
    internalRequest.functionName = FUNCTION_NAME;

    return create(internalRequest as CreateRequest, client);
};