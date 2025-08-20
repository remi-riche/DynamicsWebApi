import {
    EntityMetadataCache,
    AttributeMetadata,
    AttributeType,
    CustomTypeMapping,
    GeneratedTypes,
    InterfaceDefinition,
    PropertyDefinition,
    EnumDefinition,
    EnumMember,
    TypeAliasDefinition,
    RelationshipMetadata,
    ActionMetadata,
    FunctionMetadata,
    TypeReference,
} from "../types";

export class TypeTranspiler {
    private customTypes: CustomTypeMapping;
    private namingConvention: "camelCase" | "pascalCase" | "logicalName";
    private lookupStyle: "guid" | "object" | "both";
    private includeOptionSets: boolean;
    private includeRelationships: boolean;

    constructor(options: {
        customTypes?: CustomTypeMapping;
        namingConvention?: "camelCase" | "pascalCase" | "logicalName";
        lookupStyle?: "guid" | "object" | "both";
        includeOptionSets?: boolean;
        includeRelationships?: boolean;
    }) {
        this.customTypes = options.customTypes || {};
        this.namingConvention = options.namingConvention || "camelCase";
        this.lookupStyle = options.lookupStyle || "guid";
        this.includeOptionSets = options.includeOptionSets !== false;
        this.includeRelationships = options.includeRelationships || false;
    }

    transpile(entities: EntityMetadataCache[], globalOptionSets?: Map<string, any>): GeneratedTypes {
        const result: GeneratedTypes = {
            interfaces: new Map(),
            enums: new Map(),
            types: new Map(),
            actions: new Map(),
            functions: new Map(),
        };

        for (const entity of entities) {
            this.transpileEntity(entity, result);
        }

        if (globalOptionSets) {
            for (const [name, optionSet] of globalOptionSets) {
                const enumDef = this.createEnumDefinition(name, optionSet);
                result.enums.set(enumDef.name, enumDef);
            }
        }

        this.addUtilityTypes(result);

        return result;
    }

    private transpileEntity(entity: EntityMetadataCache, result: GeneratedTypes): void {
        const entityName = this.toTypeName(entity.schemaName);

        const readInterface = this.createReadInterface(entity);
        const createInterface = this.createCreateInterface(entity);
        const updateInterface = this.createUpdateInterface(entity);
        const attributesType = this.createAttributesType(entity);

        result.interfaces.set(entityName, readInterface);
        result.interfaces.set(`${entityName}Create`, createInterface);
        result.interfaces.set(`${entityName}Update`, updateInterface);
        result.types.set(`${entityName}Attributes`, attributesType);

        if (this.includeOptionSets) {
            this.extractOptionSets(entity, entityName, result);
        }
    }

    private createReadInterface(entity: EntityMetadataCache): InterfaceDefinition {
        const properties: PropertyDefinition[] = [];

        for (const attr of entity.attributes) {
            if (!attr.isValidForRead) continue;

            const prop = this.createProperty(attr, entity.schemaName, true);
            properties.push(prop);

            if (this.shouldAddFormattedValue(attr)) {
                properties.push({
                    name: `${prop.name}@OData.Community.Display.V1.FormattedValue`,
                    type: "string",
                    optional: true,
                    description: `Formatted value of ${prop.name}`,
                });
            }

            if (attr.attributeType === "Lookup" || attr.attributeType === "Customer" || attr.attributeType === "Owner") {
                properties.push({
                    name: `_${this.toPropertyName(attr.logicalName)}_value`,
                    type: "string",
                    optional: true,
                    description: `Lookup GUID value for ${prop.name}`,
                });
            }
        }

        if (this.includeRelationships && entity.relationships) {
            for (const rel of entity.relationships) {
                const relProp = this.createRelationshipProperty(rel, entity.schemaName);
                if (relProp) {
                    properties.push(relProp);
                }
            }
        }

        properties.push({
            name: "@odata.etag",
            type: "string",
            optional: true,
            description: "Entity ETag for optimistic concurrency control",
        });

        return {
            name: this.toTypeName(entity.schemaName),
            properties,
            description: `${entity.schemaName} entity interface for read operations`,
        };
    }

    private createCreateInterface(entity: EntityMetadataCache): InterfaceDefinition {
        const properties: PropertyDefinition[] = [];

        for (const attr of entity.attributes) {
            if (!attr.isValidForCreate || attr.isPrimaryId) continue;

            const isRequired = attr.requiredLevel.value === "ApplicationRequired" || 
                              attr.requiredLevel.value === "SystemRequired";

            const prop = this.createProperty(attr, entity.schemaName, !isRequired);
            properties.push(prop);
        }

        return {
            name: `${this.toTypeName(entity.schemaName)}Create`,
            properties,
            description: `${entity.schemaName} entity interface for create operations`,
        };
    }

