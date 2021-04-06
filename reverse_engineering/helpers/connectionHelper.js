const mariadb = require('mariadb');

let connection;

const connect = async (connectionInfo) => {
	if (connection) {
		return connection;
	}

	connection = await mariadb.createConnection({ 
		user: connectionInfo.userName, 
		password: connectionInfo.userPassword, 
		port: connectionInfo.port,
		metaAsArray: false,
		ssl: false,
		dateStrings: true ,
		supportBigInt: true,
		autoJsonMap: false,
	  });

	  return connection;
};

const getDatabases = async (connection, systemDatabases) => {
	const databases = await connection.query('show databases;');

	return databases.map(item => item.Database).filter(dbName => !systemDatabases.includes(dbName));
};

const getTables = async (connection, dbName) => {
	const tables = await connection.query(`show full tables from \`${dbName}\`;`);

	return tables;
};

const createInstance = (connection) => {
	const getCount = async (dbName, tableName) => {
		const count = await connection.query(`SELECT COUNT(*) as count FROM \`${dbName}\`.\`${tableName}\`;`);

		return count[0]?.count || 0;
	};
	
	const getRecords = async (dbName, tableName, limit) => {
		const result = await connection.query({
			sql: `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT ${limit};`
		});

		return result;
	};

	const getVersion = async () => {
		const version = await connection.query('select version() as version;');

		return version[0].version;
	};

	const describeDatabase = async (dbName) => {
		const data = await connection.query(`show create database \`${dbName}\`;`);

		return data[0]['Create Database'];
	}; 

	const getFunctions = async (dbName) => {
		const functions = await connection.query(`show function status WHERE Db = '${dbName}'`);

		return Promise.all(
			functions.map(
				f => connection.query(`show create function \`${dbName}\`.\`${f.Name}\`;`).then(functionCode => ({
					meta: f,
					data: functionCode,
				}))
			)
		);
	};

	const getProcedures = async (dbName) => {
		const functions = await connection.query(`show procedure status WHERE Db = '${dbName}'`);

		return Promise.all(
			functions.map(
				f => connection.query(`show create procedure \`${dbName}\`.\`${f.Name}\`;`).then(functionCode => ({
					meta: f,
					data: functionCode,
				}))
			)
		);
	};

	const showCreateTable = async (dbName, tableName) => {
		const result = await connection.query(`show create table \`${dbName}\`.\`${tableName}\`;`);

		return result[0]?.['Create Table'];
	};

	const getConstraints = async (dbName, tableName) => {
		const result = await connection.query(`select * from information_schema.check_constraints where CONSTRAINT_SCHEMA='${dbName}' AND TABLE_NAME='${tableName}';`);

		return result;
	};

	const getColumns = async (dbName, tableName) => {
		const result = await connection.query(`show fields from \`${dbName}\`.\`${tableName}\`;`);

		return result;
	};

	return {
		getCount,
		getRecords,
		getVersion,
		describeDatabase,
		getFunctions,
		getProcedures,
		showCreateTable,
		getConstraints,
		getColumns,
	};
};

module.exports = {
	connect,
	getDatabases,
	getTables,
	createInstance,
};
