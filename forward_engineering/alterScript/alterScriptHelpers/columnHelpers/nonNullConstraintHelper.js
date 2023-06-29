

/**
 * @return {(columnName: string, columnJsonSchema: Object, collection: Object) => boolean}
 * */
const hasNotNullAttributeChanged = (_) => (columnName, columnJsonSchema, collection) => {
    const currentRequiredColumnNames = collection.required || [];
    const previousRequiredColumnNames = collection.role.required || [];

    const oldName = columnJsonSchema.compMod.oldField.name;

    const isCurrentlyRequired = currentRequiredColumnNames.includes(columnName);
    const wasRequired = previousRequiredColumnNames.includes(oldName);

    return isCurrentlyRequired !== wasRequired;
}

module.exports = {
    hasNotNullAttributeChanged,
}
