import { expect } from "chai";
import nock from "nock";
import * as mocks from "./stubs";

import * as RequestClient from "../src/client/RequestClient";
import { ConfigurationUtility, InternalConfig } from "../src/utils/Config";
import * as Core from "../src/types";
import * as Regex from "../src/helpers/Regex";
import * as RequestUtility from "../src/client/request";
import { DynamicsWebApiError } from "../src/helpers/ErrorHelper";
import { composeHeaders } from "../src/client/request/composers";
import { composePreferHeader } from "../src/client/request/composers/preferHeader";

describe("Regex.", () => {
    describe("isUuid -", () => {
        it("uuid === true", () => {
            const result = Regex.isUuid("fb15ee32-524d-41be-b6a0-7d0f28055d52");
            expect(result).to.be.true;
            const result2 = Regex.isUuid("{fb15ee32-524d-41be-b6a0-7d0f28055d52}");
            expect(result2).to.be.true;
        });

        it("uuid === false", function () {
            const result = Regex.isUuid("something");
            expect(result).to.be.false;
            const result2 = Regex.isUuid(null as any);
            expect(result2).to.be.false;
        });
    });

    describe("extractUuid -", function () {
        it("uuid", function () {
            const result = Regex.extractUuid("fb15ee32-524d-41be-b6a0-7d0f28055d52");
            expect(result).to.equal("fb15ee32-524d-41be-b6a0-7d0f28055d52");
            const result2 = Regex.extractUuid("{fb15ee32-524d-41be-b6a0-7d0f28055d52}");
            expect(result2).to.equal("fb15ee32-524d-41be-b6a0-7d0f28055d52");
        });
        it("not uuid - returns null", function () {
            const result = Regex.extractUuid("fb15ee32-524d-41be-b6a0");
            expect(result).to.be.null;
            const result2 = Regex.extractUuid("something");
            expect(result2).to.be.null;
            const result3 = Regex.extractUuid("test{fb15ee32-524d-41be-b6a0-7d0f28055d52}");
            expect(result3).to.be.null;
        });
    });
    describe("extractUuidFromUrl -", function () {
        it("uuid", function () {
            const result = Regex.extractUuidFromUrl(mocks.webApiUrl + "tests(fb15ee32-524d-41be-b6a0-7d0f28055d52)");
            expect(result).to.equal("fb15ee32-524d-41be-b6a0-7d0f28055d52");
        });
        it("not uuid - returns null", function () {
            const result = Regex.extractUuidFromUrl(mocks.webApiUrl + "fb15ee32-524d-41be-b6a0-7d0f28055d52/something-else");
            expect(result).to.be.null;
            const result2 = Regex.extractUuidFromUrl(mocks.webApiUrl + "fb15ee32-524d-41be-b6a0-7d0f28055d52");
            expect(result2).to.be.null;
        });
    });
});

describe("RequestClient.sendRequest", () => {
    describe("request error", function () {
        let scope: nock.Scope;
        const url = "test";
        before(() => {
            scope = nock(mocks.webApiUrl).post("/test", mocks.data.testEntity).reply(500, { Message: "Error" });
        });

        after(() => {
            nock.cleanAll();
            RequestClient._clearTestData();
        });

        it("returns a correct response", async () => {
            try {
                const object = await RequestClient.sendRequest(
                    { method: "POST", path: url, data: mocks.data.testEntity, async: true },
                    { dataApi: { url: mocks.webApiUrl }, searchApi: { url: mocks.webApiUrl } },
                );
                expect(object).to.be.undefined;
            } catch (object: any) {
                if (object.stack) delete object.stack;

                expect(object).to.deep.include({
                    headers: mocks.data.defaultErrorHeaders,
                    status: 500,
                    message: "Error",
                    statusMessage: "Internal Server Error",
                    statusText: "",
                } as DynamicsWebApiError);
            }
        });

        it("all requests have been made", function () {
            expect(scope.isDone()).to.be.true;
        });
    });
});

