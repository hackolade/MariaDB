const {AlterScriptDto} = require('../../types/AlterScriptDto');
const {
    AlterCollectionDto,
    AlterCollectionColumnDto,
    AlterCollectionRoleCompModPKDto,
    AlterCollectionColumnPrimaryKeyOptionDto,
    AlterCollectionRoleCompModPrimaryKey
} = require('../../types/AlterCollectionDto');

const amountOfColumnsInRegularPk = 1;
const defaultDDLCompositePkIndexOrder = 'ASC';

class PkTransitionDto {

    /**
     * @type {boolean}
     * */
    didTransitionHappen

    /**
     * @type {boolean | undefined}
     * */
    wasPkChangedInTransition

    /**
     * @return {PkTransitionDto}
     * */
    static noTransition() {
        return {
            didTransitionHappen: false,
        }
    }

    /**
     * @param wasPkChangedInTransition {boolean}
     * @return {PkTransitionDto}
     * */
    static transition(wasPkChangedInTransition) {
        return {
            didTransitionHappen: true,
            wasPkChangedInTransition
        }
    }

}

class PkScriptModificationDto {

    /**
     * @type string
     * */
    script

    /**
     * @type boolean
     * */
    isDropScript

    /**
     * @type {string}
     * */
    fullTableName

    /**
     * @type {boolean}
     * */
    isActivated

    /**
     * @param fullTableName {string}
     * @param script {string}
     * @param isDropScript {boolean}
     * @param isActivated {boolean}
     * */
    constructor(
        script,
        fullTableName,
        isDropScript,
        isActivated
    ) {
        this.script = script;
        this.isDropScript = isDropScript;
        this.fullTableName = fullTableName;
        this.isActivated = isActivated;
    }

}

/**
 * @param optionHolder {AlterCollectionColumnPrimaryKeyOptionDto}
 * @return {Partial<AlterCollectionColumnPrimaryKeyOptionDto>}
 * */
const extractOptionsForComparisonWithRegularPkOptions = (optionHolder) => {
    return {
        indexCategory: optionHolder.indexCategory,
        indexOrder: optionHolder.indexOrder,
        indexBlockSize: optionHolder.indexBlockSize,
        indexIgnore: optionHolder.indexIgnore,
        constraintName: optionHolder.constraintName,
    }
}

/**
 * @param pkType {'ascending' | 'descending' | undefined}
 * @return string | undefined;
 * */
const shortenPkType = (pkType) => {
    if (pkType === 'ascending') {
        return 'ASC';
    }
    if (pkType === 'descending') {
        return 'DESC';
    }
    return defaultDDLCompositePkIndexOrder;
}

/**
 * @param columnJsonSchema {AlterCollectionColumnDto}
 * @return {Partial<AlterCollectionColumnPrimaryKeyOptionDto>}
 * */
const getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions = (columnJsonSchema) => {
    const options = columnJsonSchema.primaryKeyOptions || {};
    const keyType = shortenPkType(options.indexOrder);
    return extractOptionsForComparisonWithRegularPkOptions({
        ...options,
        indexOrder: keyType,
    });
}

/**
 * @param compositePk {AlterCollectionRoleCompModPKDto}
 * @return {Partial<AlterCollectionColumnPrimaryKeyOptionDto>}
 * */
const getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions = (compositePk) => {
    let keyType = undefined;
    if (compositePk?.compositePrimaryKey?.length === 1) {
        const keyDto = compositePk.compositePrimaryKey[0];
        keyType = shortenPkType(keyDto.type);
    }
    return extractOptionsForComparisonWithRegularPkOptions({
        ...(compositePk || {}),
        indexOrder: keyType,
    });
}

