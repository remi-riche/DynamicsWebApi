#!/usr/bin/env node

/**
 * @fileoverview CLI for DynamicsWebApi Type Generator
 * @module cli/generate-types
 * 
 * This CLI tool provides a command-line interface for generating TypeScript
 * type definitions from Dataverse metadata. It supports multiple authentication
 * methods, configuration files, and environment variables.
 * 
 * Usage:
 *   npx dynamics-web-api generate-types --entities account,contact
 *   npx dynamics-web-api gen --config .dynamics-types.json
 * 
 * @see {@link https://github.com/AleksandrRogov/DynamicsWebApi}
 */

import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateTypes } from "../types-generator";
import { GeneratorOptions } from "../types-generator/types";
import { getRecommendedEntities, getSystemEntities, COMMON_DATAVERSE_ENTITIES } from "../types-generator/cdm/common-entities";
import { cosmiconfigSync } from "cosmiconfig";
// Note: Using chalk@4 for CommonJS compatibility
// chalk@5+ is ESM-only and would require dynamic imports
import chalk from "chalk";
import ora from "ora";

const explorerSync = cosmiconfigSync("dynamics-types");

const program = new Command();

program
    .name("dynamics-web-api")
    .version("2.3.1")
    .description("DynamicsWebApi TypeScript Type Generator");

// Add command to list available common entities
program
    .command("list-entities")
    .alias("ls")
    .description("List available common Dataverse entities")
    .option("-c, --category <category>", "Filter by category (system, business, sales, service, marketing, product, activity)")
    .action((options) => {
        console.log(chalk.blue("\n📋 Common Dataverse Entities\n"));
        
        const entities = options.category
            ? Object.entries(COMMON_DATAVERSE_ENTITIES).filter(([_, meta]) => meta.category === options.category)
            : Object.entries(COMMON_DATAVERSE_ENTITIES);
        
        // Group by category
        const grouped = entities.reduce((acc, [name, meta]) => {
            if (!acc[meta.category]) acc[meta.category] = [];
            acc[meta.category].push({ name, ...meta });
            return acc;
        }, {} as Record<string, any[]>);
        
        for (const [category, items] of Object.entries(grouped)) {
            console.log(chalk.yellow(`\n${category.toUpperCase()}`));
            console.log(chalk.gray("─".repeat(50)));
            
            for (const item of items) {
                const activityMark = item.isActivity ? chalk.cyan(" [Activity]") : "";
                console.log(`  ${chalk.green(item.name.padEnd(25))} ${chalk.gray(item.displayName)}${activityMark}`);
                if (options.verbose) {
                    console.log(`    ${chalk.gray(item.description)}`);
                }
            }
        }
        
        console.log(chalk.blue("\n💡 Tips:"));
        console.log(chalk.gray("  • Use --entities recommended for common CRM entities"));
        console.log(chalk.gray("  • Use --entities system for system entities only"));
        console.log(chalk.gray("  • Use --entities all-common for all standard entities"));
        console.log(chalk.gray("  • Use --entities * for ALL entities in your environment\n"));
    });

program
    .command("generate-types")
    .alias("gen")
    .description("Generate TypeScript type definitions from Dataverse metadata")
    .option("-s, --server-url <url>", "Dataverse organization URL")
    .option("-e, --entities <list>", "Comma-separated list of entities or '*' for all", parseEntities)
    .option("-o, --output <path>", "Output file path", "./src/types/dataverse.d.ts")
    .option("--include-option-sets", "Include option set enums", true)
    .option("--include-actions", "Include action/function types", false)
    .option("--include-relationships", "Include relationship properties", false)
    .option("-l, --label-lang <lcid>", "Label language LCID (e.g., 1033 for English, 1036 for French)", parseInt, 1033)
    .option("-n, --naming <convention>", "Naming convention: camelCase, pascalCase, or logicalName", "camelCase")
    .option("--lookup-style <style>", "Lookup property style: guid, object, or both", "guid")
    .option("--delta-cache <path>", "Path to metadata cache file for incremental updates")
    .option("--emit-runtime", "Emit runtime helper code instead of just type definitions", false)
    .option("-c, --config <path>", "Path to configuration file")
    .option("--auth <type>", "Authentication type: client-credentials, device-code, or token-callback", "client-credentials")
    .option("--tenant <id>", "Azure AD tenant ID")
    .option("--client <id>", "Azure AD client/application ID")
    .option("--secret <value>", "Client secret (for client-credentials auth)")
    .option("--token-callback <path>", "Path to module exporting token callback function")
    .option("--custom-types <json>", "Custom type mappings as JSON", parseCustomTypes)
    .option("--dry-run", "Preview what would be generated without writing files", false)
    .option("-v, --verbose", "Enable verbose logging", false)
    .action(async (options) => {
        const spinner = ora();
        
        try {
            const config = await loadConfig(options);
            
            if (options.verbose) {
                console.log(chalk.gray("Configuration:"));
                console.log(JSON.stringify(config, null, 2));
            }
            
            if (!config.serverUrl) {
                throw new Error("Server URL is required. Use --server-url or configure in .dynamics-types.json");
            }
            
            if (!config.entities || config.entities.length === 0) {
                throw new Error("At least one entity is required. Use --entities or configure in .dynamics-types.json");
            }
            
            validateAuth(config);
            
            spinner.start(chalk.blue("Connecting to Dataverse..."));
            
            const generatorOptions: GeneratorOptions = {
                serverUrl: config.serverUrl,
                entities: config.entities,
                output: config.output,
                includeOptionSets: config.includeOptionSets,
                includeActions: config.includeActions,
                includeRelationships: config.includeRelationships,
                labelLanguage: config.labelLang,
                namingConvention: config.naming as any,
                deltaCache: config.deltaCache,
                auth: buildAuthConfig(config),
                customTypes: config.customTypes,
                lookupStyle: config.lookupStyle as any,
                emitRuntime: config.emitRuntime,
            };
            
            spinner.text = chalk.blue("Fetching metadata...");
            
            const result = await generateTypes(generatorOptions);
            
            spinner.succeed(chalk.green(`✓ Generated types for ${result.entityCount} entities`));
            
            if (config.dryRun) {
                console.log(chalk.yellow("\n📝 Dry run - no files were written"));
                if (options.verbose) {
                    console.log(chalk.gray("Generated content preview:"));
                    console.log(result.preview?.substring(0, 500) + "...");
                }
            } else {
                console.log(chalk.green(`✓ Types written to ${config.output}`));
                
                if (result.enumCount > 0) {
                    console.log(chalk.gray(`  - ${result.enumCount} enums generated`));
                }
                if (result.actionCount > 0) {
                    console.log(chalk.gray(`  - ${result.actionCount} actions/functions generated`));
                }
                if (result.relationshipCount > 0) {
                    console.log(chalk.gray(`  - ${result.relationshipCount} relationships included`));
                }
            }
            
            if (config.deltaCache && result.cacheUpdated) {
                console.log(chalk.gray(`✓ Cache updated at ${config.deltaCache}`));
            }
            
            console.log(chalk.green("\n✨ Type generation complete!"));
            console.log(chalk.gray(`Import your types with: ${chalk.cyan(`import type { Account, Contact } from "${config.output.replace(/\.(d\.)?ts$/, "")}";`)}`));
            
        } catch (error: any) {
            spinner.fail(chalk.red("Type generation failed"));
            console.error(chalk.red("\n❌ Error:"), error.message);
            
            if (options.verbose && error.stack) {
                console.error(chalk.gray(error.stack));
            }
            
            process.exit(1);
        }
    });

