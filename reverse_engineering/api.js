'use strict';

const connectionHelper = require('./helpers/connectionHelper');
const mariadbHelper = require('./helpers/mariadbHelper');

BigInt.prototype.toJSON = function () {
	return Number(this.valueOf());
}

module.exports = {
	async connect(connectionInfo) {
		const connection = await connectionHelper.connect(connectionInfo);

		return connection;
	},

	disconnect(connectionInfo, logger, callback, app) {
		callback();
	},

	async testConnection(connectionInfo, logger, callback, app) {
		const log = createLogger({
			title: 'Test connection',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});

		try {
			logger.clear();
			logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

			const connection = await this.connect(connectionInfo);
			await connection.ping();

			log.info('Connected successfully');

			callback(null);
		} catch(error) {
			log.error(error);
			callback({ message: error.message, stack: error.stack });
		}
	},

	async getDbCollectionsNames(connectionInfo, logger, callback, app) {
		const log = createLogger({
			title: 'Retrieving databases and tables information',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});

		try {
			logger.clear();
			logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);
			const systemDatabases = connectionInfo.includeSystemCollection ? [] : ['information_schema'];

			const connection = await this.connect(connectionInfo);
			const databases = connectionInfo.databaseName ? [connectionInfo.databaseName] : await connectionHelper.getDatabases(connection, systemDatabases);
			
			const collections = await databases.reduce(async (next, dbName) => {
				const result = await next;
				try {
					const entities = await connectionHelper.getTables(connection, dbName);
					const dbCollections = getDbCollectionNames(entities, dbName, connectionInfo.includeSystemCollection);

					return result.concat({
						dbName,
						dbCollections,
						isEmpty: dbCollections.length === 0,
					});
				} catch (error) {
					log.info(`Error reading database "${dbName}"`);
					log.error(error);

					return result.concat({
						dbName,
						dbCollections: [],
						isEmpty: true,
						status: true,
					});
				}
			}, Promise.resolve([]));

			log.info('Names retrieved successfully');

			callback(null, collections);
		} catch(error) {
			log.error(error);
			callback({ message: error.message, stack: error.stack });
		}
	},

	async getDbCollectionsData(data, logger, callback, app) {
		const _ = app.require('lodash');
		const async = app.require('async');
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: data.hiddenKeys,
			logger,
		});

		try {
			logger.log('info', data, 'data', data.hiddenKeys);

			const collections = data.collectionData.collections;
			const dataBaseNames = data.collectionData.dataBaseNames;
			const connection = await this.connect(data);
			const instance = await connectionHelper.createInstance(connection); 

			log.info('MariaDB version: ' + connection.serverVersion());

			const result = await async.mapSeries(dataBaseNames, async (dbName) => {
				const tables = collections[dbName].filter(name => !isViewName(name));
				const views = collections[dbName].filter(isViewName);
				const containerData = mariadbHelper.parseDatabaseStatement(
					await instance.describeDatabase(dbName)
				);
				const UDFs = mariadbHelper.parseFunctions(
					await instance.getFunctions(dbName)
				);
				const Procedures = mariadbHelper.parseProcedures(
					await instance.getProcedures(dbName)
				);

				const result = await async.mapSeries(tables, async (tableName) => {
					const count = await instance.getCount(dbName, tableName);
					const records = await instance.getRecords(dbName, tableName, getLimit(count, data.recordSamplingSettings));
					const ddl = await instance.showCreateTable(dbName, tableName);
					const indexes = await instance.getIndexes(dbName, tableName);
					const constraints = await instance.getConstraints(dbName, tableName);
					const columns = await instance.getColumns(dbName, tableName);
					const jsonSchema = mariadbHelper.getJsonSchema({ columns, constraints, records });

					return {
						dbName: dbName,
						collectionName: tableName,
						// entityLevel: entityData,
						documents: records,
						views: [],
						standardDoc: records[0],
						ddl: {
							script: ddl,
							type: 'mariadb'
						},
						emptyBucket: false,
						validation: {
							jsonSchema
						},
						bucketInfo: {
							...containerData,
							UDFs,
							Procedures,
						},
					};
				});
				
				return result;
			});


			callback(null, result.flat());
		} catch(error) {
			log.error(error);
			callback({ message: error.message, stack: error.stack });
		}
	},
};

const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message) {
			logger.log('info', { message }, title, hiddenKeys);
		},

		error(error) {
			logger.log('error', {
				message: error.message,
				stack: error.stack,
			}, title);
		}
	};
};

const getDbCollectionNames = (entities, dbName, includeSystemCollection) => {
	const isView = (type) => {
		return ['SYSTEM VIEW', 'VIEW'].includes(type);
	};

	return entities.filter(table => {
		if (includeSystemCollection) {
			return true;
		}

		const isSystem = !['BASE TABLE', 'VIEW', 'SEQUENCE'].includes(table['Table_type']);

		return !isSystem;
	}).map(table => {
		const name = table[`Tables_in_${dbName}`];

		if (isView(table['Table_type'])) {
			return `${name} (v)`;
		} else {
			return name;
		}
	});
};

const getLimit = (count, recordSamplingSettings) => {
	const per = recordSamplingSettings.relative.value;
	const size = (recordSamplingSettings.active === 'absolute')
		? recordSamplingSettings.absolute.value
		: Math.round(count / 100 * per);
	return size;
};

const isViewName = (name) => {
	return /\ \(v\)$/i.test(name);
};