/**
 * @return {(collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromCompositeToRegular = (_) => (collection) => {
    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const idsOfColumns = oldPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId))
    if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
        // We return false, because it wouldn't count as transition between regular PK and composite PK
        // if composite PK did not constraint exactly 1 column
        return PkTransitionDto.noTransition();
    }
    const idOfPkColumn = idsOfColumns[0];
    const newColumnJsonSchema = Object.values(collection.properties)
        .find(columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn);
    if (!newColumnJsonSchema) {
        return PkTransitionDto.noTransition();
    }
    const isNewColumnARegularPrimaryKey = newColumnJsonSchema?.primaryKey && !newColumnJsonSchema?.compositePrimaryKey;
    if (!isNewColumnARegularPrimaryKey) {
        return PkTransitionDto.noTransition();
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(newColumnJsonSchema);
    const areOptionsEqual = oldPrimaryKeys.some((compositePk) => {
        if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
            return false;
        }
        const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
        return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
    });

    return PkTransitionDto.transition(!areOptionsEqual);
}

/**
 * @return {(collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromRegularToComposite = (_) => (collection) => {
    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const newPrimaryKeys = pkDto.new || [];
    const idsOfColumns = newPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId))
    if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
        // We return false, because it wouldn't count as transition between regular PK and composite PK
        // if composite PK does not constraint exactly 1 column
        return PkTransitionDto.noTransition();
    }
    const idOfPkColumn = idsOfColumns[0];
    const oldColumnJsonSchema = Object.values(collection.role.properties)
        .find(columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn);
    if (!oldColumnJsonSchema) {
        return PkTransitionDto.noTransition();
    }
    const isOldColumnARegularPrimaryKey = oldColumnJsonSchema?.primaryKey && !oldColumnJsonSchema?.compositePrimaryKey;
    if (!isOldColumnARegularPrimaryKey) {
        return PkTransitionDto.noTransition();
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
    const areOptionsEqual = newPrimaryKeys.some((compositePk) => {
        if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
            return false;
        }
        const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
        return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
    });

    return PkTransitionDto.transition(!areOptionsEqual);
}

/**
 * @param primaryKey {AlterCollectionRoleCompModPKDto}
 * @return {string}
 * */
const getConstraintNameForCompositePk = (primaryKey) => {
    if (primaryKey.constraintName) {
        return primaryKey.constraintName;
    }
    return '';
}

/**
 * @param pkType {'ascending' | 'descending' | undefined}
 * @return string;
 * */
const convertPkTypeToDDLOrder = (pkType) => {
    if (pkType === 'ascending') {
        return 'ASC';
    }
    if (pkType === 'descending') {
        return 'DESC';
    }
    return '';
}

/**
 * @param _
 * @return {(
 *      primaryKey: AlterCollectionRoleCompModPKDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         columns: Array<{
 *     			name: string,
 *     			order: number | string,
 *     		    isActivated: boolean,
 * 			}>,
 *         category?: string,
 *         ignore?: boolean,
 *         comment?: string,
 *         blockSize?: number | string,
 *         name?: string,
 *         keyType: string,
 * }
 *  }
 * */
const getCreateCompositePKDDLProviderConfig = (_) => (
    primaryKey,
    entityName,
    entity
) => {
    const constraintName = getConstraintNameForCompositePk(primaryKey);
    const pkColumns = _.toPairs(entity.role.properties)
        .map(([name, jsonSchema]) => {
            const compPkDto = primaryKey.compositePrimaryKey.find(keyDto => keyDto.keyId === jsonSchema.GUID);
            if (!compPkDto) {
                return undefined;
            }

            return {
                name,
                isActivated: jsonSchema.isActivated,
                order: convertPkTypeToDDLOrder(compPkDto.type),
            }
        })
        .filter(Boolean);

    return {
        name: constraintName,
        keyType: 'PRIMARY KEY',
        columns: pkColumns,

        category: primaryKey.indexCategory,
        ignore: primaryKey.indexIgnore,
        blockSize: primaryKey.indexBlockSize,
        comment: primaryKey.comment,
    }
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getAddCompositePkScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getDatabaseName,
        getCollectionName,
        getCollectionSchema,
    } = require('../../../utils/general')(_);

    const collectionSchema = getCollectionSchema(collection);
    const entityName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(entityName, databaseName);

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    const oldPrimaryKeys = pkDto.old || [];
    if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
        return [];
    }
    const transitionToCompositeDto = wasCompositePkChangedInTransitionFromRegularToComposite(_)(collection);
    if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
        return [];
    }
    if (newPrimaryKeys.length === oldPrimaryKeys.length) {
        const areKeyArraysEqual = _.isEqual(oldPrimaryKeys, newPrimaryKeys);
        if (areKeyArraysEqual) {
            return []
        }
    }

    return newPrimaryKeys
        .map((newPk) => {
            const ddlConfig = getCreateCompositePKDDLProviderConfig(_)(newPk, entityName, collection);
            const statementDto = ddlProvider.addPrimaryKey(
                fullTableName,
                collection.isActivated,
                ddlConfig
            );
            return new PkScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
        })
        .filter(scriptDto => Boolean(scriptDto.script));
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getDropCompositePkScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getDatabaseName,
        getCollectionName,
        getCollectionSchema,
    } = require('../../../utils/general')(_);

    const collectionSchema = getCollectionSchema(collection);
    const entityName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(entityName, databaseName);


    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    const oldPrimaryKeys = pkDto.old || [];
    if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
        return [];
    }
    const transitionToCompositeDto = wasCompositePkChangedInTransitionFromCompositeToRegular(_)(collection);
    if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
        return [];
    }
    if (newPrimaryKeys.length === oldPrimaryKeys.length) {
        const areKeyArraysEqual = _.isEqual(oldPrimaryKeys, newPrimaryKeys);
        if (areKeyArraysEqual) {
            return []
        }
    }

    return oldPrimaryKeys
        .map((oldPk) => {
            const script = ddlProvider.dropPrimaryKey(fullTableName);
            return new PkScriptModificationDto(script, fullTableName, true, collection.isActivated);
        })
        .filter(scriptDto => Boolean(scriptDto.script));
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getModifyCompositePkScriptDtos = (_, ddlProvider) => (collection) => {
    const dropCompositePkScriptDtos = getDropCompositePkScriptDtos(_, ddlProvider)(collection);
    const addCompositePkScriptDtos = getAddCompositePkScriptDtos(_, ddlProvider)(collection);

    return [
        ...dropCompositePkScriptDtos,
        ...addCompositePkScriptDtos,
    ].filter(Boolean);
}

