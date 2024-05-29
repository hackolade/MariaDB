/**
 * @return {(columnJsonSchema: Object, collection: Object) => boolean}
 * */
const hasCommentChanged = _ => (columnJsonSchema, collection) => {
	const newComment = columnJsonSchema.description;
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldComment = collection.role.properties[oldName]?.description;

	const shouldUpsertComment = newComment && (!oldComment || newComment !== oldComment);
	const shouldRemoveComment = oldComment && !newComment;

	return shouldUpsertComment || shouldRemoveComment;
};

module.exports = {
	hasCommentChanged,
};
