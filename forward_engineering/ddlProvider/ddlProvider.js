const defaultTypes = require('../configs/defaultTypes');
const descriptors = require('../configs/descriptors');
const templates = require('./templates');
const {HydratedColumn} = require('./types/hydratedColumn');
const {ColumnDefinition} = require('./types/columnDefinition');
const {KeyJsonSchema} = require('./types/keyJsonSchema');


module.exports = (baseProvider, options, app) => {
    const _ = app.require('lodash');
    const {
        tab,
        commentIfDeactivated,
        checkAllKeysDeactivated,
        divideIntoActivatedAndDeactivated,
        hasType,
        wrap,
        clean,
    } = app.require('@hackolade/ddl-fe-utils').general;
    const {assignTemplates} = app.require('@hackolade/ddl-fe-utils');
    const {decorateDefault, decorateType, canBeNational, getSign, canHaveAutoIncrement} = require('./ddlHelpers/columnDefinitionHelper')(
        _,
        wrap,
    );
    const {getTableName, getTableOptions, getPartitions, getViewData, getCharacteristics, escapeQuotes, wrapInTics} =
        require('../utils/general')({_, wrap});
    const {generateConstraintsString, foreignKeysToString, foreignActiveKeysToString, createKeyConstraint} =
        require('./ddlHelpers/constraintsHelper')({
            _,
            commentIfDeactivated,
            checkAllKeysDeactivated,
            divideIntoActivatedAndDeactivated,
            assignTemplates,
            escapeQuotes,
        });
    const keyHelper = require('./ddlHelpers/keyHelper')(_, clean);

    /**
     * @param hydratedColumn {HydratedColumn}
     * @return {string}
     * */
    const mapColumnToColumnDefinitionDdl = (hydratedColumn) => {
        const type = _.toUpper(hydratedColumn.type);
        const notNull = hydratedColumn.nullable ? '' : ' NOT NULL';
        const primaryKey = hydratedColumn.primaryKey
            ? ' ' + createKeyConstraint(templates, true)(hydratedColumn.primaryKeyOptions).statement
            : '';
        const unique = hydratedColumn.unique
            ? ' ' + createKeyConstraint(templates, true)(hydratedColumn.uniqueKeyOptions).statement
            : '';
        const zeroFill = hydratedColumn.zerofill ? ' ZEROFILL' : '';
        const autoIncrement = hydratedColumn.autoIncrement ? ' AUTO_INCREMENT' : '';
        const invisible = hydratedColumn.invisible ? ' INVISIBLE' : '';
        const national = hydratedColumn.national && canBeNational(type) ? 'NATIONAL ' : '';
        const comment = hydratedColumn.comment ? ` COMMENT '${escapeQuotes(hydratedColumn.comment)}'` : '';
        const charset = type !== 'JSON' && hydratedColumn.charset ? ` CHARSET ${hydratedColumn.charset}` : '';
        const collate =
            type !== 'JSON' && hydratedColumn.charset && hydratedColumn.collation
                ? ` COLLATE ${hydratedColumn.collation}`
                : '';
        const defaultValue = !_.isUndefined(hydratedColumn.default)
            ? ' DEFAULT ' + decorateDefault(type, hydratedColumn.default)
            : '';
        const compressed = hydratedColumn.compressionMethod
            ? ` COMPRESSED=${hydratedColumn.compressionMethod}`
            : '';
        const signed = getSign(type, hydratedColumn.signed);

        return assignTemplates(templates.columnDefinition, {
            name: hydratedColumn.name,
            type: decorateType(type, hydratedColumn),
            not_null: notNull,
            primary_key: primaryKey,
            unique_key: unique,
            default: defaultValue,
            autoIncrement,
            compressed,
            signed,
            zeroFill,
            invisible,
            comment,
            national,
            charset,
            collate,
        })
    }

    return {
        createDatabase({
                           databaseName,
                           orReplace,
                           ifNotExist,
                           collation,
                           characterSet,
                           comments,
                           udfs,
                           procedures,
                           useDb = true,
                       }) {
            let dbOptions = '';
            dbOptions += characterSet ? tab(`\nCHARACTER SET = '${characterSet}'`) : '';
            dbOptions += collation ? tab(`\nCOLLATE = '${collation}'`) : '';
            dbOptions += comments ? tab(`\nCOMMENT = '${escapeQuotes(comments)}'`) : '';

            const databaseStatement = assignTemplates(templates.createDatabase, {
                name: databaseName,
                orReplace: orReplace && !ifNotExist ? ' OR REPLACE' : '',
                ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
                dbOptions: dbOptions,
                useDb: useDb ? `USE \`${databaseName}\`;\n` : '',
            });
            const udfStatements = udfs.map(udf => this.createUdf(databaseName, udf));
            const procStatements = procedures.map(procedure => this.createProcedure(databaseName, procedure));

            return [databaseStatement, ...udfStatements, ...procStatements].join('\n');
        },

        /**
         * @return {string}
         * */
        createTable(
            {
                name,
                columns,
                dbData,
                temporary,
                orReplace,
                ifNotExist,
                likeTableName,
                selectStatement,
                options,
                partitioning,
                checkConstraints,
                foreignKeyConstraints,
                keyConstraints,
            },
            isActivated,
        ) {
            const tableName = getTableName(name, dbData.databaseName);
            const orReplaceTable = orReplace ? 'OR REPLACE ' : '';
            const temporaryTable = temporary ? 'TEMPORARY ' : '';
            const ifNotExistTable = ifNotExist ? 'IF NOT EXISTS ' : '';

            if (likeTableName) {
                return assignTemplates(templates.createLikeTable, {
                    name: tableName,
                    likeTableName: getTableName(likeTableName, dbData.databaseName),
                    orReplace: orReplaceTable,
                    temporary: temporaryTable,
                    ifNotExist: ifNotExistTable,
                });
            }

            const dividedKeysConstraints = divideIntoActivatedAndDeactivated(
                keyConstraints.map(createKeyConstraint(templates, isActivated)),
                key => key.statement,
            );
            const keyConstraintsString = generateConstraintsString(dividedKeysConstraints, isActivated);

            const dividedForeignKeys = divideIntoActivatedAndDeactivated(foreignKeyConstraints, key => key.statement);
            const foreignKeyConstraintsString = generateConstraintsString(dividedForeignKeys, isActivated);

            return assignTemplates(templates.createTable, {
                name: tableName,
                column_definitions: columns.join(',\n\t'),
                selectStatement: selectStatement ? ` ${selectStatement}` : '',
                orReplace: orReplaceTable,
                temporary: temporaryTable,
                ifNotExist: ifNotExistTable,
                options: getTableOptions(options),
                partitions: getPartitions(partitioning),
                checkConstraints: checkConstraints.length ? ',\n\t' + checkConstraints.join(',\n\t') : '',
                foreignKeyConstraints: foreignKeyConstraintsString,
                keyConstraints: keyConstraintsString,
            });
        },

        mapColumnToColumnDefinitionDdl,

        /**
         * @param columnDefinition {HydratedColumn}
         * @return {string}
         * */
        convertColumnDefinition(columnDefinition) {
            const columnDefinitionAsDDL = mapColumnToColumnDefinitionDdl(columnDefinition);
            const activationConfig = {
                isActivated: columnDefinition.isActivated,
            };
            return commentIfDeactivated(columnDefinitionAsDDL, activationConfig);
        },

        /**
         * @param tableName {string}
         * @param index {Object}
         * @param dbData {{
         *     databaseName: string,
         * }}
         * @param isParentActivated {boolean}
         * @return {string}
         * */
        createIndex(tableName, index, dbData, isParentActivated = true) {
            if (_.isEmpty(index.indxKey) || !index.indxName) {
                return '';
            }

            const allDeactivated = checkAllKeysDeactivated(index.indxKey || []);
            const wholeStatementCommented = index.isActivated === false || !isParentActivated || allDeactivated;
            const indexType = index.indexType ? `${_.toUpper(index.indexType)} ` : '';
            const ifNotExist = index.ifNotExist ? 'IF NOT EXISTS ' : '';
            const name = wrap(index.indxName || '', '`', '`');
            const table = getTableName(tableName, dbData.databaseName);
            const indexCategory = index.indexCategory ? ` USING ${index.indexCategory}` : '';
            let indexOptions = [];

            const dividedKeys = divideIntoActivatedAndDeactivated(
                index.indxKey || [],
                key => `\`${key.name}\`${key.type === 'DESC' ? ' DESC' : ''}`,
            );
            const commentedKeys = dividedKeys.deactivatedItems.length
                ? commentIfDeactivated(dividedKeys.deactivatedItems.join(', '), {
                    isActivated: wholeStatementCommented,
                    isPartOfLine: true,
                })
                : '';

            if (_.toLower(index.waitNoWait) === 'wait' && index.waitValue) {
                indexOptions.push(`WAIT ${index.waitValue}`);
            }

            if (_.toLower(index.waitNoWait) === 'nowait') {
                indexOptions.push(`NOWAIT`);
            }

            if (index.indexComment) {
                indexOptions.push(`COMMENT '${escapeQuotes(index.indexComment)}'`);
            }

            if (index.indexLock) {
                indexOptions.push(`LOCK ${index.indexLock}`);
            } else if (index.indexAlgorithm) {
                indexOptions.push(`ALGORITHM ${index.indexAlgorithm}`);
            }

            const indexStatement = assignTemplates(templates.index, {
                keys:
                    dividedKeys.activatedItems.join(', ') +
                    (wholeStatementCommented && commentedKeys && dividedKeys.activatedItems.length
                        ? ', ' + commentedKeys
                        : commentedKeys),
                indexOptions: indexOptions.length ? '\n\t' + indexOptions.join('\n\t') : '',
                name,
                table,
                indexType,
                ifNotExist,
                indexCategory,
            });

            if (wholeStatementCommented) {
                return commentIfDeactivated(indexStatement, {isActivated: false});
            } else {
                return indexStatement;
            }
        },

        /**
         * @param checkConstraint {{
         *     name?: string,
         *     expression: string,
         * }}
         * @return {string}
         * */
        createCheckConstraint(checkConstraint) {
            return assignTemplates(templates.checkConstraint, {
                name: checkConstraint.name ? `${wrap(checkConstraint.name, '`', '`')} ` : '',
                expression: _.trim(checkConstraint.expression).replace(/^\(([\s\S]*)\)$/, '$1'),
            });
        },

        /**
         * @param name {string}
         * @param primaryTable {string}
         * @param primaryTableActivated {boolean}
         * @param foreignTableActivated {boolean}
         * @param foreignKey {Array<KeyJsonSchema>}
         * @param primaryKey {Array<KeyJsonSchema>}
         * @param primarySchemaName {string}
         * @param dbData {{
         *     databaseName: string,
         * }}
         * @param schemaData {{
         *     schemaName: string
         * }}
         * @return {{
         *     statement: string,
         *     isActivated: boolean
         * }}
         * */
        createForeignKeyConstraint(
            {
                name,
                foreignKey,
                primaryTable,
                primaryKey,
                primaryTableActivated,
                foreignTableActivated,
                primarySchemaName
            },
            dbData,
            schemaData,
        ) {
            const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
            const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
            const isActivated =
                !isAllPrimaryKeysDeactivated &&
                !isAllForeignKeysDeactivated &&
                primaryTableActivated &&
                foreignTableActivated;

            return {
                statement: assignTemplates(templates.createForeignKeyConstraint, {
                    primaryTable: getTableName(primaryTable, primarySchemaName || schemaData.schemaName),
                    name,
                    foreignKey: isActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
                    primaryKey: isActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
                }),
                isActivated,
            };
        },

        /**
         * @param name {string}
         * @param primaryTable {string}
         * @param foreignTable {string}
         * @param primaryTableActivated {boolean}
         * @param foreignTableActivated {boolean}
         * @param foreignKey {Array<KeyJsonSchema>}
         * @param primaryKey {Array<KeyJsonSchema>}
         * @param foreignSchemaName {string}
         * @param primarySchemaName {string}
         * @param dbData {{
         *     databaseName: string,
         * }}
         * @param schemaData {{
         *     schemaName: string
         * }}
         * @return {{
         *     statement: string,
         *     isActivated: boolean,
         * }}
         * */
        createForeignKey(
            {
                name,
                foreignTable,
                foreignKey,
                primaryTable,
                primaryKey,
                primaryTableActivated,
                foreignTableActivated,
                foreignSchemaName,
                primarySchemaName,
            },
            dbData,
            schemaData,
        ) {
            const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
            const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);

            return {
                statement: assignTemplates(templates.createForeignKey, {
                    primaryTable: getTableName(primaryTable, primarySchemaName || schemaData.schemaName),
                    foreignTable: getTableName(foreignTable, foreignSchemaName || schemaData.schemaName),
                    name,
                    foreignKey: foreignKeysToString(foreignKey),
                    primaryKey: foreignKeysToString(primaryKey),
                }),
                isActivated:
                    !isAllPrimaryKeysDeactivated &&
                    !isAllForeignKeysDeactivated &&
                    primaryTableActivated &&
                    foreignTableActivated,
            };
        },

        /**
         * @param viewData {{
         *      keys: any[],
         *      orReplace: boolean,
         *      name: string,
         *      ifNotExist: boolean,
         *      checkOption: string,
         *      selectStatement: string,
         *      sqlSecurity: string,
         *      tableName: string,
         *      algorithm: string
         * }}
         * @param databaseName {string}
         * @return {{
         *     deactivatedWholeStatement: boolean,
         *     statement: string,
         * }}
         * */
        createViewForAlterScript(viewData, databaseName) {
            const {deactivatedWholeStatement, selectStatement} = this.viewSelectStatement(viewData);
            const algorithm =
                viewData.algorithm && viewData.algorithm !== 'UNDEFINED' ? `ALGORITHM ${viewData.algorithm} ` : '';

            const script = assignTemplates(templates.createView, {
                name: getTableName(viewData.name, databaseName),
                orReplace: viewData.orReplace ? 'OR REPLACE ' : '',
                ifNotExist: viewData.ifNotExist ? 'IF NOT EXISTS ' : '',
                sqlSecurity: viewData.sqlSecurity ? `SQL SECURITY ${viewData.sqlSecurity} ` : '',
                checkOption: viewData.checkOption ? `\nWITH ${viewData.checkOption} CHECK OPTION` : '',
                selectStatement,
                algorithm,
            });

            return {
                deactivatedWholeStatement,
                statement: script,
            }
        },

        createView(viewData, dbData, isActivated) {
            const {deactivatedWholeStatement, selectStatement} = this.viewSelectStatement(viewData, isActivated);

            const algorithm =
                viewData.algorithm && viewData.algorithm !== 'UNDEFINED' ? `ALGORITHM ${viewData.algorithm} ` : '';

            return commentIfDeactivated(
                assignTemplates(templates.createView, {
                    name: getTableName(viewData.name, dbData.databaseName),
                    orReplace: viewData.orReplace ? 'OR REPLACE ' : '',
                    ifNotExist: viewData.ifNotExist ? 'IF NOT EXISTS ' : '',
                    sqlSecurity: viewData.sqlSecurity ? `SQL SECURITY ${viewData.sqlSecurity} ` : '',
                    checkOption: viewData.checkOption ? `\nWITH ${viewData.checkOption} CHECK OPTION` : '',
                    selectStatement,
                    algorithm,
                }),
                {isActivated: !deactivatedWholeStatement},
            );
        },

        createViewIndex(viewName, index, dbData, isParentActivated) {
            return '';
        },

        createUdt(udt, dbData) {
            return '';
        },

        getDefaultType(type) {
            return defaultTypes[type];
        },

        getTypesDescriptors() {
            return descriptors;
        },

        hasType(type) {
            return hasType(descriptors, type);
        },

        /**
         * @param columnDefinition {ColumnDefinition}
         * @param dbData {any | undefined}
         * @return {HydratedColumn}
         * */
        hydrateColumn({columnDefinition, jsonSchema, dbData}) {
            return {
                name: columnDefinition.name,
                type: columnDefinition.type,
                primaryKey: keyHelper.isInlinePrimaryKey(jsonSchema),
                primaryKeyOptions: _.omit(keyHelper.hydratePrimaryKeyOptions(jsonSchema.primaryKeyOptions || {}), 'columns'),
                unique: keyHelper.isInlineUnique(jsonSchema),
                uniqueKeyOptions: _.omit(keyHelper.hydrateUniqueOptions(_.first(jsonSchema.uniqueKeyOptions) || {}), 'columns'),
                nullable: columnDefinition.nullable,
                default: columnDefinition.default,
                comment: columnDefinition.description || jsonSchema.refDescription || jsonSchema.description,
                isActivated: columnDefinition.isActivated,
                scale: columnDefinition.scale,
                precision: columnDefinition.precision,
                length: columnDefinition.length,
                national: jsonSchema.national,
                zerofill: jsonSchema.zerofill,
                invisible: jsonSchema.invisible,
                compressionMethod: jsonSchema.compressed ? jsonSchema.compression_method : '',
                enum: jsonSchema.enum,
                synonym: jsonSchema.synonym,
                signed: jsonSchema.zerofill || jsonSchema.signed,
                microSecPrecision: jsonSchema.microSecPrecision,
                charset: jsonSchema.characterSet,
                collation: jsonSchema.collation,
                ...(canHaveAutoIncrement(columnDefinition.type) && {autoIncrement: jsonSchema.autoincrement}),
            };
        },

        hydrateIndex(indexData, tableData) {
            return indexData;
        },

        hydrateViewIndex(indexData) {
            return {};
        },

        hydrateCheckConstraint(checkConstraint) {
            return {
                name: checkConstraint.chkConstrName,
                expression: checkConstraint.constrExpression,
            };
        },

        hydrateDatabase(containerData, data) {
            return {
                databaseName: containerData.name,
                orReplace: containerData.orReplace,
                ifNotExist: containerData.ifNotExist,
                characterSet: containerData.characterSet,
                collation: containerData.collation,
                comments: containerData.description,
                udfs: (data?.udfs || []).map(this.hydrateUdf),
                procedures: (data?.procedures || []).map(this.hydrateProcedure),
            };
        },

        hydrateTable({tableData, entityData, jsonSchema}) {
            const detailsTab = entityData[0];
            const likeTable = _.get(tableData, `relatedSchemas[${detailsTab.like}]`, '');

            return {
                ...tableData,
                keyConstraints: keyHelper.getTableKeyConstraints({jsonSchema}),
                temporary: detailsTab.temporary,
                orReplace: detailsTab.orReplace,
                ifNotExist: !detailsTab.orReplace && detailsTab.ifNotExist,
                likeTableName: likeTable?.code || likeTable?.collectionName,
                selectStatement: _.trim(detailsTab.selectStatement),
                options: {...detailsTab.tableOptions, description: detailsTab.description},
                partitioning: detailsTab.partitioning,
            };
        },

        hydrateViewColumn(data) {
            return {
                name: data.name,
                tableName: data.entityName,
                alias: data.alias,
                isActivated: data.isActivated,
                dbName: data.dbName,
            };
        },

        hydrateView({viewData, entityData, relatedSchemas, relatedContainers}) {
            const detailsTab = entityData[0];

            return {
                name: viewData.name,
                tableName: viewData.tableName,
                keys: viewData.keys,
                orReplace: detailsTab.orReplace,
                ifNotExist: detailsTab.ifNotExist,
                selectStatement: detailsTab.selectStatement,
                sqlSecurity: detailsTab.SQL_SECURITY,
                algorithm: detailsTab.algorithm,
                checkOption: detailsTab.withCheckOption ? detailsTab.checkTestingScope : '',
            };
        },

        commentIfDeactivated(statement, data, isPartOfLine) {
            return statement;
        },

        hydrateUdf(udf) {
            return {
                name: udf.name,
                delimiter: udf.functionDelimiter,
                orReplace: udf.functionOrReplace,
                aggregate: udf.functionAggregate,
                ifNotExist: udf.functionIfNotExist,
                parameters: udf.functionArguments,
                type: udf.functionReturnType,
                characteristics: {
                    sqlSecurity: udf.functionSqlSecurity,
                    language: udf.functionLanguage,
                    contains: udf.functionContains,
                    deterministic: udf.functionDeterministic,
                    comment: udf.functionDescription,
                },
                body: udf.functionBody,
            };
        },

        hydrateProcedure(procedure) {
            return {
                orReplace: procedure.orReplace,
                delimiter: procedure.delimiter,
                name: procedure.name,
                parameters: procedure.inputArgs,
                body: procedure.body,
                characteristics: {
                    comment: procedure.comments,
                    contains: procedure.contains,
                    language: procedure.language,
                    deterministic: procedure.deterministic,
                    sqlSecurity: procedure.securityMode,
                },
            };
        },

        /**
         * @return {string}
         * */
        createUdf(databaseName, udf) {
            const characteristics = getCharacteristics(udf.characteristics);
            let startDelimiter = udf.delimiter ? `DELIMITER ${udf.delimiter}\n` : '';
            let endDelimiter = udf.delimiter ? `DELIMITER ;\n` : '';

            return (
                startDelimiter +
                assignTemplates(templates.createFunction, {
                    name: getTableName(udf.name, databaseName),
                    orReplace: udf.orReplace ? 'OR REPLACE ' : '',
                    ifNotExist: udf.ifNotExist ? 'IF NOT EXISTS ' : '',
                    aggregate: udf.aggregate ? 'AGGREGATE ' : '',
                    characteristics: characteristics.join('\n\t'),
                    type: udf.type,
                    parameters: udf.parameters,
                    body: udf.body,
                    delimiter: udf.delimiter || ';',
                }) +
                endDelimiter
            );
        },

        /**
         * @return {string}
         * */
        createProcedure(databaseName, procedure) {
            const characteristics = getCharacteristics(procedure.characteristics);
            let startDelimiter = procedure.delimiter ? `DELIMITER ${procedure.delimiter}\n` : '';
            let endDelimiter = procedure.delimiter ? `DELIMITER ;\n` : '';

            return (
                startDelimiter +
                assignTemplates(templates.createProcedure, {
                    name: getTableName(procedure.name, databaseName),
                    orReplace: procedure.orReplace ? 'OR REPLACE ' : '',
                    parameters: procedure.parameters,
                    characteristics: characteristics.join('\n\t'),
                    body: procedure.body,
                    delimiter: procedure.delimiter || ';',
                }) +
                endDelimiter
            );
        },

        /**
         * @param tableName {string}
         * @param dbData {{
         *     databaseName: string,
         * }}
         * @param index {{
         *     name: string
         * }}
         * @return {string}
         * */
        dropIndex(tableName, dbData, index) {
            const ddlTableName = getTableName(tableName, dbData.databaseName);
            const indexName = index.name;
            const ddlIndexName = wrapInTics(indexName);

            const templatesConfig = {
                tableName: ddlTableName,
                indexName: ddlIndexName,
            };
            return assignTemplates(templates.dropIndex, templatesConfig);
        },

        viewSelectStatement(viewData, isActivated = true) {
            const allDeactivated = checkAllKeysDeactivated(viewData.keys || []);
            const deactivatedWholeStatement = allDeactivated || !isActivated;
            const {columns, tables} = getViewData(viewData.keys);
            let columnsAsString = columns.map(column => column.statement).join(',\n\t\t');

            if (!deactivatedWholeStatement) {
                const dividedColumns = divideIntoActivatedAndDeactivated(columns, column => column.statement);
                const deactivatedColumnsString = dividedColumns.deactivatedItems.length
                    ? commentIfDeactivated(dividedColumns.deactivatedItems.join(',\n\t\t'), {
                        isActivated: false,
                        isPartOfLine: true,
                    })
                    : '';
                columnsAsString = dividedColumns.activatedItems.join(',\n\t\t') + deactivatedColumnsString;
            }

            const selectStatement = _.trim(viewData.selectStatement)
                ? _.trim(tab(viewData.selectStatement))
                : assignTemplates(templates.viewSelectStatement, {
                    tableName: tables.join(', '),
                    keys: columnsAsString,
                });

            return {deactivatedWholeStatement, selectStatement};
        },

        /**
         * @param viewName {string}
         * @param selectStatement {string}
         * @param sqlSecurity {string | undefined}
         * @param algorithm {string | undefined}
         * @return {string}
         */
        alterView({viewName, selectStatement, sqlSecurity, algorithm}) {
            const templateConfig = {
                name: viewName,
                selectStatement,
                sqlSecurity: sqlSecurity ? ` ${sqlSecurity}` : '',
                algorithm: algorithm ? ` ${algorithm}` : '',
            }
            return assignTemplates(templates.alterView, templateConfig)
        },

        /**
         * @param databaseName {string}
         * @return {string}
         * */
        dropDatabase(databaseName) {
            const templateConfig = {
                databaseName,
            }
            return assignTemplates(templates.dropDatabase, templateConfig);
        },

        /**
         * @param procedureName {string}
         * @return {string}
         * */
        dropProcedure(procedureName) {
            const templateConfig = {
                procedureName,
            }
            return assignTemplates(templates.dropProcedure, templateConfig);
        },

        /**
         * @param udfName {string}
         * @return {string}
         * */
        dropUdf(udfName) {
            const templateConfig = {
                functionName: udfName,
            }
            return assignTemplates(templates.dropFunction, templateConfig);
        },

        /**
         * @param databaseName {string}
         * @param characterSet {string}
         * @param collation {string}
         * @return {string}
         * */
        alterCollation(databaseName, characterSet, collation) {
            const templateConfig = {
                databaseName,
                characterSet,
                collation,
            }
            return assignTemplates(templates.alterCollation, templateConfig);
        },

        /**
         * @param viewName {string}
         * @return {string}
         * */
        dropView(viewName) {
            const templateConfig = {
                viewName
            }
            return assignTemplates(templates.dropView, templateConfig);
        },

        /**
         * @param tableName {string}
         * @return {string}
         * */
        dropTable(tableName) {
            const templateConfig = {
                tableName,
            }
            return assignTemplates(templates.dropTable, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param columnName {string}
         * @return {string}
         * */
        dropColumn(tableName, columnName) {
            const templateConfig = {
                tableName,
                columnName
            }
            return assignTemplates(templates.dropColumn, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param columnDefinition {string}
         * @return {string}
         * */
        addColumn(tableName, columnDefinition) {
            const templateConfig = {
                tableName,
                columnDefinition
            }
            return assignTemplates(templates.addColumn, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param oldName {string}
         * @param newName {string}
         * @return {string}
         * */
        renameColumn(tableName, oldName, newName) {
            const templateConfig = {
                tableName,
                oldName,
                newName,
            }
            return assignTemplates(templates.renameColumn, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param hydratedColumn {HydratedColumn}
         * @return {string}
         * */
        modifyColumn(tableName, hydratedColumn,) {
            const columnDefinitionAsDDL = mapColumnToColumnDefinitionDdl(hydratedColumn);
            const templateConfig = {
                tableName,
                columnDefinition: columnDefinitionAsDDL,
            }
            return assignTemplates(templates.modifyColumn, templateConfig)
        },

        /**
         * @param tableName {string}
         * @param tableOptions {{
         *     defaultCharSet?: boolean,
         *     characterSet?: string,
         *     collation?: string,
         * } | undefined}
         * @return {string}
         * */
        modifyTableOptions(tableName, tableOptions) {
            const defaultKeyword = tableOptions?.defaultCharSet ? 'DEFAULT ' : '';
            const characterSetDefinition = tableOptions?.characterSet
                ? `CHARACTER SET='${tableOptions?.characterSet}' `
                : '';
            const collateDefinition = tableOptions?.collation ? `COLLATE='${tableOptions?.collation}'` : '';

            const templateConfig = {
                tableName,
                defaultKeyword,
                characterSetDefinition,
                collateDefinition,
            }
            return assignTemplates(templates.modifyTableOptions, templateConfig).trim();
        },

        /**
         * @param tableName {string}
         * @param comment {string}
         * @return string
         * */
        updateTableComment(tableName, comment) {
            const templateConfig = {
                tableName,
                comment
            }
            return assignTemplates(templates.updateCommentOnTable, templateConfig);
        },

        /**
         * @param tableName {string}
         * @return string
         * */
        dropTableComment(tableName) {
            const templateConfig = {
                tableName,
                comment: "''"
            }
            return assignTemplates(templates.updateCommentOnTable, templateConfig);
        },

        /**
         * @param schemaName {string}
         * @param comment {string}
         * @return string
         * */
        updateSchemaComment(schemaName, comment) {
            const templateConfig = {
                schemaName,
                comment
            }
            return assignTemplates(templates.updateCommentOnSchema, templateConfig);
        },

        /**
         * @param schemaName {string}
         * @return string
         * */
        dropSchemaComment(schemaName) {
            const templateConfig = {
                schemaName,
                comment: "''"
            }
            return assignTemplates(templates.updateCommentOnSchema, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param constraintName {string}
         * @return string
         * */
        dropConstraint(tableName, constraintName) {
            const templateConfig = {
                tableName,
                constraintName
            }
            return assignTemplates(templates.dropConstraint, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param constraintName {string}
         * @param expression {expression}
         * @return string
         * */
        addCheckConstraint(tableName, constraintName, expression) {
            const templateConfig = {
                tableName,
                constraintName,
                expression
            };
            return assignTemplates(templates.addCheckConstraint, templateConfig);
        },

        /**
         * @param tableName {string}
         * @param isParentActivated {boolean}
         * @param keyData {{
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
         * }}
         * @return {{
         *     statement: string,
         *     isActivated: boolean,
         * }}
         * */
        addPrimaryKey(
            tableName,
            isParentActivated,
            keyData
        ) {
            const constraintStatementDto = createKeyConstraint(templates, isParentActivated)(keyData);
            const templatesConfig = {
                tableName,
                constraintStatement: constraintStatementDto.statement,
            }
            const addPkStatement = assignTemplates(templates.addPkConstraint, templatesConfig);
            return {
                statement: addPkStatement,
                isActivated: isParentActivated && constraintStatementDto.isActivated,
            }
        },

        /**
         * @param tableName {string}
         * @return {string}
         * */
        dropPrimaryKey(tableName) {
            const templatesConfig = {
                tableName
            };
            return assignTemplates(templates.dropPrimaryKey, templatesConfig);
        },
    };
};
