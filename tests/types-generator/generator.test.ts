import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { generateTypes } from "../../src/types-generator/generator";
import { MetadataFetcher } from "../../src/types-generator/fetcher/MetadataFetcher";
import { TypeTranspiler } from "../../src/types-generator/transpiler/TypeTranspiler";
import { TypeScriptRenderer } from "../../src/types-generator/renderer/TypeScriptRenderer";
import { CSDLParser } from "../../src/types-generator/parser/CSDLParser";
import * as fs from "fs";

jest.mock("../../src/types-generator/fetcher/MetadataFetcher");
jest.mock("../../src/types-generator/transpiler/TypeTranspiler");
jest.mock("../../src/types-generator/renderer/TypeScriptRenderer");
jest.mock("../../src/types-generator/parser/CSDLParser");
jest.mock("fs");

describe("Type Generator", () => {
    let mockFetcher: jest.Mocked<MetadataFetcher>;
    let mockTranspiler: jest.Mocked<TypeTranspiler>;
    let mockRenderer: jest.Mocked<TypeScriptRenderer>;
    let mockParser: jest.Mocked<CSDLParser>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockFetcher = {
            initialize: jest.fn().mockResolvedValue(undefined),
            fetchEntityMetadata: jest.fn().mockResolvedValue({
                logicalName: "account",
                schemaName: "Account",
                entitySetName: "accounts",
                primaryIdAttribute: "accountid",
                primaryNameAttribute: "name",
                attributes: [
                    {
                        logicalName: "accountid",
                        schemaName: "AccountId",
                        attributeType: "Uniqueidentifier",
                        requiredLevel: { value: "SystemRequired" },
                        isValidForCreate: false,
                        isValidForUpdate: false,
                        isValidForRead: true,
                        isPrimaryId: true,
                        isPrimaryName: false,
                    },
                    {
                        logicalName: "name",
                        schemaName: "Name",
                        attributeType: "String",
                        requiredLevel: { value: "ApplicationRequired" },
                        isValidForCreate: true,
                        isValidForUpdate: true,
                        isValidForRead: true,
                        isPrimaryId: false,
                        isPrimaryName: true,
                        maxLength: 160,
                    },
                    {
                        logicalName: "revenue",
                        schemaName: "Revenue",
                        attributeType: "Money",
                        requiredLevel: { value: "None" },
                        isValidForCreate: true,
                        isValidForUpdate: true,
                        isValidForRead: true,
                        isPrimaryId: false,
                        isPrimaryName: false,
                    },
                ],
                relationships: [],
            }),
            fetchAllEntities: jest.fn().mockResolvedValue(["account", "contact"]),
            fetchGlobalOptionSet: jest.fn().mockResolvedValue({
                name: "industrycode",
                isGlobal: true,
                options: [
                    { value: 1, label: { label: "Accounting", languageCode: 1033 } },
                    { value: 2, label: { label: "Agriculture", languageCode: 1033 } },
                ],
            }),
            fetchCSDLMetadata: jest.fn().mockResolvedValue("<xml></xml>"),
            fetchWithDelta: jest.fn().mockResolvedValue({
                entities: [],
                serverVersionStamp: "12345",
            }),
            saveCache: jest.fn(),
        } as any;

        mockTranspiler = {
            transpile: jest.fn().mockReturnValue({
                interfaces: new Map([
                    ["Account", { name: "Account", properties: [] }],
                    ["AccountCreate", { name: "AccountCreate", properties: [] }],
                    ["AccountUpdate", { name: "AccountUpdate", properties: [] }],
                ]),
                enums: new Map([
                    ["AccountIndustryCode", { name: "AccountIndustryCode", members: [] }],
                ]),
                types: new Map([
                    ["AccountAttributes", { name: "AccountAttributes", type: "string" }],
                ]),
                actions: new Map(),
                functions: new Map(),
            }),
            transpileActions: jest.fn().mockReturnValue(new Map()),
        } as any;

        mockRenderer = {
            render: jest.fn().mockReturnValue("// Generated TypeScript definitions"),
        } as any;

        mockParser = {
            parse: jest.fn().mockResolvedValue({
                actions: [],
                functions: [],
                entityTypes: new Map(),
            }),
        } as any;

        (MetadataFetcher as jest.MockedClass<typeof MetadataFetcher>).mockImplementation(() => mockFetcher);
        (TypeTranspiler as jest.MockedClass<typeof TypeTranspiler>).mockImplementation(() => mockTranspiler);
        (TypeScriptRenderer as jest.MockedClass<typeof TypeScriptRenderer>).mockImplementation(() => mockRenderer);
        (CSDLParser as jest.MockedClass<typeof CSDLParser>).mockImplementation(() => mockParser);

        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    });

    describe("generateTypes", () => {
        it("should generate types for specified entities", async () => {
            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: ["account"],
                output: "./types/dataverse.d.ts",
                includeOptionSets: true,
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            const result = await generateTypes(options);

            expect(mockFetcher.initialize).toHaveBeenCalled();
            expect(mockFetcher.fetchEntityMetadata).toHaveBeenCalledWith("account");
            expect(mockTranspiler.transpile).toHaveBeenCalled();
            expect(mockRenderer.render).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith("./types/dataverse.d.ts", expect.any(String));

            expect(result).toEqual({
                entityCount: 1,
                enumCount: 1,
                actionCount: 0,
                relationshipCount: 0,
                cacheUpdated: false,
                preview: expect.any(String),
            });
        });

        it("should fetch all entities when entities is '*'", async () => {
            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: "*" as const,
                output: "./types/dataverse.d.ts",
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            await generateTypes(options);

            expect(mockFetcher.fetchAllEntities).toHaveBeenCalled();
            expect(mockFetcher.fetchEntityMetadata).toHaveBeenCalledTimes(2);
        });

        it("should use delta cache when specified", async () => {
            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: ["account"],
                output: "./types/dataverse.d.ts",
                deltaCache: "./.cache/metadata.json",
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            await generateTypes(options);

            expect(mockFetcher.fetchWithDelta).toHaveBeenCalledWith(["account"]);
            expect(mockFetcher.saveCache).toHaveBeenCalled();
        });

        it("should include actions when specified", async () => {
            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: ["account"],
                output: "./types/dataverse.d.ts",
                includeActions: true,
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            mockParser.parse = jest.fn().mockResolvedValue({
                actions: [
                    {
                        name: "QualifyLead",
                        isBound: true,
                        parameters: [],
                    },
                ],
                functions: [],
                entityTypes: new Map(),
            });

            const result = await generateTypes(options);

            expect(mockFetcher.fetchCSDLMetadata).toHaveBeenCalled();
            expect(mockParser.parse).toHaveBeenCalled();
            expect(mockTranspiler.transpileActions).toHaveBeenCalled();
            expect(result.actionCount).toBe(1);
        });

        it("should create output directory if it doesn't exist", async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: ["account"],
                output: "./new-dir/types/dataverse.d.ts",
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            await generateTypes(options);

            expect(fs.mkdirSync).toHaveBeenCalledWith("./new-dir/types", { recursive: true });
        });

        it("should throw error for invalid entities configuration", async () => {
            const options = {
                serverUrl: "https://test.crm.dynamics.com",
                entities: null as any,
                output: "./types/dataverse.d.ts",
                auth: {
                    type: "token-callback" as const,
                    tokenCallback: async () => "test-token",
                },
            };

            await expect(generateTypes(options)).rejects.toThrow("Invalid entities configuration");
        });
    });
});

