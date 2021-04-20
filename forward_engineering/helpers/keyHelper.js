module.exports = (_, clean) => {
	const isInlineUnique = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (!column.unique) {
			return false;
		} else {
			return true;
		}
	};
	
	const isInlinePrimaryKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (column.compositePrimaryKey) {
			return false;
		} else if (!column.primaryKey) {
			return false;
		} else {
			return true;
		}
	};
	
	const getOrder = order => {
		if (_.toLower(order) === 'asc') {
			return 'ASC';
		} else if (_.toLower(order) === 'desc') {
			return 'DESC';
		} else {
			return '';
		}
	};
	
	const hydrateUniqueOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'UNIQUE',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
		});
	
	const hydratePrimaryKeyOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'PRIMARY KEY',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
		});
	
	const findName = (keyId, properties) => {
		return Object.keys(properties).find(name => properties[name].GUID === keyId);
	};
	
	const checkIfActivated = (keyId, properties) => {
		return _.get(
			Object.values(properties).find(prop => prop.GUID === keyId),
			'isActivated',
			true,
		);
	};
	
	const getKeys = (keys, jsonSchema) => {
		return keys.map(key => {
			return {
				name: findName(key.keyId, jsonSchema.properties),
				order: key.type === 'descending' ? 'DESC' : 'ASC',
				isActivated: checkIfActivated(key.keyId, jsonSchema.properties),
			};
		});
	};
	
	const getCompositePrimaryKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.primaryKey)) {
			return [];
		}
	
		return jsonSchema.primaryKey
			.filter(primaryKey => !_.isEmpty(primaryKey.compositePrimaryKey))
			.map(primaryKey => ({
				...hydratePrimaryKeyOptions(primaryKey),
				columns: getKeys(primaryKey.compositePrimaryKey, jsonSchema),
			}));
	};
	
	const getCompositeUniqueKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.uniqueKey)) {
			return [];
		}
	
		return jsonSchema.uniqueKey
			.filter(uniqueKey => !_.isEmpty(uniqueKey.compositeUniqueKey))
			.map(uniqueKey => ({
				...hydrateUniqueOptions(uniqueKey),
				columns: getKeys(uniqueKey.compositeUniqueKey, jsonSchema),
			}));
	};
	
	const getTableKeyConstraints = ({ jsonSchema }) => {
		if (!jsonSchema.properties) {
			return [];
		}
	
		return [...getCompositePrimaryKeys(jsonSchema), ...getCompositeUniqueKeys(jsonSchema)];
	};
	
	return {
		getTableKeyConstraints,
		isInlineUnique,
		isInlinePrimaryKey,
	};
};
