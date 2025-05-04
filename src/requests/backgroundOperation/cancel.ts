import type { IDataverseClient } from "../../client/dataverse";
import type { BackgroundOperationStatusResponse } from "../../dynamics-web-api";

import { ErrorHelper } from "../../helpers/ErrorHelper";
import { InternalRequest } from "../../types";
import { LIBRARY_NAME } from "../constants";

const FUNCTION_NAME = "cancelBackgroundOperation";
const REQUEST_NAME = `${LIBRARY_NAME}.${FUNCTION_NAME}`;

export async function cancelBackgroundOperation(backgroundOperationId: string, client: IDataverseClient): Promise<BackgroundOperationStatusResponse> {
    ErrorHelper.throwBatchIncompatible(REQUEST_NAME, client.isBatch);
    ErrorHelper.keyParameterCheck(backgroundOperationId, REQUEST_NAME, "backgroundOperationId");

    const internalRequest: InternalRequest = {
        method: "DELETE",
        addPath: `backgroundoperation/${backgroundOperationId}`,
        functionName: FUNCTION_NAME,
        apiConfig: client.config.serviceApi,
        includeDefaultDataverseHeaders: false,
        headers: {
            "Content-Type": "application/json",
        },
        _isUnboundRequest: true,
    };

    const response = await client.makeRequest(internalRequest);
    return response?.data;
}
