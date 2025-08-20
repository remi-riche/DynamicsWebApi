import { parseStringPromise } from "xml2js";
import {
    ActionMetadata,
    FunctionMetadata,
    ParameterMetadata,
    TypeReference,
} from "../types";

export class CSDLParser {
    async parse(csdlXml: string): Promise<{
        actions: ActionMetadata[];
        functions: FunctionMetadata[];
        entityTypes: Map<string, any>;
    }> {
        const result = await parseStringPromise(csdlXml, {
            explicitArray: false,
            mergeAttrs: true,
            normalizeTags: true,
            xmlns: true,
        });

        const schema = this.findSchema(result);
        if (!schema) {
            throw new Error("No schema found in CSDL");
        }

        const actions = this.extractActions(schema);
        const functions = this.extractFunctions(schema);
        const entityTypes = this.extractEntityTypes(schema);

        return { actions, functions, entityTypes };
    }

    private findSchema(result: any): any {
        if (result.edmx?.dataservices?.schema) {
            const schemas = Array.isArray(result.edmx.dataservices.schema)
                ? result.edmx.dataservices.schema
                : [result.edmx.dataservices.schema];

            return schemas.find((s: any) => 
                s.namespace === "Microsoft.Dynamics.CRM" || 
                s.namespace?.startsWith("mscrm")
            ) || schemas[0];
        }

        return null;
    }

    private extractActions(schema: any): ActionMetadata[] {
        const actions: ActionMetadata[] = [];
        
        if (!schema.action) {
            return actions;
        }

        const actionElements = Array.isArray(schema.action) ? schema.action : [schema.action];

        for (const actionEl of actionElements) {
            const action: ActionMetadata = {
                name: actionEl.name,
                isBound: actionEl.isbound === "true",
                parameters: [],
            };

            if (actionEl.parameter) {
                const parameters = Array.isArray(actionEl.parameter) 
                    ? actionEl.parameter 
                    : [actionEl.parameter];

                for (const param of parameters) {
                    if (param.name === "entity" && action.isBound) {
                        action.bindingEntityType = this.extractEntityType(param.type);
                        continue;
                    }

                    action.parameters.push({
                        name: param.name,
                        type: this.parseTypeReference(param.type),
                        nullable: param.nullable !== "false",
                    });
                }
            }

            if (actionEl.returntype) {
                action.returnType = this.parseTypeReference(actionEl.returntype.type);
            }

            actions.push(action);
        }

        return actions;
    }

    private extractFunctions(schema: any): FunctionMetadata[] {
        const functions: FunctionMetadata[] = [];
        
        if (!schema.function) {
            return functions;
        }

        const functionElements = Array.isArray(schema.function) ? schema.function : [schema.function];

        for (const funcEl of functionElements) {
            const func: FunctionMetadata = {
                name: funcEl.name,
                isBound: funcEl.isbound === "true",
                isComposable: funcEl.iscomposable === "true",
                parameters: [],
            };

            if (funcEl.parameter) {
                const parameters = Array.isArray(funcEl.parameter) 
                    ? funcEl.parameter 
                    : [funcEl.parameter];

                for (const param of parameters) {
                    if (param.name === "entity" && func.isBound) {
                        func.bindingEntityType = this.extractEntityType(param.type);
                        continue;
                    }

                    func.parameters.push({
                        name: param.name,
                        type: this.parseTypeReference(param.type),
                        nullable: param.nullable !== "false",
                    });
                }
            }

            if (funcEl.returntype) {
                func.returnType = this.parseTypeReference(funcEl.returntype.type);
            }

            functions.push(func);
        }

        return functions;
    }

    private extractEntityTypes(schema: any): Map<string, any> {
        const entityTypes = new Map<string, any>();
        
        if (!schema.entitytype) {
            return entityTypes;
        }

        const entityElements = Array.isArray(schema.entitytype) ? schema.entitytype : [schema.entitytype];

        for (const entityEl of entityElements) {
            const properties: any[] = [];
            
            if (entityEl.property) {
                const propElements = Array.isArray(entityEl.property) 
                    ? entityEl.property 
                    : [entityEl.property];

                for (const prop of propElements) {
                    properties.push({
                        name: prop.name,
                        type: prop.type,
                        nullable: prop.nullable !== "false",
                    });
                }
            }

            entityTypes.set(entityEl.name, {
                name: entityEl.name,
                properties,
                baseType: entityEl.basetype,
            });
        }

        return entityTypes;
    }

    private parseTypeReference(type: string): TypeReference {
        if (!type) {
            return { type: "any", isCollection: false };
        }

        const collectionMatch = type.match(/^Collection\((.+)\)$/);
        if (collectionMatch) {
            return {
                type: collectionMatch[1],
                isCollection: true,
                namespace: this.extractNamespace(collectionMatch[1]),
            };
        }

        return {
            type,
            isCollection: false,
            namespace: this.extractNamespace(type),
        };
    }

    private extractNamespace(type: string): string | undefined {
        const parts = type.split(".");
        if (parts.length > 1) {
            parts.pop();
            return parts.join(".");
        }
        return undefined;
    }