describe("RequestClient.makeRequest", () => {
    before(() => {
        global.DWA_BROWSER = false;
    });
    describe("AbortSignal", () => {
        let scope: nock.Scope;
        let interceptor: nock.Interceptor;
        const url = "test";
        const controller = new AbortController();
        before(() => {
            const response = mocks.responses.basicEmptyResponseSuccess;
            interceptor = nock(mocks.webApiUrl).post("/test", mocks.data.testEntity);

            scope = interceptor.reply(response.status, response.responseText, response.responseHeaders);
        });

        after(() => {
            nock.cleanAll();
        });

        it("cancels request", async () => {
            const request: Core.InternalRequest = {
                method: "POST",
                functionName: "any",
                collection: url,
                data: mocks.data.testEntityAdditionalAttributes,
                signal: controller.signal,
            };

            const config: InternalConfig = {
                searchApi: { url: "" },
                dataApi: { url: mocks.webApiUrl },
            };

            controller.signal.addEventListener("abort", () =>
                interceptor.replyWithError({
                    code: "ABORT_ERR",
                    name: "AbortError",
                    message: "The operation was aborted",
                }),
            );

            setTimeout(() => controller.abort(), 0);

            try {
                const object = await RequestClient.makeRequest(request, config);
                expect(object).to.be.undefined;
            } catch (error: any) {
                expect(error.message).to.be.eq("The operation was aborted");
                expect(error.code).to.be.eq("ABORT_ERR");
            }
        });

        it("request was not completed", function () {
            expect(scope.isDone()).to.be.false;
        });
    });
    describe("when url is long, request is converted to batch - includes token", function () {
        let scope: nock.Scope;
        let url = "test";
        const testToken = "testToken";

        while (url.length < 2001) {
            url += "test";
        }
        const rBody = mocks.data.batch.replace("{0}", mocks.webApiUrl + url);
        const rBodys = rBody.split("\r\n");
        let checkBody = "";
        for (let i = 0; i < rBodys.length; i++) {
            checkBody += rBodys[i];
        }

        before(function () {
            const response = mocks.responses.batch;
            scope = nock(mocks.webApiUrl, {
                reqheaders: {
                    Authorization: `Bearer ${testToken}`,
                },
            })
                .filteringRequestBody(function (body) {
                    body = body.replace(/dwa_batch_[\d\w]{8}-[\d\w]{4}-[\d\w]{4}-[\d\w]{4}-[\d\w]{12}/g, "dwa_batch_XXX");
                    const bodys = body.split("\r\n");

                    let resultBody = "";
                    for (let i = 0; i < bodys.length; i++) {
                        resultBody += bodys[i];
                    }
                    return resultBody;
                })
                .post("/$batch", checkBody)
                .reply(response.status, response.responseText, response.responseHeaders);
        });

        after(function () {
            nock.cleanAll();
            RequestClient._clearTestData();
        });

        it("returns a correct response", async () => {
            const request: Core.InternalRequest = {
                method: "GET",
                functionName: "test",
                collection: url,
                token: testToken,
            };
            const config: InternalConfig = {
                searchApi: { url: "" },
                dataApi: { url: mocks.webApiUrl },
            };

            try {
                const object = await RequestClient.makeRequest(request, config);

                const multiple = mocks.responses.multiple();
                //delete multiple.oDataContext;
                const expectedO = {
                    status: 200,
                    headers: mocks.data.defaultTextPlainResponseHeaders,
                    data: multiple,
                };
                expect(object).to.deep.equal(expectedO);
            } catch (error) {
                console.error(error);
                throw error;
            }
        });

        it("all requests have been made", function () {
            expect(scope.isDone()).to.be.true;
        });
    });
});

describe("RequestUtility.", () => {
    describe("processData", () => {
        const config = {
            serverUrl: mocks.serverUrl,
            dataApi: {
                url: "data",
                version: "9.2",
            },
            searchApi: {
                url: "search",
                version: "9.2",
            },
        };

        it("removes brackets from the guids & adds a slash in front", () => {
            const guid = "00000000-0000-0000-0000-000000000001";
            const data = {
                "ref1@odata.bind": `contacts({${guid}})`,
            };

            const result = RequestUtility.processData(data, config);

            expect(result).to.be.eq('{"ref1@odata.bind":"/contacts(00000000-0000-0000-0000-000000000001)"}');
        });
    });
});

describe("Composers.composeHeaders -", () => {
    it("custom headers: request overrides config", () => {
        const config = {
            headers: { "custom-header": "1" },
        };

        const dwaRequest = {
            userHeaders: { "custom-header": "10" },
            functionName: "",
        };

        const result = composeHeaders(dwaRequest, config);
        expect(result).to.deep.equal({ "custom-header": "10" });
    });

    it("custom headers: request merges with config", () => {
        const config = {
            headers: { "custom-header": "1", something: "else" },
        };

        const dwaRequest = {
            userHeaders: { "custom-header": "10", john: "doe" },
            functionName: "",
        };

        const result = composeHeaders(dwaRequest, config);
        expect(result).to.deep.equal({ "custom-header": "10", something: "else", john: "doe" });
    });
});