/**
 * @param columnJsonSchema {AlterCollectionColumnDto}
 * @return {string}
 * */
const getConstraintNameForRegularPk = (columnJsonSchema) => {
    const constraintOptions = columnJsonSchema.primaryKeyOptions;
    if (constraintOptions?.constraintName) {
        return constraintOptions.constraintName;
    }
    return '';
}

/**
 * @param _
 * @return {(
 *      name: string,
 *      columnJsonSchema: AlterCollectionColumnDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         columns: Array<{
 *     			name: string,
 *     			order: number | string,
 *     		    isActivated: boolean,
 * 			}>,
 *         category?: string,
 *         ignore?: boolean,
 *         comment?: string,
 *         blockSize?: number | string,
 *         name?: string,
 *         keyType: string,
 * }
 *  }
 * */
const getCreateRegularPKDDLProviderConfig = (_) => (
    columnName,
    columnJsonSchema,
) => {
    const constraintOptions = columnJsonSchema.primaryKeyOptions || {};

    const constraintName = getConstraintNameForRegularPk(columnJsonSchema);
    const pkColumns = [{
        name: columnName,
        isActivated: columnJsonSchema.isActivated,
        order: convertPkTypeToDDLOrder(constraintOptions.indexOrder)
    }];

    return {
        name: constraintName,
        keyType: 'PRIMARY KEY',
        columns: pkColumns,

        category: constraintOptions.indexCategory,
        ignore: constraintOptions.indexIgnore,
        blockSize: constraintOptions.indexBlockSize,
        comment: constraintOptions.comment,
    }
}


