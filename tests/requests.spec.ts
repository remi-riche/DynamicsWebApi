import { expect } from "chai";
import { IDataverseClient } from "../src/client/dataverse";
import { Config } from "../src/dynamics-web-api";
import { countAll } from "../src/requests";
import { InternalRequest, WebApiResponse } from "../src/types";
import { ConfigurationUtility } from "../src/utils/Config";
import { makeRequest } from "../src/client/RequestClient";

const defaultClient: IDataverseClient = {
    config: ConfigurationUtility.default(),
    isBatch: false,
    batchRequestId: null,
    makeRequest: async (_request: InternalRequest) => undefined,
    setConfig: (_config: Config): void => {},
};

describe("countAll", () => {
    it("returns number of items in an array", async () => {
        const testClient = {
            ...defaultClient,
            makeRequest: async (_request: InternalRequest) => {
                return { data: { value: ["something", "test"] } } as WebApiResponse;
            },
        };

        const response = await countAll(
            {
                collection: "test",
            },
            testClient,
        );

        expect(response).to.equal(2);
    });
});
