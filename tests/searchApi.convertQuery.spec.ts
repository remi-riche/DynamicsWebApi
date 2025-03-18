import { expect } from "chai";

import { Query } from "../src/dynamics-web-api";
import { convertEntitiesProperty, convertQuery, convertSearchQuery } from "../src/requests/search/convertSearchQuery";
import { InternalApiConfig } from "../src/utils/Config";

describe("convertEntitiesProperty", () => {
    describe("v1.0 <- v2.0", () => {
        describe("string", () => {
            const entities = JSON.stringify([
                {
                    name: "account",
                    filter: "filter should be removed",
                },
                {
                    name: "contact",
                    filter: "filter should be removed",
                },
            ]);

            it("converts the entities correctly", () => {
                const convertedEntities = convertEntitiesProperty(entities, "1.0");

                expect(convertedEntities).to.deep.equal(["account", "contact"]);
            });
        });

        describe("invalid json string", () => {
            const entities = "invalid json string";

            it("throws an error", () => {
                expect(function () {
                    convertEntitiesProperty(entities, "1.0");
                }).to.throw("The 'query.entities' property must be a valid JSON string.");
            });
        });

        describe("string - not an array", () => {
            const entities = '{ "test": "invalid json string" }';

            it("throws an error", () => {
                expect(function () {
                    convertEntitiesProperty(entities, "1.0");
                }).to.throw("The 'query.entities' property must be an array of strings or objects.");
            });
        });

        describe("array of objects", () => {
            const entities = [
                {
                    name: "account",
                    filter: "filter should be removed",
                },
                {
                    name: "contact",
                    filter: "filter should be removed",
                },
            ];

            it("converts the entities correctly", () => {
                const convertedEntities = convertEntitiesProperty(entities, "1.0");

                expect(convertedEntities).to.deep.equal(["account", "contact"]);
            });
        });

        describe("array of strings", () => {
            const entities = ["account", "contact"];

            it("should be left as is", () => {
                const convertedEntities = convertEntitiesProperty(entities, "1.0");

                expect(convertedEntities).to.deep.equal(["account", "contact"]);
            });
        });
    });

    describe("v2.0 <- v1.0", () => {
        describe("string", () => {
            const entities = "does not matter what is in here";

            it("should be left as is", () => {
                const convertedEntities = convertEntitiesProperty(entities, "2.0");

                expect(convertedEntities).to.deep.equal(entities);
            });
        });

        describe("array of strings", () => {
            const entities = ["account", "contact"];

            it("converts the entities correctly", () => {
                const convertedEntities = convertEntitiesProperty(entities, "2.0");

                expect(convertedEntities).to.deep.equal(
                    JSON.stringify([
                        {
                            name: "account",
                        },
                        {
                            name: "contact",
                        },
                    ]),
                );
            });
        });

        describe("array of objects", () => {
            const entities = [
                {
                    name: "account",
                    filter: "filter should be removed",
                },
                {
                    name: "contact",
                    filter: "filter should be removed",
                },
            ];

            it("should become a string", () => {
                const convertedEntities = convertEntitiesProperty(entities, "2.0");

                expect(convertedEntities).to.equal(JSON.stringify(entities));
            });
        });
    });
});

