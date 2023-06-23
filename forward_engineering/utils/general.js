const {TableOptionsByEngine, TableOptions} = require("../enums/tableOptions");

module.exports = ({_, wrap}) => {

    /**
     * @param schemaName {string}
     * @param name {string}
     * @return {string}
     * */
    const getNamePrefixedWithSchemaName = (name, schemaName) => {
        if (schemaName) {
            return `\`${schemaName}\`.\`${name}\``;
        } else {
            return `\`${name}\``;
        }
    };

    /**
     * @param schemaName {string}
     * @param tableName {string}
     * @return {string}
     * */
    const getTableName = (tableName, schemaName) => {
        return getNamePrefixedWithSchemaName(tableName, schemaName);
    };

    /**
     * @param schemaName {string}
     * @param procedureName {string}
     * @return {string}
     * */
    const getProcedureName = (procedureName, schemaName) => {
        return getNamePrefixedWithSchemaName(procedureName, schemaName);
    };

    /**
     * @param schemaName {string}
     * @param udfName {string}
     * @return {string}
     * */
    const getUdfName = (udfName, schemaName) => {
        return getNamePrefixedWithSchemaName(udfName, schemaName);
    };

    /**
     * @param schemaName {string}
     * @return {string}
     * */
    const wrapDbName = (schemaName) => {
        return `\`${schemaName}\``;
    };

    const getOptionValue = (keyword, value) => {
        if (['ROW_FORMAT', 'INSERT_METHOD'].includes(keyword)) {
            if (value) {
                return _.toUpper(value);
            } else {
                return;
            }
        }

        if (keyword === 'UNION') {
            return value;
        }

        if (['YES', 'NO', 'DEFAULT'].includes(_.toUpper(value))) {
            return _.toUpper(value);
        }
        if (typeof value === 'number') {
            return value;
        } else if (!isNaN(+value) && value) {
            return +value;
        } else if (typeof value === 'string' && value) {
            return wrap(value);
        } else if (typeof value === 'boolean') {
            return value ? 'YES' : 'NO';
        }
    };

    const encodeStringLiteral = (str = '') => {
        return str.replace(/(?<!\\)('|"|`)/gi, '\\$1').replace(/\n/gi, '\\n');
    }

    const getTableOptions = (options = {}) => {
        const tableOptions = [];
        const engine = options.ENGINE;

        if (!options.defaultCharSet) {
            if (options.characterSet) {
                tableOptions.push(`CHARSET=${options.characterSet}`);
            }
            if (options.collation) {
                tableOptions.push(`COLLATE=${options.collation}`);
            }
        }

        if (engine) {
            tableOptions.push(`ENGINE = ${engine}`);
        }

        if (options.description) {
            tableOptions.push(`COMMENT = '${encodeStringLiteral(options.description)}'`);
        }

        const optionKeywords = TableOptionsByEngine[engine] || ['KEY_BLOCK_SIZE', 'PACK_KEYS', 'WITH_SYSTEM_VERSIONING'];

        optionKeywords.forEach(keyword => {
            if (keyword === 'WITH_SYSTEM_VERSIONING') {
                if (options[keyword]) {
                    return tableOptions.push(TableOptions[keyword]);
                } else {
                    return;
                }
            }

            const value = getOptionValue(keyword, options[keyword]);

            if (value === undefined) {
                return;
            }

            const option = `${TableOptions[keyword]} = ${value}`;

            tableOptions.push(option);
        });

        if (!tableOptions.length) {
            return '';
        }

        return ' ' + tableOptions.join(',\n\t');
    };

    const addLinear = linear => (linear ? 'LINEAR ' : '');

    const getPartitionBy = partitioning => {
        if (partitioning.partitionType === 'SYSTEM_TIME') {
            let interval =
                !isNaN(partitioning.interval) && partitioning.interval ? ` INTERVAL ${partitioning.interval}` : '';

            if (interval && partitioning.time_unit) {
                interval += ` ${partitioning.time_unit}`;
            }

            return `SYSTEM_TIME${interval}`;
        }

        return `${addLinear(partitioning.LINEAR)}${partitioning.partitionType}(${_.trim(
            partitioning.partitioning_expression,
        )})`;
    };

    const getSubPartitionBy = partitioning => {
        if (!partitioning.subpartitionType) {
            return '';
        }

        return `SUBPARTITION BY ${addLinear(partitioning.SUBLINEAR)}${partitioning.subpartitionType}(${_.trim(
            partitioning.subpartitioning_expression,
        )})`;
    };

    const getPartitionDefinitions = partitioning => {
        if (!Array.isArray(partitioning.partition_definitions)) {
            return '';
        }

        const partitions = partitioning.partition_definitions
            .filter(({ partitionDefinition }) => partitionDefinition)
            .map(partitionDefinition => {
                const subPartitionDefinitions = partitionDefinition.subpartitionDefinition;

                if (subPartitionDefinitions) {
                    return partitionDefinition.partitionDefinition + ' ' + wrap(subPartitionDefinitions, '(', ')');
                } else {
                    return partitionDefinition.partitionDefinition;
                }
            })
            .join(',\n\t\t');

        if (!partitions) {
            return '';
        }

        return wrap('\n\t\t' + partitions + '\n\t', '(', ')');
    };

    const getPartitions = (partitioning = {}) => {
        if (!partitioning.partitionType) {
            return '';
        }

        const partitionBy = `PARTITION BY ${getPartitionBy(partitioning)}`;
        const partitions = partitioning.partitions ? `PARTITIONS ${partitioning.partitions}` : '';
        const subPartitionBy = getSubPartitionBy(partitioning);
        const subPartitions = partitioning.subpartitions ? `SUBPARTITIONS ${partitioning.subpartitions}` : '';
        const partitionDefinitions = getPartitionDefinitions(partitioning);

        const result = [partitionBy, partitions, subPartitionBy, subPartitions, partitionDefinitions].filter(Boolean);

        if (!result.length) {
            return '';
        }

        return '\n\t' + result.join('\n\t');
    };

    const getKeyWithAlias = key => {
        if (!key) {
            return '';
        }

        if (key.alias) {
            return `\`${key.name}\` as \`${key.alias}\``;
        } else {
            return `\`${key.name}\``;
        }
    };

    const getViewData = keys => {
        if (!Array.isArray(keys)) {
            return { tables: [], columns: [] };
        }

        return keys.reduce(
            (result, key) => {
                if (!key.tableName) {
                    result.columns.push(getKeyWithAlias(key));

                    return result;
                }

                let tableName = `\`${key.tableName}\``;

                if (!result.tables.includes(tableName)) {
                    result.tables.push(tableName);
                }

                result.columns.push({
                    statement: `${tableName}.${getKeyWithAlias(key)}`,
                    isActivated: key.isActivated,
                });

                return result;
            },
            {
                tables: [],
                columns: [],
            },
        );
    };

    const getCharacteristics = udfCharacteristics => {
        const characteristics = [];

        if (udfCharacteristics.language) {
            characteristics.push('LANGUAGE SQL');
        }

        if (udfCharacteristics.deterministic) {
            characteristics.push(udfCharacteristics.deterministic);
        }

        if (udfCharacteristics.sqlSecurity) {
            characteristics.push(`SQL SECURITY ${udfCharacteristics.sqlSecurity}`);
        }

        if (udfCharacteristics.comment) {
            characteristics.push(`COMMENT ${wrap(escapeQuotes(udfCharacteristics.comment))}`);
        }

        return characteristics;
    };

    const escapeQuotes = (str = '') => {
        return str.replace(/(')/gi, "'$1").replace(/\n/gi, '\\n');
    };

    const checkFieldPropertiesChanged = (compMod, propertiesToCheck) => {
        return propertiesToCheck.some(prop => compMod?.oldField[prop] !== compMod?.newField[prop]);
    };

    const getModifiedGroupItemsByName = (newItems = [], oldItems = []) => {
        const addedItems = newItems.filter(newItem => !oldItems.some(item => item.name === newItem.name));
        const removedItems = [];
        const modifiedItems = [];

        for (const oldItem of oldItems) {
            const newItem = newItems.find(item => item.name === oldItem.name);
            if (!newItem) {
                removedItems.push(oldItem);
                continue;
            }

            const itemsAreNotEqual = !_.isEqual(newItem, oldItem);
            if (itemsAreNotEqual) {
                modifiedItems.push(newItem);
            }
        }

        return {
            added: addedItems,
            removed: removedItems,
            modified: modifiedItems,
        };
    };

    const getCompMod = containerData => containerData.role?.compMod ?? {};

    const getContainerName = containerData => containerData.code
        || containerData.name
        || containerData.collectionName;

    const checkCompModEqual = ({ new: newItem, old: oldItem } = {}, _) => _.isEqual(newItem, oldItem);

    /**
     * @param view {Object}
     * @return {Object}
     * */
    const getViewSchema = (view) => {
        return { ...view, ...(view.role ?? {}) };
    }

    /**
     * @param viewSchema {Object}
     * @return {string}
     * */
    const getViewName = (viewSchema) => {
        return viewSchema.code || viewSchema.name;
    }

    /**
     * @param collectionSchema {Object}
     * @return {string}
     * */
    const getCollectionName = (collectionSchema) => {
        return collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
    }

    /**
     * @param collection {Object}
     * @return {Object}
     * */
    const getCollectionSchema = (collection) => {
        return {...collection, ...(_.omit(collection?.role, 'properties') || {})}
    }

    /**
     * @param collectionSchema {Object}
     * @return {string}
     * */
    const getDatabaseName = (collectionSchema) => {
        return collectionSchema.compMod?.keyspaceName;
    }

    /**
     * @param name {string}
     * @return {string}
     * */
    const wrapInTics = (name) => {
        return `\`${name}\``;
    };

    /**
     * @param statement {string}
     * @param isPartOfLine {boolean | undefined}
     * @param isActivated {boolean | undefined}
     * @param inlineComment {string | undefined}
     * @return {string}
     * */
    const commentIfDeactivated = (statement, { isActivated, isPartOfLine, inlineComment = '--' }) => {
        if (isActivated !== false) {
            return statement;
        }
        if (isPartOfLine) {
            return '/* ' + statement + ' */';
        } else if (statement.includes('\n')) {
            return '/*\n' + statement + ' */\n';
        } else {
            return inlineComment + ' ' + statement;
        }
    };

    return {
        getTableName,
        getCollectionName,
        getCollectionSchema,
        getDatabaseName,
        wrapDbName,
        getContainerName,
        getModifiedGroupItemsByName,
        getProcedureName,
        getUdfName,
        getTableOptions,
        getPartitions,
        getViewData,
        getCharacteristics,
        escapeQuotes,
        checkFieldPropertiesChanged,
        getCompMod,
        checkCompModEqual,
        getViewSchema,
        getViewName,
        wrapInTics,
        commentIfDeactivated,
    };
}
