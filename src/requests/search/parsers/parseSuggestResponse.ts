import { dateReviver } from "../../../client/helpers";
import type { SuggestResponse, SuggestResponseValue } from "../../../dynamics-web-api";
import type { InternalApiConfig } from "../../../utils/Config";

export interface SuggestResponseInternal extends Omit<SuggestResponse, "response"> {
    response: string;
}

export function parseSuggestResponse(queryResponse: SuggestResponseInternal, config: InternalApiConfig): SuggestResponse {
    if (!queryResponse) return queryResponse;

    const toV1 = (): SuggestResponse => {
        const responseValue = JSON.parse(queryResponse.response, dateReviver) as SuggestResponse["response"];

        responseValue.Value?.forEach((item: SuggestResponseValue) => {
            item.document = item.Document;
            item.text = item.Text;
        });

        return {
            ...queryResponse,
            value: responseValue.Value,
            querycontext: responseValue.QueryContext,
            response: responseValue,
        };
    };

    const toV2 = (): SuggestResponse => {
        queryResponse.value?.forEach((item: SuggestResponseValue) => {
            item.Document = item.document;
            item.Text = item.text;
        });

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