    private createUpdateInterface(entity: EntityMetadataCache): InterfaceDefinition {
        const properties: PropertyDefinition[] = [];

        for (const attr of entity.attributes) {
            if (!attr.isValidForUpdate || attr.isPrimaryId) continue;

            const prop = this.createProperty(attr, entity.schemaName, true);
            properties.push(prop);
        }

        return {
            name: `${this.toTypeName(entity.schemaName)}Update`,
            properties,
            description: `${entity.schemaName} entity interface for update operations`,
        };
    }

    private createAttributesType(entity: EntityMetadataCache): TypeAliasDefinition {
        const attributes = entity.attributes
            .filter(attr => attr.isValidForRead)
            .map(attr => `"${this.toPropertyName(attr.logicalName)}"`);

        return {
            name: `${this.toTypeName(entity.schemaName)}Attributes`,
            type: attributes.join(" | "),
            description: `Union type of all ${entity.schemaName} attribute names`,
        };
    }

    private createProperty(attr: AttributeMetadata, entityName: string, optional: boolean): PropertyDefinition {
        const propName = this.toPropertyName(attr.logicalName);
        const propType = this.mapAttributeType(attr, entityName);

        return {
            name: propName,
            type: propType,
            optional,
            description: this.getPropertyDescription(attr),
        };
    }

    private mapAttributeType(attr: AttributeMetadata, entityName: string): string {
        switch (attr.attributeType) {
            case "String":
            case "Memo":
            case "EntityName":
                return "string";

            case "Boolean":
            case "ManagedProperty":
                return "boolean";

            case "Integer":
                if (attr.optionSet && this.includeOptionSets) {
                    const enumName = this.getOptionSetEnumName(entityName, attr.logicalName);
                    return enumName;
                }
                return "number";

            case "BigInt":
                return this.customTypes.bigint || "bigint";

            case "Double":
                return "number";

            case "Decimal":
                return this.customTypes.decimal || "number";

            case "Money":
                return this.customTypes.money || "number";

            case "DateTime":
                return this.customTypes.datetime || "Date";

            case "Uniqueidentifier":
                return "string";

            case "Picklist":
            case "State":
            case "Status":
                if (attr.optionSet && this.includeOptionSets) {
                    const enumName = this.getOptionSetEnumName(entityName, attr.logicalName);
                    return enumName;
                }
                return "number";

            case "MultiSelectPicklist":
                if (attr.optionSet && this.includeOptionSets) {
                    const enumName = this.getOptionSetEnumName(entityName, attr.logicalName);
                    return `${enumName}[]`;
                }
                return "number[]";

            case "Lookup":
            case "Customer":
            case "Owner":
                return this.mapLookupType(attr);

            case "PartyList":
                return "ActivityParty[]";

            case "Image":
            case "File":
                return "string";

            case "Virtual":
            case "CalendarRules":
                return "any";

            default:
                return "any";
        }
    }

    private mapLookupType(attr: AttributeMetadata): string {
        if (this.lookupStyle === "guid") {
            return "string";
        }

        if (!attr.targets || attr.targets.length === 0) {
            return "string";
        }

        const targetTypes = attr.targets.map(t => this.toTypeName(t)).join(" | ");

        if (this.lookupStyle === "object") {
            if (attr.targets.length === 1) {
                return targetTypes;
            }
            return `{ id: string; logicalName: ${attr.targets.map(t => `"${t}"`).join(" | ")} }`;
        }

        if (this.lookupStyle === "both") {
            if (attr.targets.length === 1) {
                return `string | ${targetTypes}`;
            }
            return `string | { id: string; logicalName: ${attr.targets.map(t => `"${t}"`).join(" | ")} }`;
        }

        return "string";
    }

    private createRelationshipProperty(rel: RelationshipMetadata, entityName: string): PropertyDefinition | null {
        if (rel.relationshipType === "OneToMany") {
            const relatedEntity = this.toTypeName(rel.referencingEntity || "");
            return {
                name: this.toPropertyName(rel.schemaName),
                type: `${relatedEntity}[]`,
                optional: true,
                description: `Navigation property for ${rel.schemaName} relationship`,
            };
        }

        if (rel.relationshipType === "ManyToMany") {
            const relatedEntity = rel.entity1LogicalName === entityName.toLowerCase() 
                ? this.toTypeName(rel.entity2LogicalName || "")
                : this.toTypeName(rel.entity1LogicalName || "");
            return {
                name: this.toPropertyName(rel.schemaName),
                type: `${relatedEntity}[]`,
                optional: true,
                description: `Navigation property for ${rel.schemaName} N:N relationship`,
            };
        }

        return null;
    }

    private extractOptionSets(entity: EntityMetadataCache, entityName: string, result: GeneratedTypes): void {
        for (const attr of entity.attributes) {
            if (attr.optionSet && !attr.globalOptionSet) {
                const enumName = this.getOptionSetEnumName(entityName, attr.logicalName);
                const enumDef = this.createEnumDefinition(enumName, attr.optionSet);
                result.enums.set(enumName, enumDef);
            }
        }
    }

