/**
 * @fileoverview Common Data Model (CDM) entity definitions
 * @module types-generator/cdm
 * 
 * This module contains the mapping of standard Dataverse entities that are
 * present in every Dataverse/Dynamics 365 environment. These entities follow
 * the Common Data Model standard.
 * 
 * @see {@link https://learn.microsoft.com/en-us/common-data-model/schema/core/applicationcommon/overview}
 */

/**
 * Common Dataverse entities present in all environments
 * 
 * These entities are part of the base platform and include:
 * - System entities (systemuser, team, businessunit, etc.)
 * - Core business entities (account, contact, etc.)
 * - Activity entities (email, phonecall, appointment, task, etc.)
 * - Process entities (workflow, processsession, etc.)
 * 
 * @constant
 */
export const COMMON_DATAVERSE_ENTITIES = {
    // System & Security Entities
    systemuser: {
        displayName: "User",
        description: "Person with access to the Microsoft CRM system and who owns objects in the database",
        primaryIdAttribute: "systemuserid",
        primaryNameAttribute: "fullname",
        category: "system",
        isActivity: false,
    },
    team: {
        displayName: "Team",
        description: "Collection of system users that routinely collaborate",
        primaryIdAttribute: "teamid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    businessunit: {
        displayName: "Business Unit",
        description: "Business, division, or department in the Microsoft Dynamics 365 database",
        primaryIdAttribute: "businessunitid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    organization: {
        displayName: "Organization",
        description: "Top level of the Microsoft Dynamics 365 business hierarchy",
        primaryIdAttribute: "organizationid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    role: {
        displayName: "Security Role",
        description: "Grouping of security privileges for users",
        primaryIdAttribute: "roleid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    
    // Core Business Entities
    account: {
        displayName: "Account",
        description: "Business that represents a customer or potential customer",
        primaryIdAttribute: "accountid",
        primaryNameAttribute: "name",
        category: "business",
        isActivity: false,
    },
    contact: {
        displayName: "Contact",
        description: "Person with whom a business unit has a relationship",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        category: "business",
        isActivity: false,
    },
    lead: {
        displayName: "Lead",
        description: "Prospect or potential sales opportunity",
        primaryIdAttribute: "leadid",
        primaryNameAttribute: "fullname",
        category: "sales",
        isActivity: false,
    },
    opportunity: {
        displayName: "Opportunity",
        description: "Potential revenue-generating event or sale to an account",
        primaryIdAttribute: "opportunityid",
        primaryNameAttribute: "name",
        category: "sales",
        isActivity: false,
    },
    
    // Customer Service Entities
    incident: {
        displayName: "Case",
        description: "Service request case associated with a contract",
        primaryIdAttribute: "incidentid",
        primaryNameAttribute: "title",
        category: "service",
        isActivity: false,
    },
    
    // Activity Entities
    activitypointer: {
        displayName: "Activity",
        description: "Base class for all activity entities",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    appointment: {
        displayName: "Appointment",
        description: "Commitment representing a time interval with start/end times",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    email: {
        displayName: "Email",
        description: "Activity that is delivered using email protocols",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    phonecall: {
        displayName: "Phone Call",
        description: "Activity to track a telephone conversation",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    task: {
        displayName: "Task",
        description: "Generic activity representing work to be done",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    letter: {
        displayName: "Letter",
        description: "Activity that tracks the delivery of a letter",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    fax: {
        displayName: "Fax",
        description: "Activity that tracks the transmission of a fax",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        category: "activity",
        isActivity: true,
    },
    
    // Product & Pricing
    product: {
        displayName: "Product",
        description: "Information about products and their pricing",
        primaryIdAttribute: "productid",
        primaryNameAttribute: "name",
        category: "product",
        isActivity: false,
    },
    pricelevel: {
        displayName: "Price List",
        description: "Entity that defines pricing levels",
        primaryIdAttribute: "pricelevelid",
        primaryNameAttribute: "name",
        category: "product",
        isActivity: false,
    },
    
    // Marketing
    campaign: {
        displayName: "Campaign",
        description: "Container for campaign activities and responses",
        primaryIdAttribute: "campaignid",
        primaryNameAttribute: "name",
        category: "marketing",
        isActivity: false,
    },
    list: {
        displayName: "Marketing List",
        description: "Group of existing or potential customers",
        primaryIdAttribute: "listid",
        primaryNameAttribute: "listname",
        category: "marketing",
        isActivity: false,
    },
    
    // Notes & Attachments
    annotation: {
        displayName: "Note",
        description: "Note that is attached to one or more objects",
        primaryIdAttribute: "annotationid",
        primaryNameAttribute: "subject",
        category: "system",
        isActivity: false,
    },
    
    // Queue Management
    queue: {
        displayName: "Queue",
        description: "List of records requiring action",
        primaryIdAttribute: "queueid",
        primaryNameAttribute: "name",
        category: "service",
        isActivity: false,
    },
    queueitem: {
        displayName: "Queue Item",
        description: "Item in a queue",
        primaryIdAttribute: "queueitemid",
        primaryNameAttribute: "title",
        category: "service",
        isActivity: false,
    },
    
    // Process & Workflow
    workflow: {
        displayName: "Process",
        description: "Set of logical rules defining steps for automated processes",
        primaryIdAttribute: "workflowid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    processsession: {
        displayName: "Process Session",
        description: "Information about workflows and dialogs",
        primaryIdAttribute: "processsessionid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    
    // Connection & Relationships
    connection: {
        displayName: "Connection",
        description: "Relationship between two entities",
        primaryIdAttribute: "connectionid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    connectionrole: {
        displayName: "Connection Role",
        description: "Role describing a relationship between entities",
        primaryIdAttribute: "connectionroleid",
        primaryNameAttribute: "name",
        category: "system",
        isActivity: false,
    },
    
    // Currency
    transactioncurrency: {
        displayName: "Currency",
        description: "Currency in which financial transaction is carried out",
        primaryIdAttribute: "transactioncurrencyid",
        primaryNameAttribute: "currencyname",
        category: "system",
        isActivity: false,
    },
} as const;

/**
 * Entity categories for grouping and organization
 */
export enum EntityCategory {
    System = "system",
    Business = "business",
    Sales = "sales",
    Service = "service",
    Marketing = "marketing",
    Product = "product",
    Activity = "activity",
}

/**
 * Get all entity logical names by category
 * 
 * @param {EntityCategory} category - The category to filter by
 * @returns {string[]} Array of entity logical names
 */
export function getEntitiesByCategory(category: EntityCategory): string[] {
    return Object.entries(COMMON_DATAVERSE_ENTITIES)
        .filter(([_, metadata]) => metadata.category === category)
        .map(([logicalName]) => logicalName);
}

/**
 * Get all activity entity logical names
 * 
 * @returns {string[]} Array of activity entity logical names
 */
export function getActivityEntities(): string[] {
    return Object.entries(COMMON_DATAVERSE_ENTITIES)
        .filter(([_, metadata]) => metadata.isActivity)
        .map(([logicalName]) => logicalName);
}

/**
 * Get all system entity logical names
 * These are core platform entities that should typically be included
 * 
 * @returns {string[]} Array of system entity logical names
 */
export function getSystemEntities(): string[] {
    return getEntitiesByCategory(EntityCategory.System);
}

/**
 * Get recommended entities for a typical CRM implementation
 * 
 * @returns {string[]} Array of recommended entity logical names
 */
export function getRecommendedEntities(): string[] {
    return [
        // Core system entities
        "systemuser",
        "team",
        "businessunit",
        "role",
        
        // Core business entities
        "account",
        "contact",
        
        // Sales entities
        "lead",
        "opportunity",
        
        // Service entities
        "incident",
        
        // Common activities
        "task",
        "appointment",
        "email",
        "phonecall",
        
        // Supporting entities
        "annotation",
        "queue",
        "connection",
    ];
}

/**
 * SystemUser specific metadata
 * 
 * This entity has complex attributes including:
 * - AAD integration fields (azureactivedirectoryobjectid)
 * - License management (islicensed, userlicensetype, caltype)
 * - Access control (accessmode)
 * - Hierarchical relationships (parentsystemuserid)
 * 
 * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/systemuser}
 */
export const SYSTEMUSER_METADATA = {
    logicalName: "systemuser",
    schemaName: "SystemUser",
    entitySetName: "systemusers",
    primaryIdAttribute: "systemuserid",
    primaryNameAttribute: "fullname",
    
    // Key lookups that reference other entities
    keyLookups: {
        businessunitid: "businessunit",
        parentsystemuserid: "systemuser", // Self-referential for manager hierarchy
        defaultmailbox: "mailbox",
        calendarid: "calendar",
        territoryid: "territory",
        positionid: "position",
        queueid: "queue",
        mobileofflineprofileid: "mobileofflineprofile",
        transactioncurrencyid: "transactioncurrency",
    },
    
    // Important option sets with their values
    keyOptionSets: {
        accessmode: {
            0: "Read-Write",
            1: "Administrative",
            2: "Read",
            3: "Support User",
            4: "Non-interactive",
            5: "Delegated Admin",
        },
        userlicensetype: {
            0: "Professional",
            1: "Administrative",
            2: "Basic",
            3: "Device Professional",
            4: "Device Basic",
            5: "Essential",
            6: "Device Essential",
            7: "Enterprise",
            8: "Device Enterprise",
            9: "Sales",
            10: "Service",
            11: "Field Service",
            12: "Project Service",
        },
        caltype: {
            0: "Professional",
            1: "Administrative",
            2: "Read-Only",
            3: "Device Full",
            4: "Device Limited",
        },
        preferredaddresscode: {
            1: "Mailing Address",
            2: "Other Address",
        },
        preferredemailcode: {
            1: "Default Value",
        },
        preferredphonecode: {
            1: "Main Phone",
            2: "Other Phone",
            3: "Home Phone",
            4: "Mobile Phone",
        },
    },
    
    // Fields that are typically read-only or system-managed
    readOnlyFields: [
        "systemuserid",
        "organizationid",
        "createdby",
        "createdon",
        "modifiedby",
        "modifiedon",
        "versionnumber",
        "isdisabled", // Managed through Enable/Disable actions
        "islicensed", // Managed by license assignment
        "azureactivedirectoryobjectid", // Synced from AAD
    ],
};