    private extractEntityType(type: string): string | undefined {
        if (!type) return undefined;
        
        const collectionMatch = type.match(/^Collection\((.+)\)$/);
        const actualType = collectionMatch ? collectionMatch[1] : type;
        
        const parts = actualType.split(".");
        return parts[parts.length - 1];
    }

    parseSync(csdlXml: string): {
        actions: ActionMetadata[];
        functions: FunctionMetadata[];
        entityTypes: Map<string, any>;
    } {
        const fastXmlParser = require("fast-xml-parser");
        
        const options = {
            ignoreAttributes: false,
            attributeNamePrefix: "",
            parseAttributeValue: true,
            trimValues: true,
        };

        const result = fastXmlParser.parse(csdlXml, options);
        
        const schema = this.findSchemaInParsedXml(result);
        if (!schema) {
            throw new Error("No schema found in CSDL");
        }

        const actions = this.extractActionsFromParsed(schema);
        const functions = this.extractFunctionsFromParsed(schema);
        const entityTypes = this.extractEntityTypesFromParsed(schema);

        return { actions, functions, entityTypes };
    }

    private findSchemaInParsedXml(result: any): any {
        const edmx = result["edmx:Edmx"] || result.Edmx;
        if (!edmx) return null;

        const dataServices = edmx["edmx:DataServices"] || edmx.DataServices;
        if (!dataServices) return null;

        const schemas = dataServices.Schema;
        if (!schemas) return null;

        const schemaArray = Array.isArray(schemas) ? schemas : [schemas];
        return schemaArray.find((s: any) => 
            s.Namespace === "Microsoft.Dynamics.CRM" || 
            s.Namespace?.startsWith("mscrm")
        ) || schemaArray[0];
    }

    private extractActionsFromParsed(schema: any): ActionMetadata[] {
        const actions: ActionMetadata[] = [];
        
        if (!schema.Action) {
            return actions;
        }

        const actionElements = Array.isArray(schema.Action) ? schema.Action : [schema.Action];

        for (const actionEl of actionElements) {
            const action: ActionMetadata = {
                name: actionEl.Name,
                isBound: actionEl.IsBound === true || actionEl.IsBound === "true",
                parameters: [],
            };

            if (actionEl.Parameter) {
                const parameters = Array.isArray(actionEl.Parameter) 
                    ? actionEl.Parameter 
                    : [actionEl.Parameter];

                for (const param of parameters) {
                    if (param.Name === "entity" && action.isBound) {
                        action.bindingEntityType = this.extractEntityType(param.Type);
                        continue;
                    }

                    action.parameters.push({
                        name: param.Name,
                        type: this.parseTypeReference(param.Type),
                        nullable: param.Nullable !== false && param.Nullable !== "false",
                    });
                }
            }

            if (actionEl.ReturnType) {
                action.returnType = this.parseTypeReference(actionEl.ReturnType.Type);
            }

            actions.push(action);
        }

        return actions;
    }

    private extractFunctionsFromParsed(schema: any): FunctionMetadata[] {
        const functions: FunctionMetadata[] = [];
        
        if (!schema.Function) {
            return functions;
        }

        const functionElements = Array.isArray(schema.Function) ? schema.Function : [schema.Function];

        for (const funcEl of functionElements) {
            const func: FunctionMetadata = {
                name: funcEl.Name,
                isBound: funcEl.IsBound === true || funcEl.IsBound === "true",
                isComposable: funcEl.IsComposable === true || funcEl.IsComposable === "true",
                parameters: [],
            };

            if (funcEl.Parameter) {
                const parameters = Array.isArray(funcEl.Parameter) 
                    ? funcEl.Parameter 
                    : [funcEl.Parameter];

                for (const param of parameters) {
                    if (param.Name === "entity" && func.isBound) {
                        func.bindingEntityType = this.extractEntityType(param.Type);
                        continue;
                    }

                    func.parameters.push({
                        name: param.Name,
                        type: this.parseTypeReference(param.Type),
                        nullable: param.Nullable !== false && param.Nullable !== "false",
                    });
                }
            }

            if (funcEl.ReturnType) {
                func.returnType = this.parseTypeReference(funcEl.ReturnType.Type);
            }

            functions.push(func);
        }

        return functions;
    }

    private extractEntityTypesFromParsed(schema: any): Map<string, any> {
        const entityTypes = new Map<string, any>();
        
        if (!schema.EntityType) {
            return entityTypes;
        }

        const entityElements = Array.isArray(schema.EntityType) ? schema.EntityType : [schema.EntityType];

        for (const entityEl of entityElements) {
            const properties: any[] = [];
            
            if (entityEl.Property) {
                const propElements = Array.isArray(entityEl.Property) 
                    ? entityEl.Property 
                    : [entityEl.Property];

                for (const prop of propElements) {
                    properties.push({
                        name: prop.Name,
                        type: prop.Type,
                        nullable: prop.Nullable !== false && prop.Nullable !== "false",
                    });
                }
            }

            entityTypes.set(entityEl.Name, {
                name: entityEl.Name,
                properties,
                baseType: entityEl.BaseType,
            });
        }

        return entityTypes;
    }
}