describe("Type Transpiler", () => {
    it("should map attribute types correctly", () => {
        const transpiler = new TypeTranspiler({
            customTypes: {
                money: "Decimal",
                datetime: "Date",
            },
            namingConvention: "camelCase",
        });

        const entity = {
            logicalName: "account",
            schemaName: "Account",
            entitySetName: "accounts",
            primaryIdAttribute: "accountid",
            primaryNameAttribute: "name",
            attributes: [
                {
                    logicalName: "accountid",
                    attributeType: "Uniqueidentifier",
                    isValidForRead: true,
                },
                {
                    logicalName: "name",
                    attributeType: "String",
                    isValidForRead: true,
                },
                {
                    logicalName: "revenue",
                    attributeType: "Money",
                    isValidForRead: true,
                },
                {
                    logicalName: "createdon",
                    attributeType: "DateTime",
                    isValidForRead: true,
                },
            ] as any,
            relationships: [],
        };

        const result = transpiler.transpile([entity], new Map());

        const accountInterface = result.interfaces.get("Account");
        expect(accountInterface).toBeDefined();
        expect(accountInterface?.properties).toContainEqual(
            expect.objectContaining({
                name: "accountid",
                type: "string",
            })
        );
        expect(accountInterface?.properties).toContainEqual(
            expect.objectContaining({
                name: "revenue",
                type: "Decimal",
            })
        );
        expect(accountInterface?.properties).toContainEqual(
            expect.objectContaining({
                name: "createdon",
                type: "Date",
            })
        );
    });
});

describe("CSDL Parser", () => {
    it("should parse actions from CSDL", async () => {
        const parser = new CSDLParser();
        const csdl = `<?xml version="1.0" encoding="utf-8"?>
        <edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
            <edmx:DataServices>
                <Schema Namespace="Microsoft.Dynamics.CRM" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                    <Action Name="QualifyLead" IsBound="true">
                        <Parameter Name="entity" Type="mscrm.lead" Nullable="false"/>
                        <Parameter Name="CreateAccount" Type="Edm.Boolean" Nullable="false"/>
                        <Parameter Name="CreateContact" Type="Edm.Boolean" Nullable="false"/>
                        <ReturnType Type="Collection(mscrm.crmbaseentity)" Nullable="false"/>
                    </Action>
                </Schema>
            </edmx:DataServices>
        </edmx:Edmx>`;

        const result = await parser.parse(csdl);

        expect(result.actions).toHaveLength(1);
        expect(result.actions[0]).toMatchObject({
            name: "QualifyLead",
            isBound: true,
            bindingEntityType: "lead",
            parameters: [
                {
                    name: "CreateAccount",
                    type: { type: "Edm.Boolean", isCollection: false },
                    nullable: false,
                },
                {
                    name: "CreateContact",
                    type: { type: "Edm.Boolean", isCollection: false },
                    nullable: false,
                },
            ],
        });
    });
});