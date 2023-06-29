

/**
 * @return {(collection: Object) => boolean}
 * */
const hasNotNullAttributeChanged = (_) => (collection) => {
    const currentRequiredColumnNames = collection.required || [];
    const previousRequiredColumnNames = collection.role.required || [];

    const columnNamesToAddNotNullConstraint = _.difference(currentRequiredColumnNames, previousRequiredColumnNames);
    const columnNamesToRemoveNotNullConstraint = _.difference(previousRequiredColumnNames, currentRequiredColumnNames);

    return !(columnNamesToAddNotNullConstraint.length === 0 && columnNamesToRemoveNotNullConstraint === 0);
}

module.exports = {
    hasNotNullAttributeChanged,
}