describe("convertQuery", () => {
    describe("v1.0 <- v2.0", () => {
        describe("options (string)", () => {
            const searchQuery: Query = {
                search: "test",
                options: JSON.stringify({
                    searchmode: "any",
                    querytype: "simple",
                }),
            };

            it("converts the query correctly", () => {
                convertQuery(searchQuery, "1.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    searchMode: "any",
                    searchType: "simple",
                });
            });
        });

        describe("options (invalid json string)", () => {
            const searchQuery: Query = {
                search: "test",
                options: "invalid json string",
            };

            it("throws an error", () => {
                expect(function () {
                    convertQuery(searchQuery, "1.0");
                }).to.throw("The 'query.options' property must be a valid JSON string.");
            });
        });

        describe("options, count", () => {
            const searchQuery: Query = {
                search: "test",
                count: true,
                options: {
                    searchmode: "all",
                    querytype: "lucene",
                },
            };

            it("converts the query correctly", () => {
                convertQuery(searchQuery, "1.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    returnTotalRecordCount: true,
                    searchMode: "all",
                    searchType: "full",
                });
            });
        });

        describe("options - existing", () => {
            const searchQuery: Query = {
                search: "test",
                searchMode: "all",
                searchType: "full",
                returnTotalRecordCount: false,
                count: true,
                options: {
                    searchmode: "any",
                    querytype: "simple",
                },
            };

            it("should not be rewritten", () => {
                convertQuery(searchQuery, "1.0");
                expect(searchQuery).to.deep.equal({
                    search: "test",
                    searchMode: "all",
                    searchType: "full",
                    returnTotalRecordCount: false,
                });
            });
        });
    });

    describe("v2.0 <- v1.0", () => {
        describe("options (string)", () => {
            const searchQuery: Query = {
                search: "test",
                options: "does not matter what is in here",
            };

            it("left as is", () => {
                convertQuery(searchQuery, "2.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    options: "does not matter what is in here",
                });
            });
        });

        describe("returnTotalRecordCount, searchMode, searchType", () => {
            const searchQuery: Query = {
                search: "test",
                returnTotalRecordCount: true,
                searchMode: "all",
                searchType: "full",
            };

            it("converts the query correctly", () => {
                convertQuery(searchQuery, "2.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    count: true,
                    options: JSON.stringify({
                        searchmode: "all",
                        querytype: "lucene",
                    }),
                });
            });
        });

        describe("existing options - returnTotalRecordCount, searchMode, searchType", () => {
            const searchQuery: Query = {
                search: "test",
                count: false,
                returnTotalRecordCount: true,
                searchMode: "all",
                searchType: "full",
                options: {
                    searchmode: "any",
                    querytype: "simple",
                    besteffortsearchenabled: true,
                },
            };

            it("should not overwrite", () => {
                convertQuery(searchQuery, "2.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    count: false,
                    options: JSON.stringify({
                        searchmode: "any",
                        querytype: "simple",
                        besteffortsearchenabled: true,
                    }),
                });
            });
        });

        describe("options (string) - returnTotalRecordCount, searchMode, searchType", () => {
            const searchQuery: Query = {
                search: "test",
                returnTotalRecordCount: true,
                searchMode: "all",
                searchType: "full",
                options: "does not matter what is in here",
            };

            it("should not overwrite", () => {
                convertQuery(searchQuery, "2.0");

                expect(searchQuery).to.deep.equal({
                    search: "test",
                    count: true,
                    options: "does not matter what is in here",
                });
            });
        });
    });
});

describe("convertSearchQuery", () => {
    const defaultSearchApi: InternalApiConfig = {
        url: "",
    };

    describe("query is null", () => {
        const convertedQuery = convertSearchQuery(null as any, "query", defaultSearchApi);

        it("returns null", () => {
            expect(convertedQuery).to.be.null;
        });
    });

    describe("v1.0 <- v2.0", () => {
        describe("query", () => {
            const searchQuery: Query = {
                search: "test",
                entities: [
                    {
                        name: "account",
                        filter: "filter should be removed",
                    },
                    {
                        name: "contact",
                        filter: "filter should be removed",
                    },
                ],
                count: false,
                options: {
                    searchmode: "any",
                    querytype: "simple",
                },
                facets: ["facet1", "facet2"],
            };

            it("converts the query correctly", () => {
                const convertedQuery = convertSearchQuery(searchQuery, "query", { ...defaultSearchApi, version: "1.0" });

                expect(convertedQuery).to.deep.equal({
                    search: searchQuery.search,
                    returnTotalRecordCount: false,
                    entities: ["account", "contact"],
                    searchMode: "any",
                    searchType: "simple",
                    facets: searchQuery.facets,
                });
            });
        });

        describe("query - escape search term", () => {
            const searchQuery: Query = {
                search: "test+(test)",
                entities: [
                    {
                        name: "account",
                        filter: "filter should be removed",
                    },
                    {
                        name: "contact",
                        filter: "filter should be removed",
                    },
                ],
                count: false,
                options: {
                    searchmode: "any",
                    querytype: "simple",
                },
                facets: ["facet1", "facet2"],
            };

            it("converts the query correctly", () => {
                const convertedQuery = convertSearchQuery(searchQuery, "query", { ...defaultSearchApi, version: "1.0", escapeSpecialCharacters: true });

                expect(convertedQuery).to.deep.equal({
                    search: "test\\+\\(test\\)",
                    returnTotalRecordCount: false,
                    entities: ["account", "contact"],
                    searchMode: "any",
                    searchType: "simple",
                    facets: searchQuery.facets,
                });
            });
        });
    });

    describe("v2.0 <- v1.0", () => {
        describe("returnTotalRecordCount, searchMode, searchType", () => {
            const searchQuery: Query = {
                search: "test",
                returnTotalRecordCount: true,
                searchMode: "all",
                searchType: "full",
            };

            it("converts the query correctly", () => {
                const convertedQuery = convertSearchQuery(searchQuery, "query", { ...defaultSearchApi, version: "2.0" });

                expect(convertedQuery).to.deep.equal({
                    search: "test",
                    count: true,
                    options: JSON.stringify({
                        searchmode: "all",
                        querytype: "lucene",
                    }),
                });
            });
        });
    });
});