/**
 * Parse entity list from CLI input
 * Supports special keywords for common entity sets
 * 
 * @param {string} value - Comma-separated entities or special keywords
 * @returns {string[] | "*"} Parsed entity list or wildcard
 */
function parseEntities(value: string): string[] | "*" {
    if (value === "*") return "*";
    
    // Support special keywords for common entity sets
    switch (value.toLowerCase()) {
        case "recommended":
        case "common":
            return getRecommendedEntities();
        case "system":
            return getSystemEntities();
        case "all-common":
            return Object.keys(COMMON_DATAVERSE_ENTITIES);
        default:
            // Parse comma-separated list
            return value.split(",").map(e => e.trim()).filter(Boolean);
    }
}

function parseCustomTypes(value: string): Record<string, string> {
    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`Invalid custom types JSON: ${value}`);
    }
}

async function loadConfig(options: any): Promise<any> {
    let config = { ...options };
    
    if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        config = { ...fileConfig, ...config };
    } else {
        const searchResult = explorerSync.search();
        if (searchResult) {
            config = { ...searchResult.config, ...config };
        }
    }
    
    const envConfig: any = {};
    if (process.env.DYNAMICS_SERVER_URL) envConfig.serverUrl = process.env.DYNAMICS_SERVER_URL;
    if (process.env.DYNAMICS_TENANT_ID) envConfig.tenant = process.env.DYNAMICS_TENANT_ID;
    if (process.env.DYNAMICS_CLIENT_ID) envConfig.client = process.env.DYNAMICS_CLIENT_ID;
    if (process.env.DYNAMICS_CLIENT_SECRET) envConfig.secret = process.env.DYNAMICS_CLIENT_SECRET;
    
    return { ...config, ...envConfig };
}

function validateAuth(config: any): void {
    if (config.auth === "client-credentials") {
        if (!config.tenant) {
            throw new Error("Tenant ID is required for client-credentials auth. Use --tenant or DYNAMICS_TENANT_ID env var");
        }
        if (!config.client) {
            throw new Error("Client ID is required for client-credentials auth. Use --client or DYNAMICS_CLIENT_ID env var");
        }
        if (!config.secret) {
            throw new Error("Client secret is required for client-credentials auth. Use --secret or DYNAMICS_CLIENT_SECRET env var");
        }
    } else if (config.auth === "device-code") {
        if (!config.tenant) {
            throw new Error("Tenant ID is required for device-code auth. Use --tenant or DYNAMICS_TENANT_ID env var");
        }
        if (!config.client) {
            throw new Error("Client ID is required for device-code auth. Use --client or DYNAMICS_CLIENT_ID env var");
        }
    } else if (config.auth === "token-callback") {
        if (!config.tokenCallback) {
            throw new Error("Token callback path is required for token-callback auth. Use --token-callback");
        }
    }
}

function buildAuthConfig(config: any): any {
    if (config.auth === "token-callback" && config.tokenCallback) {
        const callbackPath = path.resolve(config.tokenCallback);
        const callback = require(callbackPath);
        return {
            type: "token-callback",
            tokenCallback: callback.default || callback,
        };
    }
    
    return {
        type: config.auth,
        tenantId: config.tenant,
        clientId: config.client,
        clientSecret: config.secret,
    };
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}