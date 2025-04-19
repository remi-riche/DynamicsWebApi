import { dateReviver } from "../../../client/helpers";
import type { QueryResponse } from "../../../dynamics-web-api";
import type { InternalApiConfig } from "../../../utils/Config";

export interface QueryResponseInternal extends Omit<QueryResponse, "response"> {
    response: string;
}

export function parseQueryResponse(queryResponse: QueryResponseInternal, config: InternalApiConfig): QueryResponse {
    if (!queryResponse) return queryResponse;

    const toV1 = (): QueryResponse => {
        const responseValue = JSON.parse(queryResponse.response, dateReviver) as QueryResponse["response"];

        return {
            ...queryResponse,
            value: responseValue.Value,
            facets: responseValue.Facets,
            totalrecordcount: responseValue.Count,
            querycontext: responseValue.QueryContext,
            response: responseValue,
        };
    };

    const toV2 = (): QueryResponse => {
        return {
            ...queryResponse,
            response: {
                Count: queryResponse.totalrecordcount,
                Value: queryResponse.value,
                Facets: queryResponse.facets,
                QueryContext: queryResponse.querycontext,
                Error: null,
            },
        };
    };

    return config?.version === "2.0" ? toV1() : toV2();
}