/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasFieldChangedToBeARegularPk = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

    return isRegularPrimaryKey && !wasTheFieldAnyPrimaryKey;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromCompositeToRegular = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

    if (!(isRegularPrimaryKey && wasTheFieldAnyPrimaryKey)) {
        return PkTransitionDto.noTransition();
    }

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === oldColumnJsonSchema.GUID));
    const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === columnJsonSchema.GUID));

    const wasCompositePkRemoved = wasTheFieldACompositePrimaryKey && !isTheFieldACompositePrimaryKey;

    if (isRegularPrimaryKey && wasCompositePkRemoved) {
        // return compare custom properties and amount of columns.
        // If there was a transition and amount of composite PK columns is not equal
        // to amount of regular pk columns, we must recreate PK
        const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
        const areOptionsEqual = oldPrimaryKeys.some((oldCompositePk) => {
            if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
                return false;
            }
            const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
            return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
        });
        return PkTransitionDto.transition(!areOptionsEqual);
    }

    return PkTransitionDto.noTransition();
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromRegularToComposite = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const wasRegularPrimaryKey = oldColumnJsonSchema.primaryKey && !oldColumnJsonSchema.compositePrimaryKey;
    const isTheFieldAnyPrimaryKey = Boolean(columnJsonSchema?.primaryKey);

    if (!(wasRegularPrimaryKey && isTheFieldAnyPrimaryKey)) {
        return PkTransitionDto.noTransition();
    }

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === oldColumnJsonSchema.GUID));
    const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === columnJsonSchema.GUID));

    const wasCompositePkAdded = isTheFieldACompositePrimaryKey && !wasTheFieldACompositePrimaryKey;

    if (wasRegularPrimaryKey && wasCompositePkAdded) {
        // return compare custom properties and amount of columns.
        // If there was a transition and amount of composite PK columns is not equal
        // to amount of regular pk columns, we must recreate PK
        const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
        const areOptionsEqual = newPrimaryKeys.some((oldCompositePk) => {
            if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
                return false;
            }
            const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
            return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
        });
        return PkTransitionDto.transition(!areOptionsEqual);
    }

    return PkTransitionDto.noTransition();
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const isFieldNoLongerARegularPk = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;

    const oldJsonSchema = collection.role.properties[oldName];
    const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

    const isNotAnyPrimaryKey = !columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    return wasTheFieldARegularPrimaryKey && isNotAnyPrimaryKey;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasRegularPkModified = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldJsonSchema = collection.role.properties[oldName] || {};

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

    if (!(isRegularPrimaryKey && wasTheFieldARegularPrimaryKey)) {
        return false;
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
    const oldConstraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldJsonSchema);
    return !_.isEqual(oldConstraintOptions, constraintOptions);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getAddPkScriptDtos = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getDatabaseName,
        getCollectionName,
        getCollectionSchema,
    } = require('../../../utils/general')(_);

    const collectionSchema = getCollectionSchema(collection);
    const entityName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(entityName, databaseName);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            if (wasFieldChangedToBeARegularPk(_)(jsonSchema, collection)) {
                return true;
            }
            const transitionToRegularDto = wasRegularPkChangedInTransitionFromCompositeToRegular(_)(jsonSchema, collection);
            if (transitionToRegularDto.didTransitionHappen) {
                return transitionToRegularDto.wasPkChangedInTransition;
            }
            return wasRegularPkModified(_)(jsonSchema, collection);
        })
        .map(([name, jsonSchema]) => {
            const ddlConfig = getCreateRegularPKDDLProviderConfig(_)(name, jsonSchema);
            const statementDto = ddlProvider.addPrimaryKey(
                fullTableName,
                collection.isActivated,
                ddlConfig
            );
            return new PkScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
        })
        .filter(scriptDto => Boolean(scriptDto.script));
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getDropPkScriptDto = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getDatabaseName,
        getCollectionName,
        getCollectionSchema,
    } = require('../../../utils/general')(_);

    const collectionSchema = getCollectionSchema(collection);
    const entityName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(entityName, databaseName);


    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            if (isFieldNoLongerARegularPk(_)(jsonSchema, collection)) {
                return true;
            }
            const transitionToRegularDto = wasRegularPkChangedInTransitionFromRegularToComposite(_)(jsonSchema, collection);
            if (transitionToRegularDto.didTransitionHappen) {
                return transitionToRegularDto.wasPkChangedInTransition;
            }
            return wasRegularPkModified(_)(jsonSchema, collection);
        })
        .map(([name, jsonSchema]) => {
            const script = ddlProvider.dropPrimaryKey(fullTableName);
            return new PkScriptModificationDto(script, fullTableName, true, collection.isActivated);
        })
        .filter(scriptDto => Boolean(scriptDto.script));
}

/**
 * @return {(collection: AlterCollectionDto) => Array<PkScriptModificationDto>}
 * */
const getModifyPkScriptDtos = (_, ddlProvider) => (collection) => {
    const dropPkScriptDtos = getDropPkScriptDto(_, ddlProvider)(collection);
    const addPkScriptDtos = getAddPkScriptDtos(_, ddlProvider)(collection);

    return [
        ...dropPkScriptDtos,
        ...addPkScriptDtos,
    ].filter(Boolean);
}

/**
 * @param constraintDtos {PkScriptModificationDto[]}
 * @return {PkScriptModificationDto[]}
 * */
const sortModifyPkConstraints = (constraintDtos) => {
    return constraintDtos.sort((c1, c2) => {
        if (c1.fullTableName === c2.fullTableName) {
            // Number(true) = 1, Number(false) = 0;
            // This ensures that DROP script appears before CREATE script
            // if the same table has 2 scripts that drop and recreate PK
            return Number(c2.isDropScript) - Number(c1.isDropScript);
        }
        // This sorts all statements based on full table name, ASC
        return c1.fullTableName < c2.fullTableName;
    });
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyPkConstraintsScriptDtos = (_, ddlProvider) => (collection) => {
    const modifyCompositePkScriptDtos = getModifyCompositePkScriptDtos(_, ddlProvider)(collection);
    const modifyPkScriptDtos = getModifyPkScriptDtos(_, ddlProvider)(collection);

    const allDtos = [
        ...modifyCompositePkScriptDtos,
        ...modifyPkScriptDtos,
    ];
    const sortedAllDtos = sortModifyPkConstraints(allDtos);

    return sortedAllDtos
        .map(dto => {
            return AlterScriptDto.getInstance([dto.script], dto.isActivated, dto.isDropScript);
        })
        .filter(Boolean);
}

module.exports = {
    getModifyPkConstraintsScriptDtos,
}
