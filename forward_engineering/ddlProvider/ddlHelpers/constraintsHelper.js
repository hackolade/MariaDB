const {KeyJsonSchema} = require('../types/keyJsonSchema');

module.exports = ({
                      _,
                      commentIfDeactivated,
                      checkAllKeysDeactivated,
                      divideIntoActivatedAndDeactivated,
                      assignTemplates,
                      escapeQuotes
                  }) => {
    const generateConstraintsString = (dividedConstraints, isParentActivated) => {
        const deactivatedItemsAsString = commentIfDeactivated((dividedConstraints?.deactivatedItems || []).join(',\n\t'), {
            isActivated: !isParentActivated,
            isPartOfLine: true,
        });
        const activatedConstraints = dividedConstraints?.activatedItems?.length
            ? ',\n\t' + dividedConstraints.activatedItems.join(',\n\t')
            : '';

        const deactivatedConstraints = dividedConstraints?.deactivatedItems?.length
            ? '\n\t' + deactivatedItemsAsString
            : '';

        return activatedConstraints + deactivatedConstraints;
    };

    /**
     * @param keys {string | Array<KeyJsonSchema>}
     * @return {string}
     * */
    const foreignKeysToString = keys => {
        if (Array.isArray(keys)) {
            const activatedKeys = keys.filter(key => _.get(key, 'isActivated', true)).map(key => `\`${_.trim(key.name)}\``);
            const deactivatedKeys = keys
                .filter(key => !_.get(key, 'isActivated', true))
                .map(key => `\`${_.trim(key.name)}\``);
            const deactivatedKeysAsString = deactivatedKeys.length
                ? commentIfDeactivated(deactivatedKeys, {isActivated: false, isPartOfLine: true})
                : '';

            return activatedKeys.join(', ') + deactivatedKeysAsString;
        }
        return keys;
    };

    /**
     * @param keys {Array<KeyJsonSchema>}
     * @return {string}
     * */
    const foreignActiveKeysToString = keys => {
        return keys.map(key => _.trim(key.name)).join(', ');
    };

    /**
     * @param templates {Record<string, string>}
     * @param isParentActivated {boolean}
     * @return {(
     *     keyData: {
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
     *     }
     * ) => {
     *     statement: string,
     *     isActivated: boolean
     * } }
     * */
    const createKeyConstraint = (templates, isParentActivated) => keyData => {
        const isAllColumnsDeactivated = checkAllKeysDeactivated(keyData.columns || []);

        const columns = getKeyColumns(isAllColumnsDeactivated, isParentActivated, keyData.columns);

        const using = keyData.category ? ` USING ${keyData.category}` : '';
        const ignore = keyData.ignore ? ` IGNORED` : '';
        const comment = keyData.comment ? ` COMMENT '${escapeQuotes(keyData.comment)}'` : '';
        const blockSize = keyData.blockSize ? ` KEY_BLOCK_SIZE=${keyData.blockSize}` : '';

        return {
            statement: assignTemplates(templates.createKeyConstraint, {
                constraintName: keyData.name ? `CONSTRAINT \`${_.trim(keyData.name)}\` ` : '',
                keyType: keyData.keyType,
                blockSize,
                columns,
                comment,
                ignore,
                using,
            }),
            isActivated: !isAllColumnsDeactivated,
        };
    };

    /**
     * @param isParentActivated {boolean}
     * @param isAllColumnsDeactivated {boolean}
     * @param columns {Array<{
     *     name: string,
     *     order: number | string,
     *     isActivated: boolean,
     * }>}}
     * @return {string}
     * */
    const getKeyColumns = (isAllColumnsDeactivated, isParentActivated, columns) => {
        if (!columns) {
            return '';
        }

        const columnMapToString = ({name, order}) => `\`${name}\` ${order}`.trim();
        const dividedColumns = divideIntoActivatedAndDeactivated(columns, columnMapToString);
        const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
            ? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), {isActivated: false, isPartOfLine: true})
            : '';

        return !isAllColumnsDeactivated && isParentActivated
            ? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
            : ' (' + columns.map(columnMapToString).join(', ') + ')';
    }

    return {
        generateConstraintsString,
        foreignKeysToString,
        foreignActiveKeysToString,
        createKeyConstraint,
    };
};