describe("Config.merge -", () => {
    const defaultConfig: InternalConfig = ConfigurationUtility.default();

    it("returnRepresentation = true -> false", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
            returnRepresentation: true,
        };

        ConfigurationUtility.merge(internalConfig, {
            returnRepresentation: false,
        });

        expect(internalConfig.returnRepresentation).to.be.false;
    });

    it("searchApiOptions. escapeSpecialCharacters = null -> true", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
        };

        ConfigurationUtility.merge(internalConfig, {
            searchApi: {
                options: {
                    escapeSpecialCharacters: true,
                },
            },
        });

        expect(internalConfig.searchApi.escapeSpecialCharacters).to.be.true;
    });

    it("searchApiOptions. escapeSpecialCharacters = true -> false", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
            searchApi: {
                url: "",
                escapeSpecialCharacters: true,
            },
        };

        ConfigurationUtility.merge(internalConfig, {
            searchApi: {
                options: {
                    escapeSpecialCharacters: false,
                },
            },
        });

        expect(internalConfig.searchApi.escapeSpecialCharacters).to.be.false;
    });

    it("searchApiOptions. escapeSpecialCharacters = false -> true", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
            searchApi: {
                url: "",
                escapeSpecialCharacters: false,
            },
        };

        ConfigurationUtility.merge(internalConfig, {
            searchApi: {
                options: {
                    escapeSpecialCharacters: true,
                },
            },
        });

        expect(internalConfig.searchApi.escapeSpecialCharacters).to.be.true;
    });

    it("searchApiOptions. empty options does not overwrite current options", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
            searchApi: {
                url: "",
                escapeSpecialCharacters: true,
            },
        };

        ConfigurationUtility.merge(internalConfig, {
            searchApi: {
                options: {},
            },
        });

        expect(internalConfig.searchApi.escapeSpecialCharacters).to.be.true;
    });

    it("searchApiOptions. options = undefined", () => {
        const internalConfig: InternalConfig = {
            ...defaultConfig,
            searchApi: {
                url: "",
                escapeSpecialCharacters: false,
            },
        };

        ConfigurationUtility.merge(internalConfig, {
            searchApi: {
                version: "2.0",
            },
        });

        expect(internalConfig.searchApi.escapeSpecialCharacters).to.be.false;
        expect(internalConfig.searchApi.version).to.be.eq("2.0");
    });
});

describe("composePreferHeader -", () => {
    it("respond-async", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
            },
            {},
        );

        expect(preferHeader).to.be.eq("respond-async");
    });

    it("respond-async - false", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: false,
            },
            {},
        );

        expect(preferHeader).to.be.eq("");
    });

    it("respond-async - in a prefer header as string, backgroundOperationCallbackUrl", () => {
        const preferHeader = composePreferHeader(
            {
                prefer: "respond-async",
                backgroundOperationCallbackUrl: "https://test.com",
            },
            {},
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://test.com"');
    });

    it("respond-async, backgroundOperationCallbackUrl", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
                backgroundOperationCallbackUrl: "https://test.com",
            },
            {},
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://test.com"');
    });

    it("respond-async, backgroundOperationCallbackUrl - as a string in prefer header", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
                prefer: "odata.callback;url=https://test.com",
            },
            {},
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://test.com"');
    });

    it("backgroundOperationCallbackUrl only - does not add anything", () => {
        const preferHeader = composePreferHeader(
            {
                backgroundOperationCallbackUrl: "https://test.com",
            },
            {},
        );

        expect(preferHeader).to.be.eq("");
    });

    it("backgroundOperationCallbackUrl as a string in prefer header - does not add anything", () => {
        const preferHeader = composePreferHeader(
            {
                prefer: "odata.callback;url=https://test.com",
            },
            {},
        );

        expect(preferHeader).to.be.eq("");
    });

    it("respond-async, backgroundOperationCallbackUrl, returnRepresentation", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
                backgroundOperationCallbackUrl: "https://test.com",
                returnRepresentation: true,
            },
            {},
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://test.com",return=representation');
    });

    it("respond-async, config.backgroundOperationCallbackUrl", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
            },
            { backgroundOperationCallbackUrl: "https://test.com" },
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://test.com"');
    });

    it("respond-async, backgroundOperationCallbackUrl, config.backgroundOperationCallbackUrl - request takes priority", () => {
        const preferHeader = composePreferHeader(
            {
                respondAsync: true,
                backgroundOperationCallbackUrl: "https://request.com",
            },
            { backgroundOperationCallbackUrl: "https://test.com" },
        );

        expect(preferHeader).to.be.eq('respond-async,odata.callback;url="https://request.com"');
    });

    it("custom-prefer-header", () => {
        const preferHeader = composePreferHeader(
            {
                prefer: "custom-prefer-header",
            },
            {},
        );

        expect(preferHeader).to.be.eq("custom-prefer-header");
    });

    it("returnRepresentation, custom-prefer-header", () => {
        const preferHeader = composePreferHeader(
            {
                returnRepresentation: true,
                prefer: "custom-prefer-header",
            },
            {},
        );

        expect(preferHeader).to.be.eq("custom-prefer-header,return=representation");
    });
});
