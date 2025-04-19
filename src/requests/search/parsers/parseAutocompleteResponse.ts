import { dateReviver } from "../../../client/helpers";
import type { AutocompleteResponse } from "../../../dynamics-web-api";
import type { InternalApiConfig } from "../../../utils/Config";

export interface AutocompleteResponseInternal extends Omit<AutocompleteResponse, "response"> {
    response: string;
}

export function parseAutocompleteResponse(queryResponse: AutocompleteResponseInternal, config: InternalApiConfig): AutocompleteResponse {
    if (!queryResponse) return queryResponse;

    const toV1 = (): AutocompleteResponse => {
        const responseValue = JSON.parse(queryResponse.response, dateReviver) as AutocompleteResponse["response"];

        return {
            ...queryResponse,
            value: responseValue.Value,
            querycontext: responseValue.QueryContext,
            response: responseValue,
        };
    };

    const toV2 = (): AutocompleteResponse => {
        return {
            ...queryResponse,
            response: {
                Value: queryResponse.value,
                QueryContext: queryResponse.querycontext,
                Error: null,
            },
        };
    };

    return config?.version === "2.0" ? toV1() : toV2();
}
