const {AlterScriptDto} = require("../../types/AlterScriptDto");
const {AlterCollectionDto} = require('../../types/AlterCollectionDto');

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto}
 */
const getUpdatedCommentOnCollectionScriptDto = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        escapeQuotes,
        getCollectionSchema,
        getCollectionName,
        getDatabaseName
    } = require('../../../utils/general')({_});

    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return undefined;
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!newComment || newComment === oldComment) {
        return undefined;
    }

    const collectionSchema = getCollectionSchema(collection);
    const tableName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(tableName, databaseName);

    const ddlComment = escapeQuotes(newComment);

    const script = ddlProvider.updateTableComment(fullTableName, ddlComment);
    return AlterScriptDto.getInstance([script], true, false);
}

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto}
 */
const getDeletedCommentOnCollectionScriptDto = (_, ddlProvider) => (collection) => {
    const {
        getTableName,
        getCollectionSchema,
        getCollectionName,
        getDatabaseName
    } = require('../../../utils/general')({_});

    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return undefined;
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!oldComment || newComment) {
        return undefined;
    }

    const collectionSchema = getCollectionSchema(collection);
    const tableName = getCollectionName(collectionSchema);
    const databaseName = getDatabaseName(collectionSchema);
    const fullTableName = getTableName(tableName, databaseName);

    const script = ddlProvider.dropTableComment(fullTableName);
    return AlterScriptDto.getInstance([script], true, true);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyEntityCommentsScriptDtos = (_, ddlProvider) => collection => {
    const updatedCommentScript = getUpdatedCommentOnCollectionScriptDto(_, ddlProvider)(collection);
    const deletedCommentScript = getDeletedCommentOnCollectionScriptDto(_, ddlProvider)(collection);

    return [
        updatedCommentScript,
        deletedCommentScript
    ].filter(Boolean);
};

module.exports = {
    getModifyEntityCommentsScriptDtos
}