    private createEnumDefinition(name: string, optionSet: any): EnumDefinition {
        const members: EnumMember[] = optionSet.options.map((opt: any) => ({
            name: this.sanitizeEnumMemberName(opt.label.label),
            value: opt.value,
            description: opt.label.label,
        }));

        return {
            name: this.toTypeName(name),
            members,
            description: `Option set enum for ${name}`,
        };
    }

    private getOptionSetEnumName(entityName: string, attributeName: string): string {
        return `${this.toTypeName(entityName)}${this.toTypeName(attributeName)}`;
    }

    private sanitizeEnumMemberName(label: string): string {
        if (!label) return "Unknown";
        
        let sanitized = label
            .replace(/[^a-zA-Z0-9]/g, "")
            .replace(/^(\d)/, "_$1");

        if (!sanitized) return "Unknown";

        return this.toTypeName(sanitized);
    }

    private shouldAddFormattedValue(attr: AttributeMetadata): boolean {
        return ["Picklist", "State", "Status", "MultiSelectPicklist", "Money", "DateTime", "Decimal", "Double"].includes(attr.attributeType);
    }

    private getPropertyDescription(attr: AttributeMetadata): string {
        let desc = `${attr.attributeType} attribute`;

        if (attr.maxLength) {
            desc += ` (max length: ${attr.maxLength})`;
        }

        if (attr.precision !== undefined) {
            desc += ` (precision: ${attr.precision})`;
        }

        if (attr.minValue !== undefined && attr.maxValue !== undefined) {
            desc += ` (range: ${attr.minValue} - ${attr.maxValue})`;
        }

        return desc;
    }

    private toPropertyName(logicalName: string): string {
        if (this.namingConvention === "logicalName") {
            return logicalName;
        }

        if (this.namingConvention === "pascalCase") {
            return this.toPascalCase(logicalName);
        }

        return this.toCamelCase(logicalName);
    }

    private toTypeName(name: string): string {
        if (!name) return "Unknown";
        return this.toPascalCase(name);
    }

    private toCamelCase(str: string): string {
        if (!str) return "";
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    private toPascalCase(str: string): string {
        if (!str) return "";
        
        const words = str.split(/[_\s]+/);
        return words
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
    }

    private addUtilityTypes(result: GeneratedTypes): void {
        result.types.set("ActivityParty", {
            name: "ActivityParty",
            type: `{
    "partyid@odata.bind"?: string;
    participationtypemask: number;
    addressused?: string;
}`,
            description: "Activity party for email, phone call, and appointment activities",
        });

        if (this.customTypes.money === "Decimal" || this.customTypes.decimal === "Decimal") {
            result.types.set("Decimal", {
                name: "Decimal",
                type: "number | string",
                description: "Decimal type alias for high-precision numeric values",
            });
        }

        result.types.set("DataverseTypes", {
            name: "DataverseTypes",
            type: Array.from(result.interfaces.keys())
                .filter(name => !name.endsWith("Create") && !name.endsWith("Update"))
                .map(name => `    ${this.toCamelCase(name)}: ${name};`)
                .join("\n"),
            description: "Aggregate type containing all entity interfaces",
        });
    }

    transpileActions(actions: ActionMetadata[]): Map<string, InterfaceDefinition> {
        const result = new Map<string, InterfaceDefinition>();

        for (const action of actions) {
            const requestInterface = this.createActionRequestInterface(action);
            result.set(requestInterface.name, requestInterface);

            if (action.returnType) {
                const responseInterface = this.createActionResponseInterface(action);
                result.set(responseInterface.name, responseInterface);
            }
        }

        return result;
    }

    private createActionRequestInterface(action: ActionMetadata): InterfaceDefinition {
        const properties: PropertyDefinition[] = action.parameters.map(param => ({
            name: this.toPropertyName(param.name),
            type: this.mapTypeReference(param.type),
            optional: param.nullable,
            description: `Parameter ${param.name}`,
        }));

        return {
            name: `${this.toTypeName(action.name)}Request`,
            properties,
            description: `Request interface for ${action.name} action`,
        };
    }

    private createActionResponseInterface(action: ActionMetadata): InterfaceDefinition {
        return {
            name: `${this.toTypeName(action.name)}Response`,
            properties: [],
            description: `Response interface for ${action.name} action`,
        };
    }

    private mapTypeReference(typeRef: TypeReference): string {
        const baseType = this.mapEdmType(typeRef.type);
        return typeRef.isCollection ? `${baseType}[]` : baseType;
    }

    private mapEdmType(edmType: string): string {
        const typeMap: Record<string, string> = {
            "Edm.String": "string",
            "Edm.Boolean": "boolean",
            "Edm.Int32": "number",
            "Edm.Int64": this.customTypes.bigint || "bigint",
            "Edm.Double": "number",
            "Edm.Decimal": this.customTypes.decimal || "number",
            "Edm.DateTimeOffset": this.customTypes.datetime || "Date",
            "Edm.Guid": "string",
        };

        if (edmType.startsWith("mscrm.")) {
            return this.toTypeName(edmType.replace("mscrm.", ""));
        }

        return typeMap[edmType] || "any";
    }
}